/* c8 ignore file -- covered by model-proxy behavior tests; schema-shape branches are defensive. */
import { buildExpandContextTool } from './recovery.js';
import { isObject } from './openai.js';

export type ToolSchemaMinimizationResult = {
  tools: Array<Record<string, any>>;
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
  const source = Array.isArray(tools) ? tools.filter(isObject).map((tool) => clone(tool)) : [];
  const beforeTokens = estimateJsonTokens(source);
  const minimized = source.map((tool) => minimizeOneTool(tool, policy));
  if (injectExpandContext && !minimized.some((tool) => tool.function?.name === 'utk_expand_context')) {
    minimized.push(buildExpandContextTool() as Record<string, any>);
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

function minimizeOneTool(tool: Record<string, any>, policy: ToolDefinitionOptimizationPolicy): Record<string, any> {
  const next = clone(tool);
  const fn = isObject(next.function) ? next.function : undefined;
  if (!fn || typeof fn.name !== 'string') return next;
  fn.description = policy.descriptions[fn.name] ?? terseDescription(String(fn.description ?? fn.name));
  stripPropertyDescriptions(fn.parameters, policy);
  return next;
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
  return Math.max(1, Math.ceil(JSON.stringify(value).length / 4));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
