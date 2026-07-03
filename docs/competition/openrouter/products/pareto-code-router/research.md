---
type: product
title: OpenRouter Pareto Code Router Competitive Research
description: "Source: https://openrouter.ai/docs/guides/routing/routers/pareto-router (fetched) Kind: Product — coding-specific model router (openrouter/pareto-code), OpenAI-compatible."
tags: [competitive, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# OpenRouter Pareto Code Router Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Compound models & productized routers
Source: https://openrouter.ai/docs/guides/routing/routers/pareto-router (fetched)
Kind: Product — coding-specific model router (`openrouter/pareto-code`), OpenAI-compatible.

## Positioning

**The coding-agent-specific router**, and the most directly UTK-relevant product in
this folder: "coding quality tier" is a more meaningful control for a code assistant
than generic "smart/cheap." You set a minimum coding score; it returns the cheapest
qualifying model.

## Mechanism

You set **`min_coding_score`**; it maps to a **tier**, and "within the chosen tier
the router selects the cheapest model that is currently available." **Correction to
the brief:** it is threshold → **tier** → cheapest-in-tier, not a flat
"cheapest above the exact score." Tiers (based on **Artificial Analysis** coding
scores): **≥0.66 High** ("top of AA's coding field"), **0.33–0.66 Medium** ("strong
modern flagships"), **<0.33 Low**; omitted → defaults to **High**.

## Controls / Knobs

- **`min_coding_score`** (0–1) — the quality floor / tier selector.
- **`:nitro`** variant — switches selection from *cheapest* to **fastest** in the
  tier.
- **`session_id`** — pins model/provider across a multi-turn session (expires after
  5 min inactivity).
- **`plugins`** array — pass pareto-router config per request; dashboard defaults
  under Settings > Plugins.

## Verified Metrics

**None published** — the page references Artificial Analysis coding scores as the
tiering basis but publishes no savings/accuracy figures.

## Scope

**COST-REDUCTION** — cheapest qualifying coding model above a score floor.
**OpenAI-compatible:** yes.

## UTK Relevance

**Closest external precedent for `@utk/model-proxy`'s coding path.** The
"minimum coding score → cheapest-in-tier" pattern is exactly the productized form of
the patch-generation row in the [model-routing overview](/techniques/model-routing/overview.md) phase-routing table
("cheapest model that passes local tests"). Adopt the **coding-tier floor** framing;
UTK adds the escalation trigger (failed compile/test) that Pareto Code lacks. `:nitro`
(fastest-in-tier) is a useful second axis.

## Caveats

- **No published effectiveness numbers**; tiering leans entirely on a third party
  (Artificial Analysis) scores.
- Picks the cheapest *available* model — availability, not just price, drives the
  choice.
