---
type: paper
title: BEST-Route Competitive Research
description: "Primary source: arXiv 2506.22716 — BEST-Route: Adaptive LLM Routing with Test-Time Optimal Compute Repo: microsoft/best-route-llm, MIT (also hosts the earlier Hybrid LLM work) Verification: ✅…"
resource: https://arxiv.org/abs/2506.22716
tags: [research, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# BEST-Route Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Selective ensembling
Primary source: arXiv **2506.22716** — *BEST-Route: Adaptive LLM Routing with Test-Time Optimal Compute*
Repo: [`microsoft/best-route-llm`](https://github.com/microsoft/best-route-llm), MIT (also hosts the earlier Hybrid LLM work)
Verification: ✅ claimed ID correct (2025-06-28). **Venue: ICML 2025** (poster
#43788; PMLR v267 ding25d). Authors Dujian Ding, Ankur Mallick, Victor Rühle
(Microsoft) with Laks V. S. Lakshmanan (UBC) — same lineage as Hybrid LLM.

## Positioning

The bridge between **routing** and **test-time scaling**: instead of just picking a
model, BEST-Route also picks **how many samples** to draw from a cheap model —
because drawing several cheap samples and keeping the best can beat one expensive
call at lower cost.

## Mechanism

A router predicts, **per query**, both **which model** to use **and how many
responses to sample** from a small model, then selects the best sample via a
**reward/quality scorer**. Compute is allocated adaptively to query difficulty: easy
queries get one cheap sample, hard ones get more (or escalate).

## Verified Metrics

Authors' own claims, on their assembled 10K-instruction test set (QA from
MixInstruct; coding from RewardBench + CodeUltraFeedback; safety from RewardBench +
BeaverTails):

- "**60% cost reduction with 0.8% quality drop**" vs always-GPT-4o (in-distribution).
- **MT-Bench (out-of-distribution):** **60% cost reduction at 1.59% drop.**
- Small models: Llama-3.1-8B, Mistral-7B, Mixtral-8x7B, Phi-3-mini/medium,
  Codestral-22B; reference = GPT-4o.

Note: the "**<1% drop**" headline is the **in-distribution** figure (0.8%); OOD
MT-Bench is 1.59%, so "<1%" is not universal.

## Scope

**COST-REDUCTION** — cuts `$/query` by routing to cheap-model multi-sampling instead
of the expensive reference model.

## UTK Relevance

**Most relevant selective-ensembling technique for UTK.** It is a concrete
`@utk/model-proxy` escalation policy: prefer *N cheap samples + a scorer* over one
expensive call, and let difficulty set N. It includes a **coding** slice
(CodeUltraFeedback) in its eval, unlike most routers. The reward/quality **scorer**
is the same "quality estimator" the cascade papers say is decisive — and its cost
must be counted.

## Caveats

- Benchmark is the authors' **own assembled dataset**, not a named third-party
  leaderboard.
- "<1% drop" holds **in-distribution only**; OOD is ~1.6%.
- Router + scorer are **trained** → not training-free; the scorer adds inference
  cost that must stay below the savings.
