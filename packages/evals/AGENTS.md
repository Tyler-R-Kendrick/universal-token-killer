# Evals Agent Instructions

When benchmark performance changes, update docs in same change.

## Benchmark Documentation

- Keep standalone benchmark reports under `docs/internal/*-benchmark-results.md`.
- Keep LeanCTX Copilot run performance in `docs/internal/leanctx-copilot-benchmark-results.md`.
- Keep aggregate comparison table in `docs/internal/benchmark-summary.md`.
- Do not bury benchmark metrics only in PR text, terminal output, or test logs.

## Required Metrics

For each benchmark report, document:

- scenario count or unique case count;
- run count or loop count when repeated;
- pass/fail count;
- baseline name and token count basis;
- UTK token count;
- baseline token count;
- token delta and ratio;
- quality gates, including relevance, correctness, groundedness, fact retention, autoevals, recoverability, or edge gates as applicable;
- exact command used to generate or verify the numbers.

## LeanCTX Copilot

When rerunning LeanCTX Copilot benchmarks:

- run at least `npx vitest run scripts/bench-leanctx-copilot.test.ts --reporter=verbose`;
- when doing repeated improvement loops, record loop count, rounds per loop, total evaluated cases, per-surface totals, and minimum relevance/correctness/groundedness;
- update both `docs/internal/leanctx-copilot-benchmark-results.md` and `docs/internal/benchmark-summary.md`;
- keep detailed per-loop results in the LeanCTX-specific report, not the aggregate summary.

## Quality Rule

Token savings do not count if quality drops. A comparison is green only when UTK meets or beats the baseline on relevance, correctness, and groundedness or the benchmark-specific equivalent quality gates.
