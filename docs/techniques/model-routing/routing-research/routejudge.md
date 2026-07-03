---
type: technique
title: RouteJudge Competitive Research
description: "Primary source: arXiv 2606.18774 — RouteJudge: An Open Platform for Reproducible and Preference-Aware LLM Routing Repo: describes the ORBIT toolbox + platform routejudge.cn; derivable code URL…"
resource: https://arxiv.org/abs/2606.18774
tags: [techniques, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# RouteJudge Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Routing research (evaluation)
Primary source: arXiv **2606.18774** — *RouteJudge: An Open Platform for Reproducible and Preference-Aware LLM Routing*
Repo: describes the **ORBIT** toolbox + platform `routejudge.cn`; derivable code URL `AIGNLAI/LAMDA-ORBIT` **404s — code UNVERIFIED**
Verification: ✅ **real, despite no arXiv ID in the brief** (submitted 2026-06-17).
Authors Guannan Lai, Haoran Hu, Han-Jia Ye (**LAMDA, Nanjing University** — same group
as EquiRouter). CC BY 4.0.

## Positioning

The **router-evaluation** entry: a platform that measures router *decision quality*
(did it pick the right model?) rather than model response quality. The reminder that
"which router is best" is itself an open, under-measured question.

## Mechanism

An **online pairwise-preference** evaluation platform. Each router is treated as a
**black box** that, given the same query / model pool / budget, recommends one model;
RouteJudge compares the selected models' outputs via **anonymous pairwise human votes**
and attributes the preference signal **back to the routers** — measuring router-level
decision quality, not model-level response quality. Packaged as **ORBIT** (Optimal
Routing and Budgeted Inference Toolbox).

## Verified Metrics

Descriptive only (it is an eval platform, not a method): **17 candidate models**, **20
routing strategies**, **261 matches / 109 user votes** recorded at time of writing. No
performance metric.

## Scope

**Routing-eval** — infrastructure for comparing routers, not a routing method.

## UTK Relevance

If UTK ever ships a router in `@utk/model-proxy`, "how do we know it's actually good?"
is exactly what RouteJudge formalizes. Its **black-box, same-budget, pairwise-vote**
protocol is a template for a UTK router eval harness (alongside RouterBench /
LLMRouterBench). Lower immediate priority, but the right mental model for not shipping
an unmeasured router.

## Caveats

- **Name collision:** a separate OpenReview "RouteJudge" benchmarks *LLM-as-a-judge
  with routing strategies* (routing among judges) — a different paper, **not** verified
  here. Cite only this arXiv routing-evaluation platform.
- The **ORBIT/RouteJudge code repo 404s** — treat code as not-yet-verifiably-public.
- `routejudge.cn` platform not fetched.
