import { Generation, Session, gen, grm, select, str } from 'guidance-ts';
import type { GrammarNode } from 'guidance-ts';

/**
 * Materialized re-exports of the `guidance-ts` primitives. `@utk/grammar-dsl` is
 * the single guidance facade in the workspace — the only package that touches the
 * ambient `guidance-ts` module (and the only home of `declare module 'guidance-ts'`).
 * Dependents (the tool-invocation and session-agent grammar builders, and the
 * `@utk/constrained-decoder` runtime) import these from here.
 */
export { Generation, Session, gen, grm, select, str };
export type { GrammarNode };

/**
 * Deduplicated, non-empty choice list for a guidance `select(...)` slot.
 *
 * Returns the unique, truthy values, or `[fallback]` when nothing remains.
 * Consolidates the three byte-for-byte-ish copies that previously lived in
 * core's structured-invocation, bash-like-invocation, and session-agent
 * grammar builders. The default `fallback` of `''` reproduces the structured /
 * bash-like behavior; callers that need a semantic placeholder (e.g. the
 * session-agent lexicon) pass their own.
 */
export function nonEmptyChoices(values: string[], fallback = ''): [string, ...string[]] {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 0 ? [fallback] : (unique as [string, ...string[]]);
}
