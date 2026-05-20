# Evals-Driven Iteration

UTK's tracing artifacts feed a TDD harness so prompt, template, schema, and grammar changes are gated by tool-usage evaluators against frozen baselines.

## The Loop

1. Run UTK against a fixture with `[tracing] enabled = true` (see [tracing.md](tracing.md)).
2. UTK writes `<run>.jaeger.json` + `<run>.eval_set.json` under `.utk/events/`.
3. Vitest reads those artifacts via `loadUtkTrace`, runs `ALL_EVALUATORS`, produces a Scorecard.
4. The Scorecard is diffed against `packages/evals/baselines/<eval-set-id>.json`.
5. Any per-metric regression past tolerance fails the test (CI gate).

```text
prompt/template/schema/grammar change
        │
        ▼
  mediated tool call            packages/core/src/mediation/toolMediator.ts
        │
        ▼
  Jaeger trace + EvalSet        packages/core/src/tracing/*
        │
        ▼
  Evaluators                    packages/evals/evaluators/*
        │
        ▼
  Scorecard vs baseline diff    packages/evals/baselines/baselineStore.ts
```

## Built-in Evaluators

| Metric | Rubric (one-line) |
| --- | --- |
| `tool_trajectory_avg_score` | Expected tool calls appear in order with matching args. |
| `response_match_score` | Expected substrings/regex patterns appear in `final_response`. |
| `no_parse_failures` | No `pack/*` / `template/*` / `router/*` codes in the trace. |
| `no_soft_failures` | No `cache.write` / `guidance.unavailable` / `detok.unavailable` / `router.fallback`. |

Detailed `config` keys per evaluator: [refs/evaluator-config.md](refs/evaluator-config.md).

## Minimal Test

```ts
import { ALL_EVALUATORS, diffScorecards, loadUtkTrace, readBaseline } from '@utk/evals';

const { invocations, trace } = await loadUtkTrace(workspaceRoot, runId);
const metrics: Record<string, number> = {};
for (const evaluator of ALL_EVALUATORS) {
  const out = await evaluator.evaluate({
    protocol_version: '1.0',
    metric_name: evaluator.metricName,
    threshold: 1,
    config: { trace, expected, expected_substrings },
    invocations
  });
  metrics[evaluator.metricName] = out.score;
}
const baseline = await readBaseline(workspaceRoot, 'my-eval-set');
const diff = diffScorecards(baseline, { eval_set_id: 'my-eval-set', results: [{ eval_id: 'r', overall_score: avg(metrics), metrics, status: 'PASSED' }] });
expect(diff.ok).toBe(true);
```

The end-to-end regression demo (`packages/evals/evals/agentevals-harness.test.ts → 'regression-demo end-to-end'`) shows a baseline pass and a mutated-trajectory regression with the expected diff.

## Updating Baselines

Baseline writes are gated by `UTK_BASELINE_UPDATE=1` (or `force: true`) so accidental writes from a normal test run are prevented:

```bash
UTK_BASELINE_UPDATE=1 npx vitest run packages/evals/evals/agentevals-harness.test.ts
```

Severity rules and tolerance behaviour: [refs/baseline-store.md](refs/baseline-store.md).

## Cross-Check With `agentevals-cli`

UTK does not depend on the Python CLI, but the artifacts are interoperable. A spawn bridge ships with `@utk/evals`:

```ts
import { runAgentEvalsCli } from '@utk/evals';

const result = await runAgentEvalsCli({
  tracePath: '.utk/events/<run>.jaeger.json',
  evalSetPath: '.utk/events/<run>.eval_set.json',
  metric: 'tool_trajectory_avg_score'
});
// result.available === false with reason 'binary-missing' when the CLI isn't installed.
```

Install the reference implementation locally for cross-checks:

```bash
pip install agentevals-cli
agentevals run .utk/events/<run>.jaeger.json --eval-set .utk/events/<run>.eval_set.json -m tool_trajectory_avg_score
```

## See Also

- [Tracing](tracing.md) — how the traces are emitted.
- [refs/agentevals-spec.md](refs/agentevals-spec.md) — exact wire shapes.
- [refs/evaluator-config.md](refs/evaluator-config.md) — evaluator config keys.
- [refs/baseline-store.md](refs/baseline-store.md) — baseline read/write/diff semantics.
- [Evals](evals.md) — the broader `@utk/evals` package (RTK parity, bash rewrite, etc).
