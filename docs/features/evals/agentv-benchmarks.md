---
type: feature
title: AgentV Benchmarks
description: "UTK's benchmark suites as AgentV SDK evals: custom SDK assertions, configurable targets, agentv compare for A/B deltas, an on-demand GitHub dispatch workflow, Harbor-backed trusted benchmarks, and the n-run tool-calling token-efficiency benchmark."
tags: [evals, benchmark, agentv, harbor, tool-calling, token-efficiency]
timestamp: 2026-07-04T00:00:00Z
---

# AgentV benchmarks

All UTK evals are authored with the [AgentV SDK](https://agentv.dev/docs/evaluation/sdk/) and graded by AgentV graders. The suites are runnable through the `agentv` CLI, targets are configurable, and A/B comparison uses the built-in [`agentv compare`](https://agentv.dev/docs/tools/compare/) tool. Honest-measurement rules from [Benchmark Integrity And Limitations](benchmark-integrity.md) apply everywhere: offline targets invoke **no LLM**, token numbers are `ceil(len/4)` estimates of real surfaces, and no grader ever compares one arm against another (cross-arm judgment belongs to `compare`).

## Layout

| Piece | Location |
| --- | --- |
| SDK eval suites (`defineEval`) | `packages/evals/evals/*.eval.ts` (thin wrappers over `packages/evals/agentv/suiteBuilder.ts`) |
| Generated canonical YAML (SDK `serializeEvalYaml`) | `packages/evals/suites/*.EVAL.yaml` |
| Custom SDK assertions (`defineAssertion`) | `.agentv/assertions/*.ts` |
| Targets configuration | `.agentv/targets.yaml` |
| Offline target harnesses (`cli` provider bins) | `packages/evals/agentv/armCli.ts`, `packages/evals/agentv/toolCallingEfficiencyCli.ts` |
| Dispatch workflow | `.github/workflows/benchmark.yml` |

Six suites ship: the five comparison benchmarks (`tool-output`, `long-context`, `needle-in-haystack`, `tool-selection`, `agent-workflows`) and the measured `tool-calling-efficiency` benchmark (below).

## Graders

Grading is composed from custom SDK assertions discovered in `.agentv/assertions/` (each is a `defineAssertion` handler; AgentV executes them per test):

- `fact-retention` (weight 2) — required facts must survive on the arm's *recoverable* surface. Flags by-construction retention (persist-and-hand-back arms) in `details`.
- `noise-exclusion` (weight 1) — irrelevant facts should be dropped from the *visible* surface.
- `token-reduction` (weight 1) — score is the honest reduction (`visible + recovery` charged against raw); `pass` asserts only non-inflation, so a 0%-reduction baseline legitimately passes with score 0.
- `unsafe-tool-exposure` (tool-selection only) — hard-fails when compaction drops the safe tool while a destructive tool name stays visible.
- `token-efficiency` (tool-calling suite) — validates the n-run episode: real cache hits after run 1, schema-generation overhead charged only on cache misses, steady-state average not above run 1.

Per-test scores are the weighted mean of these assertions (the same aggregation the AgentV assert-set/composite grouping reports as its parent score). **No assertion encodes "UTK must beat X"** — that comparison is `agentv compare`'s job, keeping the CI-freezes-the-leaderboard failure mode out of the graders.

## Targets

`.agentv/targets.yaml` defines the configurable targets ([targets configuration](https://agentv.dev/docs/targets/configuration/)):

- **Offline deterministic arms** (`cli` provider, no API keys): `arm-baseline`, `arm-utk`, `arm-rtk`, `arm-leanctx`, `arm-compresr`, `arm-caveman`, `arm-ponytail`, plus `toolcalling-baseline` / `toolcalling-utk`. The `arm-*` targets are configured models of each technique (see the integrity doc — the competitor arms are one shared heuristic, not the vendors' software).
- **Live provider targets** (commented, env-gated): anthropic/openai/copilot entries using `${{ ENV_VAR }}` references. Use these to measure real models and real `token_usage`; any published number from a live run must name the exact model id and date.

## Running

```bash
npm run build                      # compiles the arm harness bins the cli targets spawn

# One suite, two targets (matrix), then the built-in A/B comparison:
npx agentv eval packages/evals/evals/tool-output.eval.ts \
  --target arm-baseline --target arm-utk \
  --output .agentv/results/tool-output --threshold 0
npx agentv compare .agentv/results/tool-output --baseline arm-baseline --candidate arm-utk

# Everything, via the workspace scripts:
npm run evals:agentv --workspace @utk/evals
npm run evals:agentv:compare --workspace @utk/evals
```

`--threshold 0` matters: a comparison matrix scores arms on a continuous scale, and per-arm pass/fail gating is meaningless there — regressions are judged by `compare` deltas (exit 1 on regression makes it a CI gate).

## Tool-calling token efficiency (n runs, real code paths)

`tool-calling-efficiency` measures what the modeled suites cannot: the token cost of tool calling through UTK's **shipped implementation**, phase by phase, over n runs of the same request (`UTK_EVAL_RUNS`, default 5):

1. **Tool selection** — the catalog surface the model reads. UTK arm: `filterToolDefinitionsForIntent` (deferred-search discovery); baseline: the full OpenAI-style catalog.
2. **Invocation-input generation** — the surface consumed/emitted to produce the tool call. UTK arm: `completeStructuredToolInvocation` — guidance-ts grammar, dynamic schema/template generation persisted under `.utk/tools/…/templates/`, and the memoized planner cache. Run 1 charges the real schema-generation overhead; later runs re-use the real cache (`cache.hit` comes from the memoization layer, not a simulation).
3. **Output generation** — the tool-output surface entering context. UTK arm: `mediateToolExecution`'s compact handle **plus the recovery slice** for facts not visible on the handle (recovery is never free); baseline: the raw output.

Expected shape (and what the committed probe run shows): the UTK arm is **more expensive on run 1** (schema generation) and cheaper at steady state once the cache is warm — e.g. `tce-github-issue-search`: baseline 529 tokens every run; UTK 614 on run 1, 450 from run 2 on. The `token-efficiency` assertion checks the caching *property* (real cache hits, amortization) — it never scores one arm against the other, so a score-level `agentv compare` between `toolcalling-baseline` and `toolcalling-utk` ties by design. Whether UTK's steady state actually beats the baseline for a workload is read from the per-run token totals in each episode report (the `details.per_run_totals` of the grading artifacts, or the target output JSON under the run directory), never assumed.

Offline episodes invoke no LLM — surfaces are real, token counts are `ceil(len/4)` estimates. For real-model numbers, run the suite against a live target and read AgentV's measured `token_usage`.

## On-demand GitHub workflow

`.github/workflows/benchmark.yml` is `workflow_dispatch`-only. Benchmarks are long-running, so each dispatch runs **exactly one benchmark** (`benchmark` choice input) with the job timeout raised to the GitHub-hosted maximum (360 minutes). Parameters: `targets` (comma-separated AgentV target names), `compare_baseline` / `compare_candidate` / `compare_threshold` (fed to `agentv compare`, output lands in the job summary), `runs` (n for tool-calling episodes), and the `harbor_*` inputs. Results upload as artifacts.

## Harbor-backed trusted benchmarks

For standard, highly trusted benchmark suites, the workflow delegates to [Harbor](https://harborframework.com/) — the sandboxed-agent benchmark harness from the Terminal-Bench team — per the AgentV [benchmark-provenance guide](https://agentv.dev/docs/guides/benchmark-provenance/): Harbor owns the runtime contract (task definitions, Docker adapters, verifiers); we stay at the orchestration boundary, launching the job and importing its results, and never translate Harbor task schemas into AgentV eval schemas.

Wired datasets (registry ids from `harbor dataset list` / hub.harborframework.com):

- `terminal-bench/terminal-bench-2` — containerized CLI/terminal agent tasks; the environment where UTK's tool-output mediation value proposition applies most directly.
- `swe-bench/swe-bench-verified` — real-repo software tasks whose long tool outputs (test runners, tracebacks) are UTK's compaction target.

Dispatch `benchmark: harbor-terminal-bench-2` (or `harbor-swe-bench-verified`) with `harbor_model`, `harbor_agent`, and `harbor_trials`. These runs invoke a **real model** — provider secrets are required, and results must be reported with the exact model id and run date. To measure UTK's effect on a Harbor benchmark, run it twice — agent without UTK hooks vs agent with UTK hooks installed — and compare rewards and token telemetry between the two jobs; do not edit Harbor verifiers.

## Regeneration and provenance

`npm run evals:suites --workspace @utk/evals` re-serializes `suites/*.EVAL.yaml` from the SDK definitions via `serializeEvalYaml` (also refreshed by `npm run evals`). Suite-level `name`/`version`/`license`/`tags` and per-test `metadata` (origin, authorship, disclaimer, related public benchmarks) follow the AgentV benchmark-provenance conventions: operational fields stay operational, provenance rides in informational metadata from `data/<benchmark>.provenance.json`.
