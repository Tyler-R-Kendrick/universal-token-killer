---
type: paper
title: R2-Router Competitive Research
description: "Primary source: arXiv 2602.02823 — R2-Router: A New Paradigm for LLM Routing with Reasoning Repo: none stated in the paper Verification: ✅ claimed ID correct (v1 2026-02-02, v2 2026-05-29)."
resource: https://arxiv.org/abs/2602.02823
tags: [research, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# R2-Router Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Routing research
Primary source: arXiv **2602.02823** — *R2-Router: A New Paradigm for LLM Routing with Reasoning*
Repo: none stated in the paper
Verification: ✅ claimed ID correct (v1 2026-02-02, v2 2026-05-29). Authors Jiaqi Xue,
Qian Lou, Jiarong Xing, Heng Huang. arXiv preprint. **The brief's description is
accurate** — despite the "with Reasoning" title, the paper *does* jointly route
model + output-length budget (the feared title/mechanism mismatch does not exist).

## Positioning

The most useful new lever for coding agents in this folder: route **not just the
model but the output-length budget**, because a **short answer from a strong model can
beat a long answer from a weak model at the same cost**.

## Mechanism

Frames **"routing as reasoning"** — the router reasons about the quality each LLM can
achieve under **different output lengths**, then **jointly selects the best LLM and an
output-length budget**, enforcing the budget via length-constrained instructions. This
exposes model×length configurations invisible to prior model-only routers.

## Verified Metrics

Authors' own, on **R2-Bench** (their **self-introduced** dataset: 30,968 queries, 20
categories, 6 benchmarks): "**state-of-the-art performance at 4–5× lower cost**
compared with existing routers." AUDC (area under the cost–quality curve) improves
**0.85 → 0.98**; trains in **~20 min on a single GPU**; dynamic-pool integration
yields **AUDC +5%, cost −80%**. Cites Qwen3-235B for the "strong-model-constrained
beats weak-model" effect.

## Scope

**Model + output-length budget** joint routing (a COST-REDUCTION lever with a second
axis prior routers lack).

## UTK Relevance

**Highly relevant to `@utk/model-proxy` for coding agents.** It formalizes something
UTK cares about on both axes: model choice *and* output length are cost levers, and
they interact. Pairs naturally with the reasoning-token-control work in the
[watchlist §7–8](/techniques/landscape-watchlist.md) (Chain-of-Draft,
budget-aware stopping) — R2-Router picks the length budget at *route* time, those pick
it at *generate* time. The "short strong-model answer beats long weak-model answer"
insight is a direct argument for coupling UTK's model routing with output budgets.

## Caveats

- The headline **4–5×** is on the authors' **self-introduced R2-Bench** — a
  self-defined evaluation, not a neutral leaderboard.
- **No public repo** stated in the paper.
