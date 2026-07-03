import { grm, nonEmptyChoices, select } from '@utk/constrained-decoder';
import type { StructuredGuidanceGrammarNode, StructuredToolDefinition } from './structuredToolTypes.js';

export function buildStructuredInvocationGrammar(tools: StructuredToolDefinition[]): StructuredGuidanceGrammarNode {
  const toolChoices = nonEmptyChoices(tools.map((tool) => tool.toolId));
  const completionChoices = nonEmptyChoices(
    tools.flatMap((tool) => tool.parameters.flatMap((parameter) => parameter.completions ?? []))
  );
  return grm`invoke{tool:"${select(...toolChoices)}",value:"${select(...completionChoices)}"}`;
}
