import { mkdir, writeFile } from 'node:fs/promises';
import { grm, select } from 'guidance-ts';
import { canonicalJson, contentHash } from '../artifact/canonical.js';
import { normalizeToolId } from '../artifact/manifest.js';
import { loadUtkConfig, resolveSerializerProviderId } from '../config/config.js';
import { type FieldGrammar, normalizeWithFieldGrammar } from '../grammar/fieldGrammar.js';
import { loadFieldGrammar } from '../grammar/grammarStore.js';
import { getSerializationProvider, serializedExtension } from '../serialization/providers.js';
import { safeJoin } from '../security/pathSafety.js';

export type BashLikeParameter = {
  name: string;
  kind: 'positional' | 'flag' | 'option';
  flag?: string;
  completions: string[];
  required?: boolean;
  description?: string;
};

export type BashLikeToolDefinition = {
  toolId: string;
  command: string;
  description?: string;
  parameters: BashLikeParameter[];
};

export type BashLikeInvocation = {
  toolId: string;
  command: string;
  argv: string[];
  parameters: Record<string, string>;
};

export type BashLikeInvocationResult = {
  invocation: BashLikeInvocation;
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
};

export type GuidanceGrammarNode = {
  serialize(): unknown;
};

export async function completeBashLikeToolInvocation(params: {
  workspaceRoot: string;
  request: string;
  tools: BashLikeToolDefinition[];
}): Promise<BashLikeInvocationResult> {
  if (params.tools.length === 0) {
    throw new Error('At least one tool definition is required');
  }

  const config = await loadUtkConfig(params.workspaceRoot);
  const selectedTool = selectTool(params.request, params.tools);
  const normalizedToolId = normalizeToolId(selectedTool.toolId);
  const serializerId = resolveSerializerProviderId(config, normalizedToolId);
  const serializer = getSerializationProvider(serializerId);
  const grammar = buildBashLikeInvocationGrammar(params.tools);
  const serializedGrammar = serializeGrammar(grammar);
  const learnedGrammars = await loadLearnedGrammars(params.workspaceRoot, selectedTool);
  const planned = planInvocation(params.request, selectedTool, learnedGrammars);
  const template = buildTemplate(selectedTool, planned, serializedGrammar);
  const serializedTemplate = serializer.serialize(template, { toolId: normalizedToolId });
  const templateDir = safeJoin(params.workspaceRoot, config.persistence.storage_root, 'tools', normalizedToolId, 'templates');
  await mkdir(templateDir, { recursive: true });
  const templatePath = safeJoin(templateDir, `cli-template.compact.${serializedExtension(serializerId)}`);
  await writeFile(templatePath, `${serializedTemplate}\n`, 'utf8');
  await writeFile(safeJoin(templateDir, 'cli-template.guidance.json'), canonicalJson(serializedGrammar), 'utf8');

  return {
    invocation: planned.invocation,
    templatePath,
    serializerId,
    confidence: planned.missingRequired.length === 0 ? 1 : 0.72,
    missingRequired: planned.missingRequired,
    guidance: {
      used: true,
      available: false,
      serializedGrammar,
      errors: ['guidance session is not configured; used deterministic known completions']
    }
  };
}

async function loadLearnedGrammars(
  workspaceRoot: string,
  tool: BashLikeToolDefinition
): Promise<Record<string, FieldGrammar | undefined>> {
  const entries = await Promise.all(
    tool.parameters.map(async (parameter) => [parameter.name, await loadFieldGrammar(workspaceRoot, tool.toolId, parameter.name)] as const)
  );
  return Object.fromEntries(entries);
}

