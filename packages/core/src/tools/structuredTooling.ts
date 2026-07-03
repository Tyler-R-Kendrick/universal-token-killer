import { mkdir, writeFile } from 'node:fs/promises';
import { canonicalJson, contentHash } from '@utk/foundation';
import { normalizeToolId } from '@utk/foundation';
import { loadUtkConfig, resolveRegisteredTool, resolveSerializerProviderId } from '@utk/config';
import { getSerializationProvider, serializedExtension } from '../serialization/providers.js';
import { safeJoin } from '@utk/foundation';
import { recordFailure, type RunContext } from '@utk/tracing';
import { buildStructuredInvocationGrammar } from './structuredInvocationGrammar.js';
import { planInvocation, selectTool, withConfigDefaults, type PlannedInvocation } from './structuredInvocationPlanner.js';
import { curryTool, memoizeTool } from './toolMemoization.js';
import type { StructuredToolDefinition, StructuredToolInvocationResult } from './structuredToolTypes.js';

export {
  buildStructuredInvocationGrammar
} from './structuredInvocationGrammar.js';
export {
  curryTool,
  memoizeTool
} from './toolMemoization.js';
export type {
  AsyncTool,
  MemoizedToolResult
} from './toolMemoization.js';
export type {
  StructuredGuidanceGrammarNode,
  StructuredToolDefinition,
  StructuredToolInvocation,
  StructuredToolInvocationResult,
  StructuredToolParameter
} from './structuredToolTypes.js';

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
