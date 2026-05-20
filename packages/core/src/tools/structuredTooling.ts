import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { grm, select } from 'guidance-ts';
import { canonicalJson, contentHash } from '../artifact/canonical.js';
import { normalizeToolId } from '../artifact/manifest.js';
import { loadUtkConfig, resolveRegisteredTool, resolveSerializerProviderId } from '../config/config.js';
import { getSerializationProvider, serializedExtension } from '../serialization/providers.js';
import { safeJoin } from '../security/pathSafety.js';
import { recordFailure, type RunContext } from '../tracing/index.js';

export type StructuredToolParameter = {
  name: string;
  completions?: string[];
  required?: boolean;
  description?: string;
};

export type StructuredToolDefinition = {
  toolId: string;
  description?: string;
  outputCache?: boolean;
  bypassOnCache?: boolean;
  curryFields?: string[];
  parameters: StructuredToolParameter[];
};

export type StructuredToolInvocation = {
  toolId: string;
  args: Record<string, string>;
};

export type StructuredToolInvocationResult = {
  invocation: StructuredToolInvocation;
  templatePath: string;
  serializerId: string;
  confidence: number;
  missingRequired: string[];
  guidance: {
    used: boolean;
    available: boolean;
    serializedGrammar: unknown;
    errors: string[];
  };
  cache: {
    eligible: boolean;
    hit: boolean;
    bypass: boolean;
    path: string;
  };
};

export type StructuredGuidanceGrammarNode = {
  serialize(): unknown;
};

export type AsyncTool<I extends Record<string, unknown>, O> = (input: I) => Promise<O>;

export type MemoizedToolResult<O> = {
  value: O;
  cacheHit: boolean;
  cachePath: string;
};

export function curryTool<I extends Record<string, unknown>, O>(tool: AsyncTool<I, O>, preset: Partial<I>): AsyncTool<I, O> {
  return async (input: I): Promise<O> => tool({ ...preset, ...input } as I);
}

export function memoizeTool<I extends Record<string, unknown>, O>(params: {
  workspaceRoot: string;
  cacheNamespace: string;
  cacheKeyPrefix: string;
  enabled: boolean;
  tool: AsyncTool<I, O>;
  tracer?: RunContext;
}): AsyncTool<I, MemoizedToolResult<O>> {
  const { workspaceRoot, cacheNamespace, cacheKeyPrefix, enabled, tool, tracer } = params;
  return async (input: I): Promise<MemoizedToolResult<O>> => {
    const cachePath = cacheFilePath(workspaceRoot, cacheNamespace, cacheKeyPrefix, input);
    if (enabled) {
      const cached = await readCachedValue<O>(cachePath);
      if (cached.found) return { value: cached.value, cacheHit: true, cachePath };
    }
    const value = await tool(input);
    if (enabled) {
      try {
        await writeCachedValue(cachePath, value);
      } catch (error) {
        recordFailure(tracer, {
          name: 'cache.write',
          runType: 'tool',
          error: error as Error,
          extra: { cachePath }
        });
      }
    }
    return { value, cacheHit: false, cachePath };
  };
}

export async function completeStructuredToolInvocation(params: {
  workspaceRoot: string;
  request: string;
  tools: StructuredToolDefinition[];
  tracer?: RunContext;
}): Promise<StructuredToolInvocationResult> {
  if (params.tools.length === 0) {
    throw new Error('At least one structured tool definition is required');
  }

  const config = await loadUtkConfig(params.workspaceRoot);
  const mergedTools = params.tools.map((tool) => withConfigDefaults(tool, resolveRegisteredTool(config, tool.toolId)));
  const selectedTool = selectTool(params.request, mergedTools);
  const normalizedToolId = normalizeToolId(selectedTool.toolId);
  const serializerId = resolveSerializerProviderId(config, normalizedToolId);
  const serializer = getSerializationProvider(serializerId);
  const grammar = buildStructuredInvocationGrammar(mergedTools);
  const serializedGrammar = grammar.serialize();
  const planner = curryTool(
    async (input: { request: string; tool: StructuredToolDefinition }) =>
      planInvocation(input.request, input.tool),
    { tool: selectedTool }
  );
  const memoizedPlanner = memoizeTool({
    workspaceRoot: params.workspaceRoot,
    cacheNamespace: normalizedToolId,
    cacheKeyPrefix: 'structured-invocation',
    enabled: selectedTool.outputCache === true,
    tool: planner,
    ...(params.tracer ? { tracer: params.tracer } : {})
  });
  const planned = await memoizedPlanner({ request: params.request, tool: selectedTool });
  if (planned.value.missingRequired.length > 0) {
    recordFailure(params.tracer, {
      name: 'planner.missing-required',
      runType: 'parser',
      extra: { toolId: selectedTool.toolId, fields: planned.value.missingRequired }
    });
  }
  const template = buildTemplate(selectedTool, planned.value, serializedGrammar);
  const serializedTemplate = serializer.serialize(template, { toolId: normalizedToolId });
  const templateDir = safeJoin(params.workspaceRoot, config.persistence.storage_root, 'tools', normalizedToolId, 'templates');
  await mkdir(templateDir, { recursive: true });
  const templatePath = safeJoin(templateDir, `structured-template.compact.${serializedExtension(serializerId)}`);
  await writeFile(templatePath, `${serializedTemplate}\n`, 'utf8');
  await writeFile(safeJoin(templateDir, 'structured-template.guidance.json'), canonicalJson(serializedGrammar), 'utf8');

  return {
    invocation: planned.value.invocation,
    templatePath,
    serializerId,
    confidence: planned.value.missingRequired.length === 0 ? 1 : 0.72,
    missingRequired: planned.value.missingRequired,
    guidance: {
      used: true,
      available: false,
      serializedGrammar,
      errors: ['guidance session is not configured; used deterministic known completions']
    },
    cache: {
      eligible: selectedTool.outputCache === true,
      hit: planned.cacheHit,
      bypass: selectedTool.outputCache === true && selectedTool.bypassOnCache === true && planned.cacheHit,
      path: planned.cachePath
    }
  };
}