export function buildBashLikeInvocationGrammar(tools: BashLikeToolDefinition[]): GuidanceGrammarNode {
  const toolChoices = nonEmptyChoices(tools.map((tool) => tool.toolId));
  const commandChoices = nonEmptyChoices(tools.map((tool) => tool.command));
  const completionChoices = nonEmptyChoices(
    tools.flatMap((tool) =>
      tool.parameters.flatMap((parameter) => [parameter.flag, ...parameter.completions].filter((item): item is string => Boolean(item)))
    )
  );
  return grm`invoke{tool:"${select(...toolChoices)}",command:"${select(...commandChoices)}",arg:"${select(...completionChoices)}"}`;
}

function serializeGrammar(grammar: GuidanceGrammarNode): unknown {
  return grammar.serialize();
}

function buildTemplate(tool: BashLikeToolDefinition, planned: PlannedInvocation, serializedGrammar: unknown): Record<string, unknown> {
  const grammarHash = contentHash(serializedGrammar, 8);
  const template: Record<string, unknown> = {
    toolId: tool.toolId,
    cmd: tool.command,
    c: compactCompletions(tool),
    argv: planned.invocation.argv.slice(1),
    g: grammarHash
  };
  if (planned.missingRequired.length > 0) {
    template.missing = planned.missingRequired;
  }
  return {
    template
  };
}

function compactCompletions(tool: BashLikeToolDefinition): string[] {
  return [
    ...new Set(
      tool.parameters.flatMap((parameter) => [parameter.flag, ...parameter.completions].filter((item): item is string => Boolean(item)))
    )
  ];
}

type PlannedInvocation = {
  invocation: BashLikeInvocation;
  missingRequired: string[];
};

function planInvocation(
  request: string,
  tool: BashLikeToolDefinition,
  learnedGrammars: Record<string, FieldGrammar | undefined>
): PlannedInvocation {
  const argv = [tool.command];
  const parameters: Record<string, string> = {};
  const missingRequired: string[] = [];

  for (const parameter of tool.parameters) {
    const raw = chooseCompletion(request, parameter);
    if (!raw) {
      if (parameter.required) missingRequired.push(parameter.name);
      continue;
    }
    const completion = normalizeWithFieldGrammar(raw, learnedGrammars[parameter.name]);

    parameters[parameter.name] = completion;
    if (parameter.kind === 'positional') {
      argv.push(completion);
    } else if (parameter.kind === 'flag') {
      if (parameter.flag && parameter.flag !== completion) argv.push(parameter.flag);
      argv.push(completion);
    } else {
      if (!parameter.flag) {
        if (parameter.required) missingRequired.push(parameter.name);
        continue;
      }
      argv.push(parameter.flag, completion);
    }
  }

  return {
    invocation: {
      toolId: tool.toolId,
      command: argv.join(' '),
      argv,
      parameters
    },
    missingRequired
  };
}

function selectTool(request: string, tools: BashLikeToolDefinition[]): BashLikeToolDefinition {
  return [...tools].sort((left, right) => scoreTool(request, right) - scoreTool(request, left))[0]!;
}

function scoreTool(request: string, tool: BashLikeToolDefinition): number {
  const haystack = normalizeText(request);
  const terms = [
    tool.toolId,
    tool.command,
    tool.description ?? '',
    ...tool.parameters.flatMap((parameter) => [parameter.name, parameter.description ?? '', parameter.flag ?? '', ...parameter.completions])
  ];
  return terms.reduce((score, term) => score + (termMatches(haystack, term) ? 1 : 0), 0);
}

function chooseCompletion(request: string, parameter: BashLikeParameter): string | undefined {
  const haystack = normalizeText(request);
  const direct = parameter.completions.find((completion) => termMatches(haystack, completion));
  if (direct) return direct;
  if (parameter.flag && termMatches(haystack, parameter.flag)) return parameter.completions[0] ?? parameter.flag;
  if (parameter.description && termMatches(haystack, parameter.description)) return parameter.completions[0] ?? parameter.flag;
  if (parameter.completions.length === 1 && parameter.required) return parameter.completions[0];
  return undefined;
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

function nonEmptyChoices(values: string[]): [string, ...string[]] {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 0 ? [''] : (unique as [string, ...string[]]);
}
