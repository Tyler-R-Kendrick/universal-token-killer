# Reference: Evaluator Config Keys

Every evaluator follows the agentevals.io stdin/stdout JSON protocol (see [agentevals-spec.md](agentevals-spec.md)). The `config` field is per-evaluator; this page documents the keys each built-in evaluator looks for.

## `tool_trajectory_avg_score`

Compares observed `intermediate_data.tool_uses` against an expected sequence. Per-invocation score = fraction of expected calls that appear, in order, with matching args.

```ts
config: {
  expected: {
    // keyed by invocation_id
    'inv-1': [
      { name: 'git.status', args: { subcommand: 'status' } },
      { name: 'git.diff' }   // omit args to require no specific args
    ]
  }
}
```

- Argument matching is **subset**: every key in `args` must equal the observed value; observed args may contain additional keys.
- Order is checked with a moving cursor — once an expected call matches at position N, the next expected call can only match at position > N.
- An empty `expected[invocation_id]` (or missing entry) scores 1 for that invocation (vacuously true).
- Malformed `config.expected` (non-object) is treated as no expectations.

## `response_match_score`

Per-invocation score = fraction of expected substrings + regex patterns present in `final_response.parts[*].text`.

```ts
config: {
  expected_substrings: { 'inv-1': ['OK', 'done'] }, // or a flat string[] applied to every invocation
  expected_patterns:   { 'inv-1': ['status:\\s+OK'] } // standard JS RegExp source
}
```

- Substrings use plain `String.includes`. Patterns construct a fresh `RegExp` with no flags.
- A flat `string[]` is treated as "apply to every invocation".
- Empty expectations score 1.
- Non-string entries in arrays are skipped silently.

## `no_parse_failures`

Boolean rubric on the linked Jaeger trace.

```ts
config: {
  trace: <JaegerTraceLike>,
  allow: ['pack/', 'template/', 'router/']  // prefixes that count as parse failures
}
```

- Default `allow` list: `['pack/', 'template/', 'router/']`. Any `utk.failure.code` whose value starts with one of these prefixes counts as a failure.
- Scans both span tags and log fields.
- Missing `trace` ⇒ vacuously PASSES (score 1).
- `details.offending` lists the matching codes.

## `no_soft_failures`

Boolean rubric on the linked Jaeger trace; targets the four soft-failure codes shipped by core.

```ts
config: {
  trace: <JaegerTraceLike>,
  allow: ['cache.write']  // codes that are permitted (allowlist, exact match)
}
```

- Default code set: `cache.write`, `guidance.unavailable`, `detok.unavailable`, `router.fallback`.
- `allow` is an exact-match allowlist — any allowed code is filtered out before the score is computed.
- Missing `trace` ⇒ vacuously PASSES (score 1).

## Wiring Multiple Evaluators

```ts
import { ALL_EVALUATORS, loadUtkTrace } from '@utk/evals';

const { invocations, trace } = await loadUtkTrace(workspaceRoot, runId);
const scoresPerMetric: Record<string, number> = {};
for (const evaluator of ALL_EVALUATORS) {
  const out = await evaluator.evaluate({
    protocol_version: '1.0',
    metric_name: evaluator.metricName,
    threshold: 1,
    config: { trace, expected: expectedToolCalls, expected_substrings: expectedText },
    invocations
  });
  scoresPerMetric[evaluator.metricName] = out.score;
}
```

UTK does not enforce a global threshold — each evaluator owns its own pass/fail decision via its `threshold` input. Tests typically pass `threshold: 1` and rely on `diffScorecards` (see [baseline-store.md](baseline-store.md)) to detect regressions.
