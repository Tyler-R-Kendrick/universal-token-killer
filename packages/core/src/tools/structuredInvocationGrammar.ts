import { grm, select } from 'guidance-ts';
import type { StructuredGuidanceGrammarNode, StructuredToolDefinition } from './structuredToolTypes.js';

export function buildStructuredInvocationGrammar(tools: StructuredToolDefinition[]): StructuredGuidanceGrammarNode {
  const toolChoices = nonEmptyChoices(tools.map((tool) => tool.toolId));
  const completionChoices = nonEmptyChoices(
    tools.flatMap((tool) => tool.parameters.flatMap((parameter) => parameter.completions ?? []))
  );
  return grm`invoke{tool:"${select(...toolChoices)}",value:"${select(...completionChoices)}"}`;
}

function nonEmptyChoices(values: string[]): [string, ...string[]] {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 0 ? [''] : (unique as [string, ...string[]]);
}
