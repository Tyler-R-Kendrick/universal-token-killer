import { resolveRegisteredTool } from '@utk/config';
import type {
  StructuredToolDefinition,
  StructuredToolInvocation,
  StructuredToolParameter
} from './structuredToolTypes.js';

export type PlannedInvocation = {
  invocation: StructuredToolInvocation;
  missingRequired: string[];
};

export function planInvocation(request: string, tool: StructuredToolDefinition): PlannedInvocation {
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

  applyCurriedDefaults(tool, args, missingRequired);

  return {
    invocation: {
      toolId: tool.toolId,
      args
    },
    missingRequired
  };
}

export function selectTool(request: string, tools: StructuredToolDefinition[]): StructuredToolDefinition {
  return [...tools].sort((left, right) => scoreTool(request, right) - scoreTool(request, left))[0]!;
}

export function withConfigDefaults(
  tool: StructuredToolDefinition,
  configTool: ReturnType<typeof resolveRegisteredTool>
): StructuredToolDefinition {
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

function applyCurriedDefaults(tool: StructuredToolDefinition, args: Record<string, string>, missingRequired: string[]): void {
  if (!tool.curryFields) return;
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
