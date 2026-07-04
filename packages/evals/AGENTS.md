# Evals Agent Instructions

The evals are data-driven. Benchmark cases live in `data/<benchmark>.jsonl`; everything
else (results, charts, suite YAML, docs) is generated from them. Never hand-edit generated
numbers — change the data or the harness, then regenerate. There are five benchmarks:
`tool-output`, `long-context`, `needle-in-haystack`, `tool-selection`, `agent-workflows`.

## Regenerating

- `npm run evals --workspace @utk/evals` runs every benchmark and rewrites, in lockstep:
  - `results/<benchmark>.json` (incl. the 19-field per-case logs) and `results/summary.json`;
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
baseline: ≤2% absolute fact-retention loss, no increase in unsafe/mutating tool errors, and a positive
cost-per-success improvement. The winner per benchmark is a technique on the **Pareto frontier**
(cost per task ↓, fact retention ↑), not whoever cuts the most tokens — never present a token-reduction
number as an overall win without the frontier + headline numbers. UTK is allowed to fail its own gates
(committed results show it failing cost-per-success on tool-output and tool-selection) — never "fix" a
gate failure by weakening the gate or the accounting; fix the technique or report the failure.

## Integrity rules (read `docs/features/evals/benchmark-integrity.md` first)

- **No LLM is used anywhere.** "Fact retention" is a deterministic substring check; the UTK arm's
  100% retention holds by construction (it persists the raw payload). Never describe these numbers
  as task success by a model, and always document that no model was used — or, if a real model is
  ever wired in, name its exact id, provider, and run date in the report.
- Competitor arms are configured caricatures (one shared heuristic at different thresholds), not the
  vendors' systems. Never quote a competitor's cell as that product's measured performance.
- Recovery must stay charged: a tool round-trip **plus** the recovered-slice tokens. Do not restore
  free recovery — that inflated the numbers once already.
- Do not add tests that assert UTK beats competitors; assert structure, not outcomes.
- Do not multiply deterministic replays into "total evaluated cases" — only unique cases count.

## Modeled cost vs. real numbers

Token counts are `ceil(len/4)` estimates and fact retention is deterministic. Cost and latency are
**MODELED** by the deterministic reference cost table in `model.ts` (not a language model, and not
measured on a live endpoint) — say so when quoting cost/latency. Committed results use the
deterministic `referenceJudge` and reference cost model so they are reproducible offline. To
reproduce against a real target, swap the `costModel` (or point `UTK_REAL_DATA_DIR` at a licensed
dataset export via `adapters.ts`); do not overwrite the committed reference artifacts with
non-deterministic numbers.

## LeanCTX fixture suite

The LeanCTX-style fixture suite (`scripts/bench-leanctx-copilot.ts`) is a **regression harness for
UTK's Copilot code paths, not a competitive benchmark** — its "LeanCTX baseline" is a self-authored
reference rendering and its quality scores are 1.0 by construction. When rerunning it:

- run at least `npx vitest run scripts/bench-leanctx-copilot.test.ts --reporter=verbose`;
- report **unique** case counts only (the suite is deterministic; repeated rounds add no information);
- keep detailed results in `docs/competition/lean-ctx/parity-benchmark.md`, not the aggregate
  leaderboard, and keep that doc's integrity note intact.
