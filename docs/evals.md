# Evals

The `@utk/evals` package contains deterministic tests for safety, compactness, and RTK parity.

## What Is Tested

- no raw payload leakage in model-visible responses;
- compact response length and token budgets;
- allowed structural rule kinds;
- official TOON route parsing;
- fixture-backed RTK parity metrics;
- strict CLI wins over RTK baselines;
- generalized non-shell tool-output savings.
- bash-like invocation accuracy and token savings against RTK-style rewrite baselines.

## Fixture Source

RTK parity fixtures live in `packages/evals/fixtures/rtkParityFixtures.ts`. Each fixture declares:

- `name`
- `toolId`
- `input`
- `rawOutput`
- `requiredFacts`
- RTK support and baseline token data

## Metric Source

Metric helpers live in `packages/evals/metrics/rtkParityMetrics.ts` and are exported from `@utk/evals`.

Use those helpers for both tests and optional benchmark tooling so the numbers stay consistent.

Bash rewrite helpers live in `packages/evals/metrics/bashRewriteMetrics.ts` and use fixtures from `packages/evals/fixtures/bashRewriteFixtures.ts`.

## AgentEvals-Driven TDD

The package also implements the [agentevals.io](https://agentevals.io) evaluator JSON protocol natively (no Python dependency required). Built-in evaluators:

- `tool_trajectory_avg_score` — observed tool calls match the expected sequence and args.
- `response_match_score` — expected substrings / regex patterns appear in the model response.
- `no_parse_failures` — no `pack/*` / `template/*` / `router/*` failure codes in the linked Jaeger trace.
- `no_soft_failures` — no `cache.write` / `guidance.unavailable` / `detok.unavailable` / `router.fallback`.

These evaluators consume the Jaeger + EvalSet artifacts emitted by UTK tracing (see [Tracing](tracing.md)) and drive a baseline-gated TDD loop. Walkthrough: [Evals-Driven Iteration](evals-driven-iteration.md).

Detail references:

- [refs/agentevals-spec.md](refs/agentevals-spec.md) — Jaeger / EvalSet / evaluator / scorecard wire shapes.
- [refs/evaluator-config.md](refs/evaluator-config.md) — `config` keys per evaluator.
- [refs/baseline-store.md](refs/baseline-store.md) — `readBaseline` / `writeBaseline` / `diffScorecards` semantics.
- [refs/tracing-failure-codes.md](refs/tracing-failure-codes.md) — failure-code vocabulary the trace-aware evaluators look for.

## Running Evals

```bash
npm test --workspace @utk/evals
npm test --workspace @utk/evals -- --run evals/rtk-parity-metrics.test.ts
```

The root coverage gate includes eval assertions and scripts:

```bash
npm run coverage
```

## Focused Commands

Run only RTK parity metrics:

```bash
npm test --workspace @utk/evals -- --run evals/rtk-parity-metrics.test.ts
```

Run bash-like tool rewrite metrics:

```bash
npm test --workspace @utk/evals -- --run evals/bash-rewrite-metrics.test.ts
```

Run the optional benchmark helper tests:

```bash
npm test -- scripts/bench-rtk-baseline.test.ts
```

Run a live RTK comparison when a local RTK command is available:

```bash
UTK_RTK_COMMAND="rtk" npm test -- scripts/bench-rtk-baseline.test.ts
```
