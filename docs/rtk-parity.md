# RTK Parity

RTK is no longer tracked by a separate parity metric layer. The old
fixture-backed RTK parity tests, benchmark scripts, and metric modules were
removed and folded into the single comparison harness in `@utk/evals`.

RTK now runs as **one competitor arm** in that harness. Every benchmark case is
scored across three concurrent arms over the same data — baseline (raw tool
output), competitor (RTK), and UTK (mediated compaction) — so RTK token savings
and fact retention are measured the same way as every other technique. Run it
with `npm run evals --workspace @utk/evals`.

## Where It Lives Now

- [Evals](evals.md) — how the comparison harness works and how to run it.
- `packages/evals/comparison/rtk.ts` — the RTK competitor arm configuration.
- [Internal RTK benchmark results](internal/rtk-benchmark-results.md) — the
  latest generated baseline vs RTK vs UTK numbers.
