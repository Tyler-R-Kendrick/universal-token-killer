# Evals Agent Instructions

The evals are data-driven. Benchmark cases live in `data/<benchmark>.jsonl`; everything
else (results, suite YAML, docs) is generated from them. Never hand-edit generated
numbers — change the data or the harness, then regenerate.

## Regenerating

- `npm run evals --workspace @utk/evals` runs every comparison and rewrites, in lockstep:
  - `results/<competitor>.json` and `results/summary.json`;
  - `suites/<benchmark>.EVAL.yaml`;
  - `docs/internal/<competitor>-benchmark-results.md` and `docs/internal/benchmark-summary.md`.
- Commit the regenerated artifacts in the same change as the data/harness edit that moved them.

## Adding a case or competitor

- A case: add a line to `data/tool-output.jsonl` with `requiredFacts` (must stay recoverable)
  and `irrelevantFacts` (should be dropped). Every fact must be a verbatim substring of `rawOutput`;
  `harness.test.ts` enforces this.
- A competitor: add `comparison/<name>.ts` exporting a `Comparison` (a `competitorArm` technique
  plus optional middleware), register it in `comparison/index.ts`, and rerun `npm run evals`.

## Quality rule

Token savings do not count if quality drops. The composite grader gates on fact retention:
losing a required fact zeroes the score no matter how many tokens were saved. A comparison is
only favourable to UTK when UTK meets or beats the competitor on fact retention **and** visible tokens.

## Reference judge vs model judge

Committed results use the deterministic `referenceJudge` (fact retention + noise exclusion) so
they are reproducible offline. When reporting numbers from a real model judge, say which model was
used and via which `configureModel` hook — do not overwrite the committed reference-judge artifacts with
non-deterministic numbers.

## LeanCTX Copilot

The LeanCTX benchmark is separate. Rerun with
`npx vitest run scripts/bench-leanctx-copilot.test.ts --reporter=verbose` and keep its results in
`docs/internal/leanctx-copilot-benchmark-results.md`.
