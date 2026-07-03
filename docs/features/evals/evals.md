---
type: feature
title: Evals
description: "The @utk/evals harness measures token-compaction techniques across multiple benchmarks on tokens, quality, modeled cost, and modeled latency, with regression gates and a Pareto frontier."
tags: [evals]
timestamp: 2026-07-03T00:00:00Z
---
# Evals

`@utk/evals` compares token-compaction techniques across **several benchmarks**, each
its own leaderboard table. Every benchmark runs baseline, every competitor, and UTK as
sibling arms over the **same** cases through the **same** harness:

- **baseline** — the agent reads the full, uncompacted context;
- **competitor** — a configured model of a rival technique (RTK, LeanCTX, Compresr, Caveman, Ponytail);
- **utk** — UTK persists the raw output off-context and surfaces a recoverable handle (at the cost of a recovery round-trip).

Each arm is scored on token cost, task success, quality, **modeled** cost, and **modeled**
latency, so a technique only "wins" when it keeps the facts *and* sits on the cost-vs-success
Pareto frontier. This mirrors the AgentV
[skill-improvement workflow](https://agentv.dev/docs/guides/skill-improvement-workflow/):
run a baseline, run a candidate, compare, iterate.

## Benchmarks

Five benchmarks, each one table. Competitors run across all of them; the tables reveal
where a technique wins and where it does not.

| Benchmark | Kind | Measures | Public analogs |
| --- | --- | --- | --- |
| `tool-output` | compression | Compact CLI/API output, facts recoverable | Terminal-Bench, SWE-bench, τ-bench, BFCL |
| `long-context` | compression | Compress a long document, answer survives | LongBench v2, RULER |
| `needle-in-haystack` | needle | Keep a buried needle recoverable | Needle-in-a-Haystack, RULER NIAH |
| `tool-selection` | tool-selection | Keep the safe tool selectable; unsafe tool left visible is an error | BFCL, τ-bench |
| `agent-workflows` | workflow | Keep the fix-relevant context for a multi-step task | SWE-bench Verified, AppWorld, WebArena |

## Layout

```
packages/evals/
  data/<benchmark>.jsonl            # benchmark cases (one JSON object per line)
  data/<benchmark>.provenance.json  # provenance manifest (origin + related benchmarks)
  benchmarks.ts                     # benchmark registry + per-kind scoring (scoreArmOutput)
  model.ts                          # deterministic reference cost/latency model (swappable)
  metrics.ts                        # 18-field RunMetrics, aggregation, headlines, gates, Pareto
  harness.ts                        # arms, hooks/middleware, aggressiveness sweeps (runSuite)
  comparison/<competitor>.ts        # per-competitor config (benchmark-agnostic)
  graders/                          # token (code), relevance (LLM), composite graders
  adapters.ts                       # real-dataset seam (LongBench/RULER/BFCL/... exports)
  report.ts + pareto.ts             # leaderboard tables + Pareto SVG
  suites/<benchmark>.EVAL.yaml      # formalized AgentV suite, generated from the jsonl
  results/<benchmark>.json          # latest run artifacts, incl. 18-field per-case logs
```

Registered competitors: **RTK**, **LeanCTX**, **Compresr**, **Caveman**, **Ponytail**
(`comparison/*.ts`). Each is a benchmark-agnostic `Competitor` (a keep-threshold plus optional
query-awareness and a session skill); add one by exporting a `Competitor` and registering it in
`comparison/index.ts`.

## Benchmark data

A case is technique-agnostic — it describes the raw context and what a good compaction must
(and must not) preserve. Provider behaviour lives in the comparison files, never in the data.

```jsonc
{
  "name": "ts-refund",
  "category": "Billing",
  "toolId": "catalog.billing",
  "prompt": "The customer wants a partial refund on one invoice. Which tool issues it?",
  "rawOutput": "get_invoice(invoice_id): read a single invoice\nissue_partial_refund(...)...\ndelete_customer(...)...",
  "requiredFacts": ["issue_partial_refund(invoice_id, amount): refund part of one invoice"],
  "irrelevantFacts": ["export_invoices_csv(customer_id): export invoices to CSV"],
  "unsafeTools": ["void_all_invoices", "delete_customer"]
}
```

- `requiredFacts` must stay **recoverable** after compaction (accuracy / groundedness).
- `irrelevantFacts` are noise a good compaction should drop from the chat surface (relevance).
- `unsafeTools` (tool-selection only) are mutating/destructive tool names; if compaction drops
  the safe tool and leaves one of these visible, the case is scored an **unsafe-tool error**.
- Every fact must be a verbatim substring of `rawOutput`; `harness.test.ts` enforces this for all benchmarks.

## Harness

`runSuite(options?)` runs every benchmark × (baseline, each competitor swept across
aggressiveness, UTK) under one cost model and returns a `SuiteResult`.
`runBenchmarkReport(name, options?)` runs a single benchmark. Each arm produces an
`{ visibleText, recoverableText }` surface: `visibleText` is the model-visible chat (what tokens
are charged against); `recoverableText` is everything still reachable (chat + stored artifact)
and is where fact retention is checked. Baseline and lossy-in-chat competitors have equal
surfaces; UTK keeps `visibleText` tiny while leaving facts recoverable.

**Aggressiveness sweeps.** Each competitor is run at a range of keep-thresholds
(`SWEEP_THRESHOLDS`) to trace a quality-vs-reduction curve. The leaderboard shows each
competitor's configured **primary** operating point; the sweep feeds the headline numbers.

**Hooks / middleware.** The base `SessionConfig` (`tools`, `skills`, `model`) is folded per arm
through `Middleware`; a competitor's middleware tags only its own arm (e.g. the provider skill),
recording how each arm was configured. The cost/latency model is separate and swappable.

## Metrics, cost, and latency

Every run logs 18 fields (`metrics.ts`, full per-case logs in `results/<benchmark>.json`):

`input_tokens`, `output_tokens`, `tool_schema_tokens`, `retrieved_context_tokens`,
`compressed_context_tokens`, `compression_latency_ms`, `model_latency_ms`, `tool_latency_ms`,
`total_latency_ms`, `model_cost`, `tool_cost`, `retry_count`, `fallback_count`,
`invalid_tool_call_count`, `task_success`, `quality_score`, `faithfulness_score`, `failure_category`.

**Token counts and fact retention are real.** Cost and latency are **MODELED** from those token
counts by a deterministic reference model (`model.ts`) — a mid-tier price sheet plus prefill/decode
and tool-round-trip latencies — so committed numbers are reproducible offline. Swap `costModel` (or
point the [real-dataset seam](#real-datasets) at a licensed export) to reproduce against a live target.
UTK is charged a recovery round-trip on every case whose task needs a fact its handle does not
surface (by construction, every case here), which is why UTK trades latency for tokens.

### Three headline numbers per technique

Read off each technique's sweep, all relative to baseline, to keep the axes separate:

- **Quality retention @ 50% token reduction** — quality at the operating point nearest a 50% cut.
- **Cost reduction @ ≤1% quality loss** — best cost cut among points that hold quality within 1% of baseline.
- **P95 latency reduction @ ≤1% quality loss** — p95 latency change at that same point (negative = slower).

### Regression gates

A technique passes only if, vs baseline: ≤2% absolute task-success loss, **no** increase in
unsafe/mutating tool errors, and a positive cost-per-success improvement.

### Pareto frontier

The winner is not whoever cuts the most tokens. `paretoFrontier` marks techniques not dominated on
(cost per task ↓, task success ↑); `pareto.ts` renders it as an SVG per benchmark
(`docs/features/evals/charts/<benchmark>-pareto.svg`: x = cost/task, y = task success, bubble = p95
latency). A technique can top the token-reduction column yet be off the frontier — that is the guard
against "Method A is best because it saves the most tokens."

## Graders

| Grader | Kind | Scores |
| --- | --- | --- |
| `tokenGrader` | code (deterministic) | model-visible token savings vs the raw baseline |
| `relevanceGrader` | LLM (pluggable judge) | relevance, accuracy, groundedness |
| `compositeGrader` | composite | fact-retention gate + weighted blend of tokens & quality |

The composite grader encodes the repo rule *"token savings do not count if quality drops"*:
losing a required fact zeroes the score regardless of tokens. The LLM grader takes a pluggable
`Judge`; the default `referenceJudge` is deterministic (fact retention + noise exclusion) so
committed results are reproducible offline. Each grader is also a standalone AgentV `type: script`
grader — it reads the `{ input, expected_output, output }` stdin payload and writes
`{ score, assertions, reasoning }`, which is how the generated suites call them.

## Running

```bash
# Run every benchmark; rewrite results/*.json, charts/*.svg, suites/*.EVAL.yaml, and benchmark-summary.md
npm run evals --workspace @utk/evals

# Just regenerate the formalized AgentV suites from the jsonl data
npm run evals:suites --workspace @utk/evals

# Unit tests (data, metrics, benchmarks, harness, graders, report/chart)
npm test --workspace @utk/evals
```

Results are persisted under `packages/evals/results/` and rendered as per-benchmark
leaderboards plus a cross-benchmark summary in
[`benchmark-summary.md`](/features/evals/benchmark-summary.md), regenerated in lockstep by
`npm run evals` so the numbers never drift from the data.

## Formalized AgentV suite

`suites/<benchmark>.EVAL.yaml` is each jsonl expressed as a runnable AgentV suite: each case
becomes a test whose assertions call the compiled graders. After building the package, AgentV
can run it directly:

```bash
npm run build --workspace @utk/evals
agentv run packages/evals/suites/tool-selection.EVAL.yaml
```

## Provenance

Following AgentV's [benchmark-provenance](https://agentv.dev/docs/guides/benchmark-provenance/)
guidance, `data/<benchmark>.provenance.json` records informational (non-executed) metadata —
origin, license, version, and the public benchmarks the cases relate to. `generate-suite` emits it
as suite-level and per-test `metadata`, and `run-evals` emits it into the per-benchmark
"Related public benchmarks" sections of `benchmark-summary.md`.

All cases are **synthetic and self-authored** — not sampled from, or scored on, any external
benchmark. The public benchmarks above are referenced only as task-category analogs so readers can
anchor the kinds of task measured. UTK compaction is an orthogonal context-cost layer; the
leaderboard numbers are not submissions to those benchmarks.

## Real datasets

`adapters.ts` is the seam for measuring a technique against a real external dataset. Convert a
dataset's examples to the `BenchmarkCase` shape (one `<benchmark>.jsonl`) and point
`UTK_REAL_DATA_DIR` at the directory; the harness uses it in place of the committed synthetic analog.
Nothing is fetched or vendored — you supply a licensed local export. When the seam is unconfigured,
`npm run evals` runs entirely on the committed analogs.

## AgentEvals evaluator protocol

The package also ships the [agentevals.io](https://agentevals.io) evaluator JSON protocol
natively for trace-based TDD (`tool_trajectory_avg_score`, `response_match_score`,
`no_parse_failures`, `no_soft_failures`), plus `loadUtkTrace` and a baseline store
(`readBaseline` / `writeBaseline` / `diffScorecards`). These consume the Jaeger + EvalSet
artifacts emitted by UTK tracing (see [tracing](tracing.md)) and drive a baseline-gated loop;
walkthrough in [evals-driven-iteration](evals-driven-iteration.md). Wire shapes and config keys:

- [references/agentevals-spec.md](references/agentevals-spec.md)
- [references/evaluator-config.md](references/evaluator-config.md)
- [references/baseline-store.md](references/baseline-store.md)
- [references/tracing-failure-codes.md](references/tracing-failure-codes.md)

## Related benchmarks

The LeanCTX Copilot context-runtime benchmark lives in `scripts/bench-leanctx-copilot.ts`
(tested by `scripts/bench-leanctx-copilot.test.ts`) with results in
[/competition/lean-ctx/parity-benchmark.md](/competition/lean-ctx/parity-benchmark.md).
