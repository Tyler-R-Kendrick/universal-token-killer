# Evals

## Subcategories

* [References](/features/evals/references/) - Canonical wire shapes UTK emits and consumes, sourced from github.com/agentevals-dev/agentevals (Apache 2.0, Solo.io governance).

## Documents

* [Benchmark Summary](/features/evals/benchmark-summary.md) - Aggregate view of fixture-backed benchmark comparisons in this repository.
* [Evals-Driven Iteration](/features/evals/evals-driven-iteration.md) - UTK's tracing artifacts feed a TDD harness so prompt, template, schema, and grammar changes are gated by tool-usage evaluators against frozen baselines.
* [Evals](/features/evals/evals.md) - The @utk/evals package contains deterministic tests for safety, compactness, and RTK parity.
* [RTK Parity Benchmark Results](/features/evals/rtk-parity-benchmark.md) - Fixture-backed results comparing UTK tool-output mediation against RTK parity baselines.
* [RTK Parity](/features/evals/rtk-parity.md) - UTK tracks RTK parity with fixture-backed tests and optional live RTK benchmarking.
* [Tool-Calling Bypass Eval Scenarios](/features/evals/tool-calling-bypass-scenarios.md) - Fixture-backed eval scenarios that verify UTK safely bypasses tool calls without losing recoverable facts.
* [Tracing](/features/evals/tracing.md) - UTK emits per-run traces in the agentevals.io open standard so failures, parse errors, and soft fail-open paths can be evaluated as tool-usage rubrics.
