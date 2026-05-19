import type { Evaluator, EvaluatorInput, EvaluatorOutput } from './types.js';
import type { JaegerTraceLike } from './noParseFailures.js';

const DEFAULT_SOFT_CODES = ['cache.write', 'guidance.unavailable', 'detok.unavailable', 'router.fallback'];

export const noSoftFailures: Evaluator = {
  metricName: 'no_soft_failures',
  description: 'Returns 1.0 when the linked trace has none of the configured soft-failure codes.',
  rubric: [
    'No span carries a configured soft-failure code (cache.write, guidance.unavailable, detok.unavailable, router.fallback by default) — in span tags OR in log fields.',
    'Configurable allowlist via config.allow (exact codes that are permitted).'
  ],
  async evaluate(input: EvaluatorInput): Promise<EvaluatorOutput> {
    const trace = input.config.trace as JaegerTraceLike | undefined;
    const allow = new Set(Array.isArray(input.config.allow) ? (input.config.allow as string[]) : []);
    if (!trace) {
      return {
        score: 1,
        status: 'PASSED',
        per_invocation_scores: input.invocations.map(() => 1),
        details: { reason: 'no trace attached; rubric vacuously passes' }
      };
    }
    const codes = scanCodes(trace, allow);
    const score = codes.length === 0 ? 1 : 0;
    const passed = score >= input.threshold;
    return {
      score,
      status: passed ? 'PASSED' : 'FAILED',
      per_invocation_scores: input.invocations.map(() => score),
      details: {
        reason: passed ? 'no soft-failure codes observed' : 'soft-failure codes observed',
        offending: codes
      }
    };
  }
};

function scanCodes(trace: JaegerTraceLike, allow: Set<string>): string[] {
  const out = new Set<string>();
  for (const trace_data of trace.data) {
    for (const span of trace_data.spans) {
      collectFromKeyValues(span.tags, allow, out);
      for (const log of span.logs) {
        collectFromKeyValues(log.fields, allow, out);
      }
    }
  }
  return [...out];
}

function collectFromKeyValues(entries: Array<{ key: string; value: unknown }>, allow: Set<string>, out: Set<string>): void {
  for (const entry of entries) {
    if (entry.key !== 'utk.failure.code') continue;
    const code = typeof entry.value === 'string' ? entry.value : '';
    if (!DEFAULT_SOFT_CODES.includes(code)) continue;
    if (allow.has(code)) continue;
    out.add(code);
  }
}

