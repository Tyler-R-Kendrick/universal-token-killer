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

Run the optional benchmark helper tests:

```bash
npm test -- scripts/bench-rtk-baseline.test.ts
```

Run a live RTK comparison when a local RTK command is available:

```bash
UTK_RTK_COMMAND="rtk" npm test -- scripts/bench-rtk-baseline.test.ts
```
