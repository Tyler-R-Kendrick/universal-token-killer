---
type: category
title: Agent-Native Token Economy
description: "Output-side compression of the agent’s own prose, tool output, and skill text — the compounding agent-native sink UTK owns (Caveman, SkillReducer)."
tags: [techniques, output-compression, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Agent-Native Token Economy

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Thesis:** agent verbosity is a *compounding* sink — model output, tool/shell
output, and skill/instruction text all get **re-read by the agent on later turns**,
so every token saved is saved repeatedly. This bucket tracks the tools and evidence
that attack those agent-native sinks specifically (distinct from academic prompt
compression in [prompt compression](/research/prompt-compression/overview.md) and model routing
in [model routing](/research/model-routing/overview.md)).

## The governing rule (from CAVEWOMAN)

The independent [CAVEWOMAN](/research/cavewoman/overview.md) evaluation gives the safe operating rule,
and it happens to be exactly UTK's existing recoverability discipline:

```text
Compress OUTPUT style aggressively   → cuts realized cost on most API + all open models.
Compress INPUT only when verifiably lossless → blind input compression is a "strict
  lose-lose": models compensate with longer outputs and accuracy collapses.
```

## Key sources (now in research/ + competition/)

| Item | Source | Kind | Status |
|---|---|---|---|
| [CAVEWOMAN](/research/cavewoman/overview.md) | arXiv 2606.24083 | Independent empirical eval of input/output compression | Verified (preprint) |
| [SkillReducer](/research/skillreducer/overview.md) | arXiv 2603.29919 | Skill/instruction compression (routing-desc + progressive disclosure) | Verified (preprint) |
| [Caveman Code](/competition/caveman/products/caveman-code/research.md) | github JuliusBrussee/caveman-code | Terminal coding agent (output + tool-output compression) | Verified (project-side metrics) |

## Already covered elsewhere in the docs bundle (cross-reference, not duplicated)

The caveman ecosystem is one vendor line (JuliusBrussee / caveman.so /
getcaveman.dev). Two of its pieces already have internal deep-dives:

- **Caveman** (base skill/plugin, `JuliusBrussee/caveman`) →
  [Caveman research](/competition/caveman/research.md). Same
  project; the flagship output-style skill (~80.8k stars, MIT, lite/full/ultra/wenyan
  levels, "65% tokens cut" tagline).
- **CaveGemma** (Gemma fine-tune that bakes caveman style into weights) →
  [CaveGemma](/competition/caveman/products/cavegemma/research.md).
  Current site (getcaveman.dev) claims **65% compression vs base, no prompt needed;
  99% code-fence / 94% semantic** — vendor/project-side, unvalidated.

Adjacent agent-context compressors (different vendors) also already covered:

- **Headroom** (compress tool outputs/logs/context before the agent) →
  [Headroom](/competition/headroom/research.md).
- **Ponytail** ("write less code" — reduce implementation surface, tokens as a side
  effect) → [Ponytail](/competition/ponytail/research.md).

## UTK Relevance

This is **UTK's home turf** — RTK-style tool-output mediation + terse output +
recoverable artifacts. Caveman Code is the **closest direct competitor** (it
compresses both model output and tool/shell output as a coding agent). SkillReducer
maps onto UTK's own `skills/` surface (progressive disclosure + routing-description
compression). And CAVEWOMAN is the **strongest third-party evidence** for UTK's
central rule: compress output freely, but only compress input when recoverability is
proven — the exact gate UTK already enforces.
