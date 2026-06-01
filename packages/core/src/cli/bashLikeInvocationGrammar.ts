import { grm, select } from 'guidance-ts';
import type { BashLikeToolDefinition, GuidanceGrammarNode } from './bashLikeToolTypes.js';

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

function nonEmptyChoices(values: string[]): [string, ...string[]] {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 0 ? [''] : (unique as [string, ...string[]]);
}
