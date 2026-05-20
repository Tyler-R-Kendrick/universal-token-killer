---
name: detoks-skill
description: Use when optimizing Agent Skills for lower token usage, creating compact companion skills, splitting skill instructions into references, extracting deterministic workflow scripts, or adding eval-backed skill compression
---

# detoks-skill

Make token-optimized companion Agent Skills. Preserve original. Generate compact root, move detail to `references/`, extract deterministic work to `scripts/`, validate with AgentEvals.

## Load Map

- `references/workflow.md`: end-to-end source inspect, companion generation, token budget report.
- `references/compression-strategies.md`: TOC split, detok/caveman pass, preservation rules.
- `references/script-extraction.md`: deterministic workflow detection and TS script extraction.
- `references/evals.md`: AgentEvals `EVAL.yaml` contract and acceptance checks.

## Scripts

- `scripts/analyze-skill.ts`: token hotspots + deterministic candidates.
- `scripts/render-optimized-skill.ts`: write companion skill without mutating source.
- `scripts/validate-optimized-skill.ts`: frontmatter, references, token ratio, preservation checks.
- `scripts/evolve-candidates.ts`: optimize candidates through real Microsoft Trace (`trace-opt`) or Agent Lightning (`agentlightning`) backend.
- `scripts/optimize-agent-frontmatter.ts`: compact frontmatter context, preserve declarations.

## Rules

1. Never overwrite source skill.
2. Keep optimized root as table of contents.
3. Preserve code blocks, paths, commands, frontmatter, URLs, IDs exactly.
4. Put source-heavy guidance in `references/`; put deterministic repeated steps in `scripts/`.
5. Prefer repo `detoks-prompt` CLI for reference prose compression when available.
6. Use `evals/EVAL.yaml` as quality gate before reporting success.
