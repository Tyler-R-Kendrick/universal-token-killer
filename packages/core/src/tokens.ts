/**
 * Canonical token estimate shared across UTK packages.
 *
 * Deliberately a coarse `ceil(len / 4)` heuristic (kept in one place so every
 * serializer, router, and benchmark reports the same estimate). Guarded to a
 * minimum of one token so empty spans never read as free.
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
