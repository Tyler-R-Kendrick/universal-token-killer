import { containsForbiddenSpecialCase } from '../validation/leakage.js';

export type StructuralModelProvider = {
  completeStructural(prompt: StructuralPrompt): Promise<string>;
};

export type StructuralPrompt = {
  task: 'schema-refinement' | 'rule-generalization' | 'schema-routing';
  artifacts: Record<string, unknown>;
  maxOutputTokens: number;
};

export async function refineSchemaWithCopilot(provider: StructuralModelProvider, candidateSchema: Record<string, unknown>, rules: unknown[]): Promise<Record<string, unknown>> {
  ensureStructuralOnly(candidateSchema);
  ensureStructuralOnly(rules);
  const result = await provider.completeStructural({
    task: 'schema-refinement',
    artifacts: { candidateSchema, rules },
    maxOutputTokens: 700
  });
  const parsed = JSON.parse(result) as Record<string, unknown>;
  ensureStructuralOnly(parsed);
  return parsed;
}

export async function routeWithCopilot(provider: StructuralModelProvider, routeMetadata: Record<string, unknown>): Promise<string> {
  ensureStructuralOnly(routeMetadata);
  return provider.completeStructural({ task: 'schema-routing', artifacts: routeMetadata, maxOutputTokens: 32 });
}

function ensureStructuralOnly(value: unknown): void {
  const text = JSON.stringify(value);
  if (text.length > 20_000) {
    throw new Error('Structural artifact too large for model prompt');
  }
  if (containsForbiddenSpecialCase(text)) {
    throw new Error('Forbidden special-case content in structural model prompt');
  }
}
