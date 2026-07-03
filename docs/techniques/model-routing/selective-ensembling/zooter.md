---
type: technique
title: Zooter Competitive Research
description: "Primary source: arXiv 2311.08692 — Routing to the Expert: Efficient Reward-guided Ensemble of Large Language Models Repo: none found (cited only in third-party \"awesome routing\" lists; no official…"
resource: https://arxiv.org/abs/2311.08692
tags: [techniques, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Zooter Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Selective ensembling (route-to-one-expert)
Primary source: arXiv **2311.08692** — *Routing to the Expert: Efficient Reward-guided Ensemble of Large Language Models*
Repo: none found (cited only in third-party "awesome routing" lists; no official Alibaba release located)
Verification: ✅ claimed ID correct (2023-11-15). **Venue: NAACL 2024** (Long
Papers, aclanthology 2024.naacl-long.109) — the brief omitted the venue. Authors
Keming Lu, Hongyi Yuan, Runji Lin, Junyang Lin et al. (**Alibaba, Qwen team**).

## Positioning

**Reward-guided expert routing.** The efficient alternative to reward-ranking every
model's output at inference: distill the reward model's judgment into a cheap router
once, then send each query to the single most-expert model — **no fanout**.

## Mechanism

**Offline**, an off-the-shelf **reward model** scores candidate outputs across a set
of training queries; those rewards are **distilled into a lightweight query router**
(with **InsTag** tag-based label enhancement to denoise supervision). **At inference
only the small router runs** (one forward pass) to pick the single most-expert
model, avoiding both N-way generation and per-output reward ranking.

## Verified Metrics

Authors' own claims, on an assembled collection of **26 subsets** = AlpacaEval (5) +
FLASK (10 domains) + MT-Bench (8) + Benchmarks (3):

- Outperforms the best single model on average and **"ranks first on 44% of
  tasks"** (a win-rate over the 26 subsets, **not** an accuracy figure).
- Matches/beats reward-model ranking while adding "only a minor computation overhead
  of a routing function."
- Ensembles **six open-source ~13B LLMs** (Llama-2-Chat, WizardLM, Vicuna, OpenChat,
  Qwen, WizardMath family).

## Scope

**COST-REDUCTION / COMPUTE** — routes to **one** model per query, eliminating N-way
fanout and per-output reward ranking at inference. A pure router, not inference-time
ensembling.

## UTK Relevance

The clean **"when NOT to fan out" baseline**: it shows you can capture most of an
ensemble's quality by routing to one latent expert, using the reward model only
**offline**. That "pay the expensive signal at build time, run cheap at inference"
pattern is a good model for `@utk/model-proxy` router construction.

## Caveats

- Models are **2023-era 13B-class** — absolute numbers are dated.
- "**44% of tasks**" is a win-rate over 26 subsets, not accuracy.
- **No official repo** found; trained router → not training-free.
