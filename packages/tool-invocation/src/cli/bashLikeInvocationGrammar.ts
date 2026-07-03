import { grm, nonEmptyChoices, select } from '@utk/constrained-decoder';
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
