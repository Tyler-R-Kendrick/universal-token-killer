---
type: product
title: Sakana Fugu / Fugu Ultra Competitive Research
description: "Source: https://sakana.ai/fugu/ and https://sakana.ai/fugu-release/ (both fetched) Kind: Product — trained multi-agent orchestrator behind one API."
tags: [competitive, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Sakana Fugu / Fugu Ultra Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Compound models & productized routers
Source: https://sakana.ai/fugu/ and https://sakana.ai/fugu-release/ (both fetched)
Kind: Product — trained multi-agent orchestrator behind one API. GA **2026-06-22**.

## Positioning

Sakana's "**Multi-Agent System as a Model**" ("One Model to Command Them All"). A
pool of specialized models exposed as a single model behind one API, in two
variants: **Fugu** (balanced latency/performance) and **Fugu Ultra** (hard-task
quality). This is the most ambitious entry in this folder — not routing to one
model, but *learned coordination* of a team.

## Mechanism

Stronger than mere routing: the release page states **"Fugu is itself a language
model trained to call various LLMs in an agent pool"** — a *trained/learned*
orchestrator, not fixed workflows. It "learns to dynamically assemble agents from a
pool and coordinate them through non-obvious but highly efficient collaboration
patterns," managing **model selection, delegation, verification, and synthesis
internally**. Sakana cites two ICLR 2026 papers as the foundation: **TRINITY** (a
lightweight evolved coordinator with Thinker/Worker/Verifier roles) and
**Conductor** (RL-trained to discover natural-language coordination strategies).
Fugu Ultra "coordinates a deeper pool of expert agents to maximize answer quality."

## Verified Metrics

**All Sakana-reported (not independently benchmarked).** Competitor columns are
"provider-reported scores"; SWE Bench Pro used mini-swe-agent scaffolding. Selected
coding/reasoning rows — **Fugu | Fugu Ultra | Opus 4.8† | Gemini 3.1 Pro† | GPT 5.5†**:

- **SWE-Bench Pro:** 59.0 | 73.7 | 69.2 | 54.2 | 58.6
- **TerminalBench 2.1:** 80.2 | 82.1 | 74.6 | 70.3 | 78.2
- **LiveCodeBench:** 92.9 | 93.2 | 87.8 | 88.5 | 85.3
- **LiveCodeBench Pro:** 87.8 | 90.8 | 84.8 | 82.9 | 88.4
- **GPQA-D:** 95.5 | 95.5 | 92.0 | 94.3 | 93.6
- **Humanity's Last Exam:** 47.2 | 50.0 | 49.8 | 44.4 | 41.4

The one Fugu-side table was cross-checked with a second independent fetch of the
same page; overlapping rows matched exactly.

## Scope

**COMPOUND-ORCHESTRATION** — a trained coordinator assembles/verifies/synthesizes
across an internal agent pool per request. **OpenAI-compatible:** yes (single
endpoint; text+image, reasoning-effort levels, structured outputs, function
calling).

## Pricing / Availability (vendor-stated)

Fugu Ultra token plan **$5 in / $30 out per 1M** ($10/$45 for context >272K); Fugu
billed at the standard model rate with "no stacking when multiple agents active."
Subscriptions **$20 / $100 / $200 per month**. **Not available in EU/EEA** (GDPR
pending). Also reachable via OpenRouter and Vercel.

## UTK Relevance

The reference point for "compound model as a product." Fugu's trained-coordinator
approach is the opposite end of the spectrum from UTK's deterministic hook path, but
its **internal verification/synthesis** loop is conceptually the cascade
quality-estimator idea (see [`../cascade-routing/`](/techniques/model-routing/cascade-routing/overview.md)) productized
and learned. For UTK it is **reference/competitor**, not adoptable (it needs a
trained orchestrator and a hosted model pool). If UTK's proxy ever fronts multiple
models, Fugu is the bar the "quality mode" is measured against.

## Caveats

- **Every Fugu number is Sakana's own**; no independent third-party benchmark found.
- Competitor columns are provider-reported; SWE-Bench Pro used a specific scaffold —
  not an apples-to-apples harness.
- Closed product; EU/EEA unavailable; pricing is usage-metered.