export function buildStructuredInvocationGrammar(tools: StructuredToolDefinition[]): StructuredGuidanceGrammarNode {
  const toolChoices = nonEmptyChoices(tools.map((tool) => tool.toolId));
  const completionChoices = nonEmptyChoices(
    tools.flatMap((tool) => tool.parameters.flatMap((parameter) => parameter.completions ?? []))
  );
  return grm`invoke{tool:"${select(...toolChoices)}",value:"${select(...completionChoices)}"}`;
}

type PlannedInvocation = {
  invocation: StructuredToolInvocation;
  missingRequired: string[];
};

function planInvocation(request: string, tool: StructuredToolDefinition): PlannedInvocation {
  const args: Record<string, string> = {};
  const missingRequired: string[] = [];

  for (const parameter of tool.parameters) {
    const completion = chooseCompletion(request, parameter);
    if (!completion) {
      if (parameter.required) missingRequired.push(parameter.name);
      continue;
    }
    args[parameter.name] = completion;
  }

  if (tool.curryFields) {
    for (const fieldName of tool.curryFields) {
      if (args[fieldName] !== undefined) continue;
      const parameter = tool.parameters.find((item) => item.name === fieldName);
      const completions = parameter?.completions ?? [];
      const firstCompletion = completions.find((value): value is string => typeof value === 'string' && value.length > 0);
      if (!firstCompletion) continue;
      args[fieldName] = firstCompletion;
      const missingIndex = missingRequired.indexOf(fieldName);
      if (missingIndex >= 0) missingRequired.splice(missingIndex, 1);
    }
  }

  return {
    invocation: {
      toolId: tool.toolId,
      args
    },
    missingRequired
  };
}

function chooseCompletion(request: string, parameter: StructuredToolParameter): string | undefined {
  const haystack = normalizeText(request);
  const completions = parameter.completions ?? [];
  const direct = completions.find((completion) => termMatches(haystack, completion));
  if (direct) return direct;
  if (parameter.description && termMatches(haystack, parameter.description)) {
    return completions[0];
  }
  if (completions.length === 1 && parameter.required) {
    return completions[0];
  }
  return undefined;
}

function selectTool(request: string, tools: StructuredToolDefinition[]): StructuredToolDefinition {
  return [...tools].sort((left, right) => scoreTool(request, right) - scoreTool(request, left))[0]!;
}

function scoreTool(request: string, tool: StructuredToolDefinition): number {
  const haystack = normalizeText(request);
  const terms = [
    tool.toolId,
    tool.description ?? '',
    ...tool.parameters.flatMap((parameter) => [parameter.name, parameter.description ?? '', ...(parameter.completions ?? [])])
  ];
  return terms.reduce((score, term) => score + (termMatches(haystack, term) ? 1 : 0), 0);
}

function termMatches(haystack: string, term: string | undefined): boolean {
  if (!term) return false;
  const normalized = normalizeText(term);
  if (!normalized) return false;
  return haystack.includes(normalized);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9*._-]+/g, ' ').trim();
}

function buildTemplate(tool: StructuredToolDefinition, planned: PlannedInvocation, serializedGrammar: unknown): Record<string, unknown> {
  return {
    template: {
      toolId: tool.toolId,
      args: planned.invocation.args,
      g: contentHash(serializedGrammar, 8),
      missing: planned.missingRequired
    }
  };
}

function cacheFilePath(workspaceRoot: string, namespace: string, keyPrefix: string, input: Record<string, unknown>): string {
  const key = contentHash(`${keyPrefix}:${canonicalJson(input)}`);
  return safeJoin(workspaceRoot, '.utk', 'cache', namespace, `${key}.json`);
}

async function readCachedValue<T>(cachePath: string): Promise<{ found: true; value: T } | { found: false }> {
  try {
    const text = await readFile(cachePath, 'utf8');
    const parsed = JSON.parse(text) as { value?: T };
    if (parsed && 'value' in parsed) return { found: true, value: parsed.value as T };
    return { found: false };
  } catch {
    return { found: false };
  }
}

async function writeCachedValue<T>(cachePath: string, value: T): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, canonicalJson({ value }), 'utf8');
}

function withConfigDefaults(tool: StructuredToolDefinition, configTool: ReturnType<typeof resolveRegisteredTool>): StructuredToolDefinition {
  if (!configTool) return tool;
  const byName = new Map(tool.parameters.map((item) => [item.name, item]));
  const mergedParameters = [
    ...tool.parameters.map((item) => ({ ...item })),
    ...configTool.structured_fields
      .filter((item) => !byName.has(item.name))
      .map((item) => ({
        name: item.name,
        completions: item.completions,
        required: item.required,
        description: item.description
      }))
  ];
  return {
    ...tool,
    description: tool.description ?? configTool.description,
    outputCache: tool.outputCache ?? configTool.output_cache,
    bypassOnCache: tool.bypassOnCache ?? configTool.bypass_on_cache,
    curryFields: tool.curryFields ?? configTool.curry_fields,
    parameters: mergedParameters
  };
}

function nonEmptyChoices(values: string[]): [string, ...string[]] {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 0 ? [''] : (unique as [string, ...string[]]);
}
