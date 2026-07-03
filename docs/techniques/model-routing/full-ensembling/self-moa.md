---
type: technique
title: Self-MoA Competitive Research
description: "Primary source: arXiv 2502.00674 — Rethinking Mixture-of-Agents: Is Mixing Different Large Language Models Beneficial?"
resource: https://arxiv.org/abs/2502.00674
tags: [techniques, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Self-MoA Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Full ensembling (skeptical control)
Primary source: arXiv **2502.00674** — *Rethinking Mixture-of-Agents: Is Mixing Different Large Language Models Beneficial?*
Repo: [`wenzhe-li/Self-MoA`](https://github.com/wenzhe-li/Self-MoA) — license unspecified
Verification: ✅ claimed ID correct (2025-02-02). **Title correction:** the brief
gave only the subtitle ("Is Mixing Different Large Language Models Beneficial?"); the
full title is *Rethinking Mixture-of-Agents: Is Mixing Different Large Language
Models Beneficial?* Authors Wenzhe Li, Yong Lin, Mengzhou Xia, Chi Jin (Princeton).
Venue: arXiv preprint with an OpenReview record (forum `ioprnwVrDH`); published venue
not confirmed on fetched pages.

## Positioning

The **skeptical control** for the whole full-ensembling layer. It argues that
**mixing different LLMs often lowers average agent quality**, and that aggregating
multiple samples from a **single top-performing model** (Self-MoA) usually beats
heterogeneous MoA. This is the most important corrective paper in this folder.

## Mechanism

Frames a **quality–diversity trade-off**: heterogeneous mixing only helps when the
mixed models are **individually strong and complementary**; otherwise the weaker
agents drag down the ensemble. Self-MoA drops the model mixing and instead
aggregates many **samples from one strong model**.

## Verified Metrics

All from the arXiv HTML / repo (authors' own claims):

- **AlpacaEval 2.0 (LC):** Self-MoA + WizardLM-2-8x22B **65.7%** vs standard 2-layer
  mixed-MoA **59.1%** → **+6.6 pp**.
- New SOTA config: Self-MoA + gemma-2-9b-it-WPO-HB **78.5% LC** (top leaderboard);
  gemma-2-9b-it-SimPO 75.0% LC.
- **+3.8% average** across MMLU / CRUX / MATH using task-best models: MMLU 69.01 vs
  68.90; CRUX 50.75 vs 47.00; MATH 69.80 vs 67.62 (Self-MoA vs best mixed-MoA).

**Do not conflate:** the +6.6 pp is specifically Self-MoA(WizardLM-2-8x22B) vs
2-layer mixed-MoA; the 78.5% SOTA uses a **different** base model
(gemma-2-9b-it-WPO-HB).

## Scope

**TOKEN-INCREASING** quality technique (still many samples from one model), **but
the most cost-relevant of the three** in this folder: its thesis removes the
multi-**model** hosting overhead of MoA/LLM-Blender. The 6.6 pp is an AlpacaEval LC
**gain**, not a token saving.

## UTK Relevance

**Directly supports UTK's stance.** Self-MoA is published evidence that
heterogeneous ensembling frequently does **not** justify its cost — the empirical
backbone for "gate ensembling, don't default it." If UTK ever exposes an
escalation-time best-of-n, this argues for **single-model sampling** over
multi-model fanout unless the models are demonstrably complementary.

## Caveats

- Still more expensive than a single pass; not a token optimizer.
- License unspecified — flag before reuse.
- Author self-reported metrics; no independent benchmark on fetched pages.
