# SkillReducer Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Agent-native token economy (skill/instruction compression)
Primary source: arXiv **2603.29919** — *SkillReducer: Optimizing LLM Agent Skills for Token Efficiency*
Verification: ✅ claimed ID correct (v1 2026-03-31, v2 2026-06-24). Authors Yudong
Gao, Zongjie Li, Yuanyuan Yuan, Zimo Ji, Pingchuan Ma, Shuai Wang. arXiv preprint.

## Positioning

Directly relevant to Claude/Codex-style **skills**: it measures how bloated agent
skills are and compresses them without losing function. This is the formalized,
measured version of the "progressive disclosure" pattern.

## Mechanism

Two-stage optimization:

1. **Routing layer** — compress verbose skill *descriptions* (the always-loaded
   index the agent routes on) and generate missing ones via **adversarial delta
   debugging**.
2. **Skill bodies** — restructure via **taxonomy-driven classification + progressive
   disclosure**, separating actionable core rules from supplementary content loaded
   **on demand**; validated by faithfulness checks and a self-correcting feedback
   loop.

## Verified Metrics

Authors' own study + eval:

- Empirical study of **55,315** public skills: **26.4%** lack routing descriptions
  entirely, **>60%** of body content is non-actionable, and reference files can
  inject **tens of thousands of tokens per invocation**.
- On **600 skills + the SkillsBench benchmark**: **48% description compression** and
  **39% body compression** while **improving functional quality by 2.8%**
  ("less-is-more").

## Scope

**SKILL/INSTRUCTION-COMPRESSION.** Attacks the always-loaded skill index and the
on-demand skill body — a fixed per-invocation cost, like tool schemas.

## UTK Relevance

Maps straight onto UTK's own surfaces: this repo ships a `skills/` tree and Copilot
skill bundles, and the routing-description/progressive-disclosure split is exactly
how UTK should structure them — a terse always-loaded routing line, with the body
**loaded on demand**. Pairs with the tool/schema-reduction work in the
[watchlist §4](../token-optimization-landscape-watchlist.md) (same "fixed
per-turn cost" target) and with the Sketch-of-Thought router pattern
([`../sketch-of-thought-competitive-research.md`](../sketch-of-thought-competitive-research.md)).
The 2.8% quality *gain* at ~half the tokens is the "less-is-more" evidence UTK can
cite for aggressive skill trimming — gated on UTK's faithfulness evals.

## Caveats

- Numbers are the authors' own **SkillsBench** eval; preprint, not independently
  reproduced.
- "Functional quality +2.8%" is their metric — validate against UTK's own skill
  fixtures before trusting the "less-is-more" claim on UTK skills.
