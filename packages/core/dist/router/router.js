import { contentHash } from '../artifact/canonical.js';
export function deterministicRoute(schemaIds, inputHash) {
    const preferred = schemaIds.find((id) => id.includes(inputHash.slice(0, 8))) ?? schemaIds[0] ?? 'unknown';
    if (preferred === 'unknown') {
        return { schema: 'unknown', confidence: 0, reason: 'unknown' };
    }
    return {
        schema: preferred,
        confidence: preferred.includes(inputHash.slice(0, 8)) ? 1 : 0.95,
        reason: preferred.includes(inputHash.slice(0, 8)) ? 'input_match' : 'tool_match'
    };
}
export function routeFromCandidates(toolId, input, shape, candidates) {
    const inputFingerprint = contentHash(input, 8);
    const shapeFingerprint = contentHash(shape, 8);
    const exactInput = candidates.find((candidate) => candidate.toolId === toolId && candidate.inputFingerprint === inputFingerprint);
    if (exactInput)
        return { schema: exactInput.schema, confidence: 1, reason: 'input_match' };
    const exactShape = candidates.find((candidate) => candidate.toolId === toolId && candidate.shapeFingerprint === shapeFingerprint);
    if (exactShape)
        return { schema: exactShape.schema, confidence: 0.98, reason: 'shape_match' };
    const sameTool = candidates.find((candidate) => candidate.toolId === toolId);
    if (sameTool)
        return { schema: sameTool.schema, confidence: 0.95, reason: 'tool_match' };
    const prior = [...candidates].sort((a, b) => (b.priorCount ?? 0) - (a.priorCount ?? 0))[0];
    return prior ? { schema: prior.schema, confidence: 0.5, reason: 'prior_match' } : { schema: 'unknown', confidence: 0, reason: 'unknown' };
}
export function buildRouterPrompt(toolId, inputKeys, shapeFingerprint, fieldFingerprint, candidates, maxCandidates = 8) {
    const capped = candidates.slice(0, maxCandidates);
    const routes = capped.map((candidate) => `${candidate.schema}|${candidate.toolId}|${candidate.shapeFingerprint ?? ''}|${candidate.fieldFingerprint ?? ''}`).join('\n');
    const prompt = [
        'Select best schema for this tool result.',
        `tool: ${toolId}`,
        `input_keys: ${inputKeys.sort().join(',')}`,
        `shape: ${shapeFingerprint}`,
        `fields: ${fieldFingerprint}`,
        'routes:',
        routes,
        'Return route only.'
    ].join('\n');
    return { prompt, promptTokens: estimateTokens(prompt), candidates: capped };
}
export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
