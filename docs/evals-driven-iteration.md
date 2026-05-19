# Evals-Driven Iteration

UTK's tracing emits artifacts in the [agentevals.io](https://agentevals.io) open standard so prompt, template, schema, and grammar changes are gated by tool-usage evaluators using TDD baselines.

## The Loop

1. Run UTK against a fixture with `[tracing] enabled = true`.
2. UTK writes `<run-id>.jaeger.json` + `<run-id>.eval_set.json` under `.utk/events/`.
3. Vitest reads those artifacts via `loadUtkTrace`, runs `ALL_EVALUATORS`, and produces a Scorecard.
4. The Scorecard is diffed against `packages/evals/baselines/<eval-set-id>.json`.
5. Any per-metric regression beyond tolerance fails the test (CI gate).

```
prompt/template/schema/grammar change
        │
        ▼
  mediated tool call            ← packages/core/src/mediation/toolMediator.ts
        │
        ▼
  Jaeger trace + EvalSet        ← packages/core/src/tracing/*
        │
        ▼
  Evaluators                    ← packages/evals/evaluators/*
        │
        ▼
  Scorecard vs baseline diff    ← packages/evals/baselines/baselineStore.ts
```

## Built-in Evaluators

| Metric | Source | Rubric |
| --- | --- | --- |
| `tool_trajectory_avg_score` | `evaluators/toolTrajectoryAvgScore.ts` | Expected tool calls appear in the right order with matching args. |
| `response_match_score` | `evaluators/responseMatchScore.ts` | Expected substrings/regex patterns appear in `final_response`. |
| `no_parse_failures` | `evaluators/noParseFailures.ts` | No `pack/*` / `template/*` / `router/*` `utk.failure.code` in the trace. |
| `no_soft_failures` | `evaluators/noSoftFailures.ts` | No `cache.write` / `guidance.unavailable` / `detok.unavailable` / `router.fallback`. |

Each evaluator follows the agentevals.io stdin/stdout JSON shape:

```ts
type EvaluatorInput = {
  protocol_version: '1.0';
  metric_name: string;
  threshold: number;
  config: Record<string, unknown>;
  invocations: Invocation[];
};
type EvaluatorOutput = {
  score: number;
  status: 'PASSED' | 'FAILED';
  per_invocation_scores: number[];
  details: { reason: string; [k: string]: unknown };
};
```

## Baselines

```ts
import { diffScorecards, readBaseline, writeBaseline } from '@utk/evals';

const baseline = await readBaseline(workspaceRoot, 'shell-git-status');
const diff = diffScorecards(baseline, currentScorecard, /* tolerance */ 0.01);
if (!diff.ok) {
  console.error(diff.changes.filter((c) => c.severity === 'regression'));
}
```

Updating baselines is gated by `UTK_BASELINE_UPDATE=1` or `{ force: true }` so accidental writes from a regular test run are prevented:

```bash
UTK_BASELINE_UPDATE=1 npx vitest run packages/evals/evals/agentevals-harness.test.ts
```

## Compatibility With `agentevals-cli`

The `<run-id>.jaeger.json` + `<run-id>.eval_set.json` artifacts can be fed directly to the Python reference implementation:

```bash
pip install agentevals-cli
agentevals run .utk/events/<run-id>.jaeger.json \
              --eval-set .utk/events/<run-id>.eval_set.json \
              -m tool_trajectory_avg_score
```

The native TS evaluators in `@utk/evals` keep CI hermetic; the Python CLI is for cross-checking and for running against external golden datasets.
