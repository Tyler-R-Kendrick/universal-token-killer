# Evals

The `@utk/evals` package contains deterministic tests for safety, compactness, and RTK parity.

## What Is Tested

- no raw payload leakage in model-visible responses;
- compact response length and token budgets;
- allowed structural rule kinds;
- official TOON route parsing;
- fixture-backed RTK parity metrics;
- strict CLI wins over RTK baselines;
- generalized non-shell tool-output savings;
- autoevals-backed RTK fact-retention checks and AgentV code-grader YAML;
- AgentV tool-calling bypass scenarios for slash commands, exact lexical matches, regex patterns, local embeddings, local execution, protected/denied tools, and fail-open ambiguity;
- installed-SDK Compresr parity benchmarks with deterministic local baselines;
- bash-like invocation accuracy and token savings against RTK-style rewrite baselines;
- caveman parity benchmarks for terse technical summaries using `autoevals` fact-retention scoring.
- LeanCTX Copilot benchmarks for prompt surfaces, tool outputs, tool schemas, relevance, correctness, groundedness, and token savings.
- ponytail parity benchmarks for grammar-grounded min emission on code-authoring tasks, gated on round-trip fidelity, parse validity, min leakage, fact retention, and formalized decision-ladder correctness.

## Fixture Source

RTK parity fixtures live in `packages/evals/fixtures/rtkParityFixtures.ts`. Each fixture declares:

- `name`
- `category`
- `useCase`
- `testStrategy`
- `rtkStrength`
- `utkApproach`
- `toolId`
- `input`
- `rawOutput`
- `requiredFacts`
- RTK support and baseline token data

## Metric Source

Metric helpers live in `packages/evals/metrics/rtkParityMetrics.ts` and are exported from `@utk/evals`.

Use those helpers for tests, AgentV code graders, generated reports, and optional benchmark tooling so the numbers stay consistent. The RTK parity metric layer includes deterministic fact/recoverability checks and Braintrust `autoevals` `JSONDiff` scoring for AgentV-compatible fact retention.

The generated RTK comparison report lives at `docs/internal/rtk-parity-benchmark-results.md`. It documents where RTK is strong, what UTK attempts instead, and the measured token/fact/recoverability results.

Compresr parity fixtures live in `packages/evals/fixtures/compresrParityFixtures.ts`. The suite verifies the local Python SDK install with `packages/evals/scripts/verify-compresr-install.py`, records model/config metadata in `packages/evals/config/compresrConfig.ts`, and compares UTK against deterministic Compresr baselines without sending tool output to the hosted API. The generated report lives at `docs/internal/compresr-parity-benchmark-results.md`.

Bash rewrite helpers live in `packages/evals/metrics/bashRewriteMetrics.ts` and use fixtures from `packages/evals/fixtures/bashRewriteFixtures.ts`.

Caveman parity fixtures live in `packages/evals/fixtures/cavemanParityFixtures.ts`. They cover terse-output cases where caveman is a meaningful baseline: CI failure triage, review findings, artifact recovery handles, and implementation status reports. `packages/evals/metrics/cavemanParityMetrics.ts` uses Braintrust `autoevals` `JSONDiff` as the AgentV-compatible fact-retention scorer and separately gates token parity against each caveman baseline.

The generated comparison report lives at `docs/internal/caveman-parity-benchmark-results.md`. It documents where caveman is strong, what UTK attempts instead, and the measured token/fact results.

Tool-calling bypass fixtures live in `packages/evals/fixtures/toolCallingBypassFixtures.ts`. They cover the lexical matching enum levels (`slash-commands`, `exact-lexical-match`, `regex-patterns`, `lexical-similarity`), local embedding preference, argument capture, protected/denied tools, ambiguous fail-open cases, and the local execution path where UTK executes the tool before forwarding the tool result upstream. `packages/evals/metrics/toolCallingBypassMetrics.ts` provides the deterministic AgentV code-grader contract.

LeanCTX Copilot fixtures live in `packages/evals/fixtures/leanCtxCopilotFixtures.ts`. The benchmark runner lives in `scripts/bench-leanctx-copilot.ts` and is tested by `scripts/bench-leanctx-copilot.test.ts`. It compares UTK against a LeanCTX-style Copilot context-runtime baseline across 50 unique cases and requires UTK to meet or beat the baseline on relevance, correctness, groundedness, and token count. Current 10-loop performance is documented in `docs/internal/leanctx-copilot-benchmark-results.md`.

Ponytail parity fixtures live in `packages/evals/fixtures/ponytailParityFixtures.ts`. Each emission scenario carries three committed deterministic arms — a verbose assistant baseline, hand-authored ponytail lazy-dev arms per lite/full/ultra mode, and the UTK arm: a grammar-grounded min emission (a `@minmap` declare-before-use patch plus minified code) that `packages/evals/metrics/ponytailParityMetrics.ts` expands through the real `@utk/emission` engine. Token wins are measured including the patch overhead and only count when round-trip fidelity, parse validity, min leakage, and `autoevals` fact retention are all 1.0. A companion ladder suite checks that `planEmission` stops at the expected rung (reuse, stdlib, platform, dependency, macro, MVP) on fixture workspaces. The generated report lives at `docs/internal/ponytail-parity-benchmark-results.md`.

Aggregate benchmark results across RTK, Caveman, Compresr, LeanCTX, and Ponytail live in `docs/internal/benchmark-summary.md`.

Local documentation rules for future benchmark runs live in `packages/evals/AGENTS.md`.

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
npm run bench:rtk --workspace @utk/evals
```

Generate the RTK comparison report:

```bash
npm run report:rtk --workspace @utk/evals
```

Run bash-like tool rewrite metrics:

```bash
npm test --workspace @utk/evals -- --run evals/bash-rewrite-metrics.test.ts
```

Run Compresr parity benchmarks:

```bash
npm run bench:compresr --workspace @utk/evals
```

Generate the Compresr comparison report:

```bash
npm run report:compresr --workspace @utk/evals
```

Run caveman parity benchmarks:

```bash
npm run bench:caveman --workspace @utk/evals
```

Generate the caveman comparison report:

```bash
npm run report:caveman --workspace @utk/evals
```

Run tool-calling bypass eval scenarios:

```bash
npm run bench:tool-bypass --workspace @utk/evals
```

Generate the tool-calling bypass scenario report and AgentV YAML:

```bash
npm run report:tool-bypass --workspace @utk/evals
```

Run ponytail parity benchmarks:

```bash
npm run bench:ponytail --workspace @utk/evals
```

Generate the ponytail comparison report and AgentV YAML:

```bash
npm run report:ponytail --workspace @utk/evals
```

Run LeanCTX Copilot benchmarks:

```bash
npx vitest run scripts/bench-leanctx-copilot.test.ts --reporter=verbose
```

AgentV can run the code-grader contract after building:

```bash
npm run build --workspace @utk/evals
agentv run packages/evals/evals/rtk-parity.EVAL.yaml
agentv run packages/evals/evals/caveman-parity.EVAL.yaml
agentv run packages/evals/evals/compresr-parity.EVAL.yaml
agentv run packages/evals/evals/tool-calling-bypass.EVAL.yaml
```

Run the optional benchmark helper tests:

```bash
npm test -- scripts/bench-rtk-baseline.test.ts
```

Run a live RTK comparison when a local RTK command is available:

```bash
UTK_RTK_COMMAND="rtk" npm test -- scripts/bench-rtk-baseline.test.ts
```
