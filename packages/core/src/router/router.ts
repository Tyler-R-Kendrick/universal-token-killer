export type RouteReason = 'shape_match' | 'input_match' | 'tool_match' | 'prior_match' | 'fallback' | 'unknown';

export type RouteDecision = {
  schema: string;
  confidence: number;
  reason: RouteReason;
};

export function deterministicRoute(schemaIds: string[], inputHash: string): RouteDecision {
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
