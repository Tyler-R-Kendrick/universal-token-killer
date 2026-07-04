---
type: benchmark
title: LeanCTX-Style Fixture Regression Suite
description: "Deterministic 50-fixture regression suite exercising UTK's Copilot prompt-surface, tool-output, and tool-schema code paths against a self-authored LeanCTX-style reference rendering. Not a competitive benchmark: the lean-ctx product is never executed."
tags: [competitive, benchmark, internal, regression]
timestamp: 2026-07-04T00:00:00Z
---
# LeanCTX-Style Fixture Regression Suite

Generated from `packages/evals/fixtures/leanCtxCopilotFixtures.ts` and `scripts/bench-leanctx-copilot.ts`.

> **Integrity note — read before quoting any number here.** This suite is a **regression harness for UTK's own Copilot code paths, not a benchmark of LeanCTX.** The "LeanCTX baseline" is a reference rendering **authored in this repository** (`renderLeanCtxBaseline()` — a fixed template string); the lean-ctx product is never installed or executed (see `docs/competition/lean-ctx/research.md`). The token-savings percentage is therefore a property of how verbose we wrote that template. The relevance/correctness/groundedness scores are **1.000 by construction**: fixtures plant required facts as separable lines and the rendered UTK surfaces echo the fixtures' required facts back into the graded text. No LLM is invoked; tokens are a `ceil(len/4)` character estimate. Full methodology limits: `docs/features/evals/benchmark-integrity.md`.

## What the suite actually verifies

Each run pushes 50 unique fixtures through real UTK code paths — `optimizePromptSurface` (prompt surfaces), `compactCopilotToolOutput` (tool-output routing), and `filterToolDefinitionsForIntent` (deferred tool-schema discovery) — and asserts, per fixture, that the compact UTK surface:

1. costs no more estimated tokens than the reference rendering,
2. keeps every required fact present in the surface,
3. carries a recovery marker (`utk-ref`/`utk-prompt-ref`/`utk_expand_context`/`utk_find_tool`).

A failure on any criterion fails the suite. That makes it a useful tripwire against regressions in the surface renderers and routing — and nothing more.

## Summary

- Unique scenarios: `50`
- Failed comparisons: `0`
- UTK compact surfaces: `3,625` estimated tokens
- Self-authored reference rendering: `5,466` estimated tokens
- Difference: `1,841` estimated tokens (`33.68%` fewer than the reference rendering)
- Relevance/correctness/groundedness: `1.000` (by construction — see integrity note)

The suite is fully deterministic: re-running it any number of times reproduces these numbers byte-for-byte, so repeated rounds or loops add no information. (Earlier versions of this report multiplied the 50 fixtures by 30 deterministic replays and headlined "1,500 evaluated cases" with a table of 10 identical "improvement loops"; that framing overstated the evidence and has been removed.)

## Aggregate By Surface

| Surface | Unique cases | UTK tokens | Reference tokens | Saved | Savings |
| --- | ---: | ---: | ---: | ---: | ---: |
| Prompt surface | 25 | 1,778 | 2,731 | 953 | 34.90% |
| Tool output | 20 | 1,629 | 2,192 | 563 | 25.68% |
| Tool schema | 5 | 218 | 543 | 325 | 59.85% |

## Fixture Coverage

| Fixture group | Unique cases | Focus |
| --- | ---: | --- |
| Prompt surface | 25 | GHCP agents, Copilot instructions, agent skills, system prompts, tool definitions |
| Tool output | 20 | git, search, test failures, package managers, Docker, kubectl, Terraform, Cargo, Python, file reads, edits, GitHub CLI, PowerShell, Node stacks, security scans |
| Tool schema | 5 | deferred tool discovery, required recovery tools, schema filtering |

All fixtures are template-generated in-repo; required facts are planted as cleanly separable single lines, so "fact retention" here measures that the renderers do not drop planted lines, not compaction quality on real payloads.

## Validation Commands

```bash
npx vitest run scripts/bench-leanctx-copilot.test.ts --reporter=verbose
npm run typecheck
npm test
```

## What a real LeanCTX comparison would require

Installing and running the lean-ctx product on the same inputs, measuring its actual output surfaces with a real tokenizer, and grading fact retention with criteria not embedded in the graded text. Until that exists, do not cite this suite as evidence that UTK beats LeanCTX.

## Maintenance Notes

- Keep this file as the standalone report for the fixture suite.
- Update `README.md`'s "LeanCTX-Style Fixture Regression Suite" section whenever these numbers change.
- Follow `packages/evals/AGENTS.md` and `docs/features/evals/benchmark-integrity.md` when rerunning or documenting benchmark performance.
