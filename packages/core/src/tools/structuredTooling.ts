import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { grm, select } from 'guidance-ts';
import { canonicalJson, contentHash } from '../artifact/canonical.js';
import { normalizeToolId } from '../artifact/manifest.js';
import { loadUtkConfig, resolveRegisteredTool, resolveSerializerProviderId } from '../config/config.js';
import { getSerializationProvider, serializedExtension } from '../serialization/providers.js';
import { safeJoin } from '../security/pathSafety.js';

export type StructuredInputGrammar = 'bash-like' | 'sql' | 'lucene' | 'regex';

export type StructuredToolParameter = {
  name: string;
  grammar: StructuredInputGrammar;
  completions: string[];
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
  serializerId: 'toon' | 'compressed-json';
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
}): AsyncTool<I, MemoizedToolResult<O>> {
  const { workspaceRoot, cacheNamespace, cacheKeyPrefix, enabled, tool } = params;
  return async (input: I): Promise<MemoizedToolResult<O>> => {
    const cachePath = cacheFilePath(workspaceRoot, cacheNamespace, cacheKeyPrefix, input);
    if (enabled) {
      const cached = await readCachedValue<O>(cachePath);
      if (cached.found) return { value: cached.value, cacheHit: true, cachePath };
    }
    const value = await tool(input);
    if (enabled) await writeCachedValue(cachePath, value);
    return { value, cacheHit: false, cachePath };
  };
}

export async function completeStructuredToolInvocation(params: {
  workspaceRoot: string;
  request: string;
  tools: StructuredToolDefinition[];
}): Promise<StructuredToolInvocationResult> {
  if (params.tools.length === 0) {
    throw new Error('At least one structured tool definition is required');
  }

  const config = await loadUtkConfig(params.workspaceRoot);
  const selected = selectTool(params.request, params.tools);
  const selectedTool = withConfigDefaults(selected, resolveRegisteredTool(config, selected.toolId));
  const normalizedToolId = normalizeToolId(selectedTool.toolId);
  const serializerId = resolveSerializerProviderId(config, normalizedToolId);
  const serializer = getSerializationProvider(serializerId);
  const grammar = buildStructuredInvocationGrammar(params.tools);
  const serializedGrammar = grammar.serialize();
  const planner = curryTool(async (input: { request: string; tool: StructuredToolDefinition }) => planInvocation(input.request, input.tool), { tool: selectedTool });
  const memoizedPlanner = memoizeTool({
    workspaceRoot: params.workspaceRoot,
    cacheNamespace: normalizedToolId,
    cacheKeyPrefix: 'structured-invocation',
    enabled: selectedTool.outputCache === true,
    tool: planner
  });
  const planned = await memoizedPlanner({ request: params.request, tool: selectedTool });
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
  const completionChoices = nonEmptyChoices(tools.flatMap((tool) => tool.parameters.flatMap((parameter) => parameter.completions)));
  return grm`invoke{tool:"${select(...toolChoices)}",value:"${select(...completionChoices)}"}`;
}

export function optimizeStructuredToolArgs(
  args: Record<string, unknown>,
  tool: Pick<StructuredToolDefinition, 'parameters'>
): { value: Record<string, unknown>; applied: boolean } {
  let applied = false;
  const entries = Object.entries(args).map(([key, value]) => {
    const parameter = tool.parameters.find((item) => item.name === key);
    if (!parameter) return [key, value] as const;
    if (typeof value !== 'string') return [key, value] as const;
    const optimized = optimizeStructuredField(value, parameter);
    if (optimized !== value) applied = true;
    return [key, optimized] as const;
  });
  return { value: Object.fromEntries(entries), applied };
}

function optimizeStructuredField(value: string, parameter: StructuredToolParameter): string {
  const normalized = normalizeStructuredValue(parameter.grammar, value);
  const completion = parameter.completions.find((candidate) => normalizeStructuredValue(parameter.grammar, candidate) === normalized);
  return completion ?? normalized;
}

function normalizeStructuredValue(grammar: StructuredInputGrammar, value: string): string {
  if (grammar === 'regex') return value.trim();
  if (grammar === 'sql') {
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ',')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')');
  }
  if (grammar === 'lucene') {
    return value
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*:\s*/g, ':')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')');
  }
  return value.trim().replace(/\s+/g, ' ');
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
  const direct = parameter.completions.find((completion) => termMatches(haystack, completion));
  if (direct) return optimizeStructuredField(direct, parameter);
  if (parameter.description && termMatches(haystack, parameter.description)) {
    return parameter.completions[0] ? optimizeStructuredField(parameter.completions[0], parameter) : undefined;
  }
  if (parameter.completions.length === 1 && parameter.required) {
    const first = parameter.completions[0];
    return first ? optimizeStructuredField(first, parameter) : undefined;
  }
  return undefined;
}

function selectTool(request: string, tools: StructuredToolDefinition[]): StructuredToolDefinition {
  return [...tools].sort((left, right) => scoreTool(request, right) - scoreTool(request, left))[0]!;
}

function scoreTool(request: string, tool: StructuredToolDefinition): number {
  const haystack = normalizeText(request);
  const terms = [tool.toolId, tool.description ?? '', ...tool.parameters.flatMap((parameter) => [parameter.name, parameter.description ?? '', ...parameter.completions])];
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
        grammar: item.grammar,
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
