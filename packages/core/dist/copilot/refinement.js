import { containsForbiddenSpecialCase } from '../validation/leakage.js';
export async function refineSchemaWithCopilot(provider, candidateSchema, rules) {
    ensureStructuralOnly(candidateSchema);
    ensureStructuralOnly(rules);
    const result = await provider.completeStructural({
        task: 'schema-refinement',
        artifacts: { candidateSchema, rules },
        maxOutputTokens: 700
    });
    const parsed = JSON.parse(result);
    ensureStructuralOnly(parsed);
    return parsed;
}
export async function routeWithCopilot(provider, routeMetadata) {
    ensureStructuralOnly(routeMetadata);
    return provider.completeStructural({ task: 'schema-routing', artifacts: routeMetadata, maxOutputTokens: 32 });
}
function ensureStructuralOnly(value) {
    const text = JSON.stringify(value);
    if (text.length > 20_000) {
        throw new Error('Structural artifact too large for model prompt');
    }
    if (containsForbiddenSpecialCase(text)) {
        throw new Error('Forbidden special-case content in structural model prompt');
    }
}
