---
type: technique
title: OptLLM Competitive Research
description: "Primary source: arXiv 2405.15130 — OptLLM: Optimal Assignment of Queries to Large Language Models Repo: LLMs-EffiUse-Lab/OptLLM (mirror superyue72/OptLLM) — no LICENSE file (all-rights-reserved by…"
resource: https://arxiv.org/abs/2405.15130
tags: [techniques, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# OptLLM Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Pre-call routing
Primary source: arXiv **2405.15130** — *OptLLM: Optimal Assignment of Queries to Large Language Models*
Repo: [`LLMs-EffiUse-Lab/OptLLM`](https://github.com/LLMs-EffiUse-Lab/OptLLM) (mirror `superyue72/OptLLM`) — **no LICENSE file (all-rights-reserved by default)**, ~1 star
Verification: ✅ claimed ID correct (2024-05-24). **Venue: ICWS 2024** (IEEE Intl.
Conference on Web Services). Authors Yueyue Liu, Hongyu Zhang et al. (Chongqing
Univ. / Univ. of Newcastle, Australia).

## Positioning

**Multi-objective query allocation** — instead of one router threshold, OptLLM
returns a whole Pareto frontier of query→model assignments and lets the operator
pick a point by budget.

## Mechanism

A **multi-label classifier with uncertainty estimation** predicts each candidate
LLM's per-query performance. A **destroy-and-reconstruct multi-objective search**
then produces a non-dominated (Pareto) set of assignment plans spanning
max-accuracy to min-cost. The operator selects a plan on the frontier for their
budget/quality preference.

## Verified Metrics

- "reduces costs by **2.40% to 49.18%** while achieving the **same accuracy as the
  best LLM**" (matches the brief exactly).
- vs other multi-objective algorithms: "**+2.94% to 69.05% accuracy** at the same
  cost," or "saves **8.79% to 95.87% cost** while maintaining highest attainable
  accuracy."
- Benchmarks: **AGNEWS, COQA, HEADLINES, SCIQ** across **12 LLMs** (OpenAI / AI21 /
  Anthropic / EleutherAI) plus a log-parsing task (LogPai, 8 LLM APIs). The
  2.40–49.18% range **spans these datasets** — it is not one benchmark.

## Scope

**COST-REDUCTION.** Assigns each query to the cheapest model that meets the
accuracy target; not token reduction.

## UTK Relevance

The **Pareto-frontier framing** is the useful idea: rather than a single cost knob,
`@utk/model-proxy` could expose a small menu of assignment policies and let the
caller choose by budget. Lower priority than RouteLLM/FrugalGPT as a direct
precedent.

## Caveats

- Requires a **trained per-query performance predictor** → not training-free.
- Repo is **effectively unlicensed** (LICENSE 404s) — treat as all-rights-reserved;
  flag before any code reuse.
- The wide metric ranges are cross-dataset envelopes, not portable guarantees.
