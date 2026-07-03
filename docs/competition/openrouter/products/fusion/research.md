---
type: product
title: OpenRouter Fusion Competitive Research
description: "Source: https://openrouter.ai/docs/guides/routing/routers/fusion-router (fetched) Kind: Product — multi-model deliberation (openrouter/fusion), OpenAI-compatible."
tags: [competitive, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# OpenRouter Fusion Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Compound models & productized routers
Source: https://openrouter.ai/docs/guides/routing/routers/fusion-router (fetched)
Kind: Product — multi-model deliberation (`openrouter/fusion`), OpenAI-compatible.

## Positioning

The productized **selective ensemble**: a panel of models answers in parallel, then
a judge model compares them and returns structured analysis. **Not a token saver** —
a quality/consensus mode that costs several× a single completion.

## Mechanism

Invokes **up to 8 models in parallel** (each with `web_search`/`web_fetch`), then a
**judge** "returns structured analysis as JSON." Fields (exact): **Consensus**
("what all or most models agreed on… higher-confidence"), **Disagreements** (the
brief said "contradictions" — the actual field is *disagreements*), **Coverage
gaps**, **Unique insights**, **Blind spots**. Default Quality-preset panel: Claude
Opus, GPT-latest, Gemini Pro.

## Controls / Knobs

- **`analysis_models`** (1–8) — the panel.
- **`model`** — the judge (defaults to the request's model).
- **`max_tool_calls`** (1–16), **`max_completion_tokens`**, **`reasoning`**
  (forwarded to panel + judge), **`temperature`** (0–2 for the panel; the judge
  always runs at 0).

## Verified Metrics

**None published** (no accuracy benchmark). **Cost:** "With the default 3-model
panel, expect roughly **4–5× the cost of a single completion**… Cost scales linearly
with panel size."

## Scope

**SELECTIVE-ENSEMBLE (cost-increasing)** — ~4–5× per request at the default panel; a
cost *multiplier* if applied to every request rather than gated to high-stakes work.
**OpenAI-compatible:** yes (returns structured JSON rather than a single completion).

## UTK Relevance

The productized analogue of the [`../full-ensembling/`](/research/model-routing/full-ensembling/overview.md) layer
and the [selective ensembling](/research/model-routing/selective-ensembling/overview.md) gating rule. For UTK
this is **reference-only / a quality mode to gate**: use it (or expose it) only when
the cost of being wrong exceeds ~4–5× a completion — high-risk diffs, security
review, contested plans. The structured "blind spots / disagreements" output is a
nice pattern for a verifier gate, but it is the opposite of token optimization.

## Caveats

- **Cost multiplier, not a saver** — never a default path.
- Two brief field-name corrections: *disagreements* (not "contradictions"),
  *coverage gaps*.
- No published accuracy numbers — the quality benefit is unmeasured on this page.
