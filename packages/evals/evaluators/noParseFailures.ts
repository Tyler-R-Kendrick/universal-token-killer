import type { Evaluator, EvaluatorInput, EvaluatorOutput } from './types.js';

export type JaegerTraceLike = {
  data: Array<{
    spans: Array<{
      logs: Array<{ fields: Array<{ key: string; value: unknown }> }>;
      tags: Array<{ key: string; value: unknown }>;
    }>;
  }>;
};

export const noParseFailures: Evaluator = {
  metricName: 'no_parse_failures',
  description: 'Returns 1.0 when the linked Jaeger trace contains no parse-class utk.failure.code entries.',
  rubric: [
    'No span carries a utk.failure.code starting with "pack/", "template/", or "router/".',
    'Configurable allowlist via config.allow (string prefixes).'
  ],
  async evaluate(input: EvaluatorInput): Promise<EvaluatorOutput> {
    const trace = input.config.trace as JaegerTraceLike | undefined;
    const allow = Array.isArray(input.config.allow)
      ? (input.config.allow as string[])
      : ['pack/', 'template/', 'router/'];
    if (!trace) {
      return {
        score: 1,
        status: 'PASSED',
        per_invocation_scores: input.invocations.map(() => 1),
        details: { reason: 'no trace was attached; rubric vacuously passes' }
      };
    }
    const offending = collectFailures(trace, allow);
    const score = offending.length === 0 ? 1 : 0;
    const passed = score >= input.threshold;
    return {
      score,
      status: passed ? 'PASSED' : 'FAILED',
      per_invocation_scores: input.invocations.map(() => score),
      details: {
        reason: passed ? 'no matching utk.failure.code entries' : 'matching utk.failure.code entries found',
        offending
      }
    };
  }
};

function collectFailures(trace: JaegerTraceLike, allow: string[]): string[] {
  const out = new Set<string>();
  for (const trace_data of trace.data) {
    for (const span of trace_data.spans) {
      collectFromTags(span.tags, allow, out);
      for (const log of span.logs) {
        collectFromTags(log.fields, allow, out);
      }
    }
  }
  return [...out];
}

function collectFromTags(tags: Array<{ key: string; value: unknown }>, allow: string[], out: Set<string>): void {
  for (const tag of tags) {
    if (tag.key !== 'utk.failure.code') continue;
    if (typeof tag.value !== 'string') continue;
    if (allow.some((prefix) => tag.value!.toString().startsWith(prefix))) {
      out.add(tag.value);
    }
  }
}
