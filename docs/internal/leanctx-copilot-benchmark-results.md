# LeanCTX Copilot Benchmark Results

Generated from `packages/evals/fixtures/leanCtxCopilotFixtures.ts` and `scripts/bench-leanctx-copilot.ts`.

## Summary

- Unique scenarios: 50
- Benchmark loops: 10
- Rounds per loop: 3
- Total evaluated cases: 1,500
- Failed comparisons: 0
- Minimum relevance: 1.000
- Minimum correctness: 1.000
- Minimum groundedness: 1.000
- UTK tokens: 108,750
- LeanCTX baseline tokens: 163,980
- Total estimated token savings vs LeanCTX: 55,230
- Average UTK/LeanCTX token ratio: 0.663
- Savings vs LeanCTX: 33.68%

## Findings

- LeanCTX is strongest at governed context-runtime behavior: Copilot hook wiring, shell-output patterns, Context IR, archive recovery, proof hashes, and broad MCP-style discovery.
- UTK wins these Copilot fixtures by staying hook-first, preserving required facts in compact `facts=` lines, storing raw artifacts locally, and exposing recovery through `utk_expand_context` or `utk_find_tool`.
- Token savings are not accepted alone. Every case must meet or beat LeanCTX on relevance, correctness, and groundedness before token savings count.

## Aggregate By Surface

| Surface | Evaluated cases | UTK tokens | LeanCTX tokens | Saved | Savings | Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Prompt surface | 750 | 53,340 | 81,930 | 28,590 | 34.90% | 0 |
| Tool output | 600 | 48,870 | 65,760 | 16,890 | 25.68% | 0 |
| Tool schema | 150 | 6,540 | 16,290 | 9,750 | 59.85% | 0 |

## Loop Results

Each loop ran the full 50-case suite for 3 internal rounds.

| Loop | Evaluated cases | UTK tokens | LeanCTX tokens | Saved | Savings | Min relevance | Min correctness | Min groundedness | Failures |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |
| 2 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |
| 3 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |
| 4 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |
| 5 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |
| 6 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |
| 7 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |
| 8 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |
| 9 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |
| 10 | 150 | 10,875 | 16,398 | 5,523 | 33.68% | 1.000 | 1.000 | 1.000 | 0 |

## Validation Commands

```bash
npx vitest run scripts/bench-leanctx-copilot.test.ts --reporter=verbose
npm run typecheck
npm test
```

## Fixture Coverage

| Fixture group | Unique cases | Focus |
| --- | ---: | --- |
| Prompt surface | 25 | GHCP agents, Copilot instructions, agent skills, system prompts, tool definitions |
| Tool output | 20 | git, search, test failures, package managers, Docker, kubectl, Terraform, Cargo, Python, file reads, edits, GitHub CLI, PowerShell, Node stacks, security scans |
| Tool schema | 5 | deferred tool discovery, required recovery tools, schema filtering |

## Maintenance Notes

- Keep this file as the standalone LeanCTX Copilot benchmark report.
- Update the aggregate table in `docs/internal/benchmark-summary.md` whenever these numbers change.
- Follow `packages/evals/AGENTS.md` when rerunning or documenting benchmark performance.
