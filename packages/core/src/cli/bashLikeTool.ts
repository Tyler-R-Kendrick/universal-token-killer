import { mkdir, writeFile } from 'node:fs/promises';
import { canonicalJson, contentHash } from '@utk/foundation';
import { normalizeToolId } from '@utk/foundation';
import { loadUtkConfig, resolveSerializerProviderId } from '../config/config.js';
import { loadSerializationRegistry, serializedExtension } from '../serialization/providers.js';
import { safeJoin } from '@utk/foundation';
import { buildBashLikeInvocationGrammar } from './bashLikeInvocationGrammar.js';
import { planBashLikeInvocation, selectBashLikeTool, type PlannedBashLikeInvocation } from './bashLikeInvocationPlanner.js';
import type { BashLikeInvocationResult, BashLikeToolDefinition } from './bashLikeToolTypes.js';

export { buildBashLikeInvocationGrammar } from './bashLikeInvocationGrammar.js';
export type {
  BashLikeInvocation,
  BashLikeInvocationResult,
  BashLikeParameter,
  BashLikeToolDefinition,
  GuidanceGrammarNode
} from './bashLikeToolTypes.js';

export async function completeBashLikeToolInvocation(params: {
  workspaceRoot: string;
  request: string;
  tools: BashLikeToolDefinition[];
}): Promise<BashLikeInvocationResult> {
  if (params.tools.length === 0) {
    throw new Error('At least one tool definition is required');
  }

  const config = await loadUtkConfig(params.workspaceRoot);
  const registry = await loadSerializationRegistry(params.workspaceRoot);
  const selectedTool = selectBashLikeTool(params.request, params.tools);
  const normalizedToolId = normalizeToolId(selectedTool.toolId);
  const serializerId = resolveSerializerProviderId(config, normalizedToolId, registry);
  const serializer = registry.require(serializerId);
  const grammar = buildBashLikeInvocationGrammar(params.tools);
  const serializedGrammar = grammar.serialize();
  const planned = planBashLikeInvocation(params.request, selectedTool);
  const template = buildTemplate(selectedTool, planned, serializedGrammar);
  const serializedTemplate = serializer.serialize(template, { toolId: normalizedToolId });
  const templateDir = safeJoin(params.workspaceRoot, config.persistence.storage_root, 'tools', normalizedToolId, 'templates');
  await mkdir(templateDir, { recursive: true });
  const templatePath = safeJoin(templateDir, `cli-template.compact.${serializedExtension(serializerId, registry)}`);
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

function buildTemplate(tool: BashLikeToolDefinition, planned: PlannedBashLikeInvocation, serializedGrammar: unknown): Record<string, unknown> {
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
