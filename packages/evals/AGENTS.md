# Evals Agent Instructions

The evals are data-driven. Benchmark cases live in `data/<benchmark>.jsonl`; everything
else (results, charts, suite YAML, docs) is generated from them. Never hand-edit generated
numbers — change the data or the harness, then regenerate. There are five benchmarks:
`tool-output`, `long-context`, `needle-in-haystack`, `tool-selection`, `agent-workflows`.

## Regenerating

- `npm run evals --workspace @utk/evals` runs every benchmark and rewrites, in lockstep:
  - `results/<benchmark>.json` (incl. the 18-field per-case logs) and `results/summary.json`;
  - `docs/features/evals/charts/<benchmark>-pareto.svg`;
  - `suites/<benchmark>.EVAL.yaml`;
  - `docs/features/evals/benchmark-summary.md` (all leaderboards + cross-benchmark summary).
- Commit the regenerated artifacts in the same change as the data/harness edit that moved them.
- The summary doc is an OKF concept: `run-evals` emits the `type: benchmark` frontmatter; run `npm run lint:okf` after regenerating.
- Do not bury benchmark metrics only in PR text, terminal output, or test logs.

## Adding a case or competitor

- A case: add a line to the relevant `data/<benchmark>.jsonl` with `requiredFacts` (must stay
  recoverable) and `irrelevantFacts` (should be dropped); for `tool-selection` also add `unsafeTools`
  (mutating tools that must not be the surviving selection). Every fact must be a verbatim substring
  of `rawOutput`; `harness.test.ts` enforces this across all benchmarks.
- A competitor: add `comparison/<name>.ts` exporting a benchmark-agnostic `Competitor` (a
  `keepThreshold`, optional `queryAware`, and a session skill via `addSkill`), register it in
  `comparison/index.ts`, and rerun `npm run evals`. It runs across every benchmark automatically.

## Quality rule and gates

Token savings do not count if quality drops. A technique passes the regression gate only if, vs
baseline: ≤2% absolute task-success loss, no increase in unsafe/mutating tool errors, and a positive
cost-per-success improvement. The winner per benchmark is a technique on the **Pareto frontier**
(cost per task ↓, task success ↑), not whoever cuts the most tokens — never present a token-reduction
number as an overall win without the frontier + headline numbers.

## Modeled cost vs. real numbers

Token counts and fact retention are real. Cost and latency are **MODELED** by the deterministic
reference model in `model.ts`, not measured on a live endpoint — say so when quoting cost/latency.
Committed results use the deterministic `referenceJudge` and reference cost model so they are
reproducible offline. To reproduce against a real target, swap the `costModel` (or point
`UTK_REAL_DATA_DIR` at a licensed dataset export via `adapters.ts`); do not overwrite the committed
reference artifacts with non-deterministic numbers.

## LeanCTX Copilot

The LeanCTX Copilot benchmark is separate. When rerunning it:

- run at least `npx vitest run scripts/bench-leanctx-copilot.test.ts --reporter=verbose`;
- for repeated improvement loops, record loop count, rounds per loop, total evaluated cases, per-surface totals, and minimum relevance/correctness/groundedness;
- keep detailed results in `docs/competition/lean-ctx/parity-benchmark.md`, not the aggregate leaderboard.
