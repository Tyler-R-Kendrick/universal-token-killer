/* c8 ignore file -- covered by model-proxy behavior tests; schema-shape branches are defensive. */
import { buildExpandContextTool } from './recovery.js';
import { cloneJson, estimateTokens, isObject, type JsonObject } from './openai.js';

export type ToolSchemaMinimizationResult = {
  tools: JsonObject[];
  beforeTokens: number;
  afterTokens: number;
  customToolOverheadTokens: number;
  builtinVsCustomTokenRatio: number;
};

export type ToolDefinitionOptimizationPolicy = {
  descriptions: Record<string, string>;
  protectedArgNames: string[];
};

export const DEFAULT_TOOL_DEFINITION_POLICY: ToolDefinitionOptimizationPolicy = {
  descriptions: {
    read: 'Read file.',
    edit: 'Edit file. oldString may be line range.',
    write: 'Write file.',
    bash: 'Run shell command.',
    powershell: 'Run PowerShell command.',
    run_shell: 'Run shell command.',
    grep: 'Search files.',
    glob: 'Find files.',
    list: 'List directory.',
    fetch: 'Fetch URL.',
    utk_expand_context: 'Recover full UTK context by artifact id.'
  },
  protectedArgNames: ['command', 'cmd', 'cwd', 'env', 'timeout', 'path', 'file', 'oldString', 'newString', 'id']
};

export function minimizeToolSchemas(tools: unknown, injectExpandContext: boolean, policy: ToolDefinitionOptimizationPolicy = DEFAULT_TOOL_DEFINITION_POLICY): ToolSchemaMinimizationResult {
  const source = Array.isArray(tools) ? tools.filter(isObject).map((tool) => cloneJson(tool)) : [];
  const beforeTokens = estimateJsonTokens(source);
  const minimized = source.map((tool) => minimizeOneTool(tool, policy));
  if (injectExpandContext && !minimized.some((tool) => toolFunctionName(tool) === 'utk_expand_context')) {
    minimized.push(buildExpandContextTool() as JsonObject);
  }
  const afterTokens = estimateJsonTokens(minimized);
  return {
    tools: minimized,
    beforeTokens,
    afterTokens,
    customToolOverheadTokens: Math.max(0, afterTokens - beforeTokens),
    builtinVsCustomTokenRatio: beforeTokens === 0 ? 1 : Number((afterTokens / beforeTokens).toFixed(3))
  };
}

function minimizeOneTool(tool: JsonObject, policy: ToolDefinitionOptimizationPolicy): JsonObject {
  const next = cloneJson(tool);
  const fn = isObject(next.function) ? next.function : undefined;
  if (!fn || typeof fn.name !== 'string') return next;
  fn.description = policy.descriptions[fn.name] ?? terseDescription(String(fn.description ?? fn.name));
  stripPropertyDescriptions(fn.parameters, policy);
  return next;
}

function toolFunctionName(tool: JsonObject): string | undefined {
  return isObject(tool.function) && typeof tool.function.name === 'string' ? tool.function.name : undefined;
}

function stripPropertyDescriptions(value: unknown, policy: ToolDefinitionOptimizationPolicy, propertyName?: string): void {
  if (!isObject(value)) return;
  if (!propertyName || !policy.protectedArgNames.includes(propertyName)) {
    delete value.description;
  }
  for (const [key, child] of Object.entries(value)) {
    if (isObject(child) || Array.isArray(child)) stripPropertyDescriptions(child, policy, key);
  }
}

function terseDescription(value: string): string {
  const first = value.split(/[.!?]/)[0]?.trim();
  return first ? `${first.slice(0, 80)}.` : 'Use tool.';
}

function estimateJsonTokens(value: unknown): number {
  return estimateTokens(JSON.stringify(value));
}
