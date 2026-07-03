# Benchmark Summary

Aggregate view of the tool-output compaction benchmark: the same benchmark data run through the same
harness against each competitor, with three concurrent arms (baseline, competitor, UTK).

> Self-authored deterministic self-comparison: competitor arms are configured models of each technique run against the same benchmark data, not the vendors' live systems. Token counts use a coarse `ceil(len/4)` estimate. Quality is scored by the reference judge (fact retention + noise exclusion); swap in a model judge via the harness `configureModel` hook for semantic grading.

## Current Results

| Competitor | Cases | Baseline tok | Competitor tok | UTK tok | UTK vs competitor | UTK facts | Report |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| RTK (rust-token-killer) | 12 | 1297 | 1123 | 324 | 71% fewer | 12/12 | [report](rtk-benchmark-results.md) |
| Compresr (query-aware) | 12 | 1297 | 1122 | 324 | 71% fewer | 12/12 | [report](compresr-benchmark-results.md) |
| Caveman (terse register) | 12 | 1297 | 1083 | 324 | 70% fewer | 12/12 | [report](caveman-benchmark-results.md) |

## Interpretation

- **Baseline** reads the full tool output — maximum tokens, keeps every fact, keeps all the noise.
- **Competitor** arms compact into the chat context: they cut tokens but pay for what survives and can shed relevant facts.
- **UTK** persists the raw output off-context and surfaces a recoverable handle, so it keeps every fact at a fraction of the visible tokens.

## Related benchmarks

- LeanCTX Copilot context-runtime benchmark: [leanctx-copilot-benchmark-results.md](leanctx-copilot-benchmark-results.md).

## Update Rules

- Regenerate with `npm run evals --workspace @utk/evals`; it rewrites `results/*.json`, the suite YAML, and these docs together.
- Never hand-edit the numbers — they are derived from `packages/evals/data/*.jsonl`.
