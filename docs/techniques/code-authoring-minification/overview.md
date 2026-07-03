---
type: category
title: Code-Authoring Minification
description: Deterministic minification of code UTK itself emits — declare-before-use min-maps, derived min-grammars, a YAGNI decision ladder, and code-graph reuse.
tags: [techniques, code-authoring-minification, internal]
timestamp: 2026-07-03T00:00:00Z
---
# Code-Authoring Minification

Internal note. Keep public docs focused on shipped UTK behavior.

Axis 3 in [gaps](/gaps.md), owned by `@utk/emission`. Where
[tool-output mediation](/techniques/tool-output-mediation/overview.md) compresses
what tools *return*, this axis compresses what the agent *writes* — emitting the
fewest tokens of correct code, and refusing to emit when a change is not warranted.

## Techniques in this axis

| Technique | What it does | Shipped surface |
|---|---|---|
| Min-map identifier minification | Declare-before-use short identifiers | `emission/src/minmap/*` |
| Derived min-grammar | Token-optimized grammar derived per language | `emission/src/grammars/deriveMinGrammar.ts` |
| Single-pass macro expansion | Expand macros without re-parsing | `emission/src/macros/*` |
| Decision ladder / YAGNI gate | 7 rungs; can refuse to emit | `emission/src/ladder/planEmission.ts` |
| Constrained min-emission | Constrained decode with honest fallback | `emission/src/emit/emitConstrained.ts` |
| Code-graph reuse (RAG) | Reuse existing TS/JS symbols instead of re-authoring | `packages/code-graph/src/index.ts` |

## Plan of record

- [Grammar-Grounded Emission (GGE) plan](/techniques/code-authoring-minification/gge-plan.md)
  formalizes the next iteration of the ladder + min-grammar path.

## Underlying research & competition

- **Adaptive patch format** — AdaEdit / BlockDiff / FuncDiff pick the cheapest edit
  format per change (open gap; see [gaps](/gaps.md), Type A).
- **Token-budgeted repo-map / goal-conditioned pruning** — Aider repo-map, RepoGraph,
  SWE-Pruner, and [Serena](/competition/serena/research.md)'s multi-language LSP are the bar.
- Nearest product competitor: [Ponytail](/competition/ponytail/research.md)
  ("write less code"); UTK formalizes its prose ruleset as a deterministic ladder
  (see [benchmark leaderboard](/features/evals/benchmark-summary.md)).
