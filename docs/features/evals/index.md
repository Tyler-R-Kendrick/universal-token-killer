# Evals

## Subcategories

* [References](/features/evals/references/) - Canonical wire shapes UTK emits and consumes, sourced from github.com/agentevals-dev/agentevals (Apache 2.0, Solo.io governance).

## Documents

* [UTK Comparison Benchmarks](/features/evals/benchmark-summary.md) - Multi-benchmark leaderboard (compression, needle-in-a-haystack, tool selection, agent workflows) comparing UTK, baseline, and competitor compaction techniques on tokens, quality, modeled cost, and modeled latency.
* [Evals-Driven Iteration](/features/evals/evals-driven-iteration.md) - UTK's tracing artifacts feed a TDD harness so prompt, template, schema, and grammar changes are gated by tool-usage evaluators against frozen baselines.
* [Evals](/features/evals/evals.md) - The @utk/evals harness measures token-compaction techniques across multiple benchmarks on tokens, quality, modeled cost, and modeled latency, with regression gates and a Pareto frontier.
* [RTK Parity](/features/evals/rtk-parity.md) - RTK is now one competitor arm in the unified comparison harness.
* [Tool-Calling Bypass Eval Scenarios](/features/evals/tool-calling-bypass-scenarios.md) - Fixture-backed eval scenarios that verify UTK safely bypasses tool calls without losing recoverable facts.
* [Tracing](/features/evals/tracing.md) - UTK emits per-run traces in the agentevals.io open standard so failures, parse errors, and soft fail-open paths can be evaluated as tool-usage rubrics.
