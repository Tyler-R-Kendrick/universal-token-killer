---
type: product
title: Caveman Code Competitive Research
description: "Source: JuliusBrussee/caveman-code (664★, MIT, TypeScript; created 2026-04-08); site caveman.so / getcaveman.dev Verification: ✅ repo + site live."
tags: [competitive, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Caveman Code Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Agent-native token economy
Source: [`JuliusBrussee/caveman-code`](https://github.com/JuliusBrussee/caveman-code) (664★, MIT, TypeScript; created 2026-04-08); site `caveman.so` / `getcaveman.dev`
Verification: ✅ repo + site live. **Distinct from the base Caveman skill** (documented
at [`../caveman-competitive-research.md`](/competition/caveman/research.md)) — same
author/ecosystem (JuliusBrussee), but this is the *terminal coding agent*, not the
skill.

## Positioning

**The closest direct competitor to UTK's actual thesis:** a terminal coding agent that
compresses **both** model output **and** tool/shell output before they re-enter
context — i.e. output-style compression + RTK-like tool-output mediation in one
product.

## Mechanism

Emits terse, fragment-based model output **and** compresses shell/tool output before it
re-enters context. Stacks multiple compression layers (model-response style compression
+ tool-output filtering) with a small system-prompt overhead (claimed **120–195
tokens** lite→ultra).

## Verified Metrics

**All project-side / self-run — NOT independently validated:**

- "**~2× fewer tokens than Codex**." Self-run 25-task **"MicroBench"**: Caveman **524k**
  fresh tokens / **14-of-25** pass vs Codex **1,010k** tokens / **15-of-25** pass →
  "**1.93× fewer tokens** than Codex CLI on identical tasks."
- Tool-output compression: **git diff −94%**, **npm ls −92%**, "**−86% aggregate**."
- Session projections: 15-turn "+567K tokens (~$1.70, Sonnet)"; 30-turn "+1.13M tokens
  (~$6.92, Sonnet)."

Note the **pass-rate tradeoff even in their own numbers** (14/25 vs Codex 15/25).

## Scope

**OUTPUT-COMPRESSION** (model output + tool/shell output).

## UTK Relevance

Track as a **head-to-head competitor** to `@utk/model-proxy` + RTK tool-output
mediation. Its tool-output numbers (**git diff −94%, npm ls −92%**) target the exact
sink UTK's RTK/Headroom-style mediation attacks — useful as a bar to benchmark against.
But the self-reported **pass-rate regression** (14/25 vs 15/25) is precisely why UTK
gates savings on **recoverability + fact-retention**: raw token cuts that quietly lower
task success are the trap. Cross-check its claims against UTK's own evals rather than
trusting the MicroBench.

## Caveats

- **All metrics are project-side, self-run** — not independently validated.
- Pass-rate regression in their own MicroBench (14/25 vs 15/25).
- Same vendor ecosystem as the base Caveman skill and CaveGemma (already documented);
  this file covers only the coding-agent product.
