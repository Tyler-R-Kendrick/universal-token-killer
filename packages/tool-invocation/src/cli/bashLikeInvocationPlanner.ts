import type { BashLikeInvocation, BashLikeParameter, BashLikeToolDefinition } from './bashLikeToolTypes.js';

export type PlannedBashLikeInvocation = {
  invocation: BashLikeInvocation;
  missingRequired: string[];
};

export function planBashLikeInvocation(request: string, tool: BashLikeToolDefinition): PlannedBashLikeInvocation {
  const argv = [tool.command];
  const parameters: Record<string, string> = {};
  const missingRequired: string[] = [];

  for (const parameter of tool.parameters) {
    const completion = chooseCompletion(request, parameter);
    if (!completion) {
      if (parameter.required) missingRequired.push(parameter.name);
      continue;
    }
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

export function selectBashLikeTool(request: string, tools: BashLikeToolDefinition[]): BashLikeToolDefinition {
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
