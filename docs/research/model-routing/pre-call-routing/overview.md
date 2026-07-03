---
type: category
title: Pre-Call Routing
description: "Choose the cheapest capable model before generation using a query-scoring router (RouteLLM, Hybrid LLM, OptLLM, UniRoute)."
tags: [research, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Pre-Call Routing

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Layer definition:** choose the cheapest capable model *before* generation, from
a **fixed** (or, for UniRoute, dynamic) pool, using a router that scores the
query. One-shot model choice — no escalation loop (that is
[`../cascade-routing/`](/research/model-routing/cascade-routing/overview.md)).

**Scope:** all four techniques here are **COST-REDUCTION** — they cut expected
`$/task` by sending each query to a cheaper model, not by reducing token count.
All four require a **trained router** (none is training-free), which is the main
tension with UTK's model-agnostic hook path; they belong at the
`@utk/model-proxy` model-selection layer.

| Technique | Primary source | Verified | Router input | Headline (authors' own) |
|---|---|---|---|---|
| [RouteLLM](/research/model-routing/pre-call-routing/routellm.md) | arXiv 2406.18665 | ✅ ID correct | Human preference data | ">2× cost cut" (abstract); "85% cost cut at 95% GPT-4 on MT-Bench" (README) |
| [Hybrid LLM](/research/model-routing/pre-call-routing/hybrid-llm.md) | arXiv 2404.14618 (ICLR 2024) | ✅ ID correct | Predicted query difficulty | "up to 40% fewer large-model calls, no quality drop" |
| [OptLLM](/research/model-routing/pre-call-routing/optllm.md) | arXiv 2405.15130 (ICWS 2024) | ✅ ID correct | Per-query performance prediction | "2.40%–49.18% cost cut at best-LLM accuracy" |
| [Universal Model Routing](/research/model-routing/pre-call-routing/universal-model-routing.md) | arXiv 2502.08773 | ✅ ID correct | Model feature vectors | Qualitative only — routes 30+ **unseen** LLMs |

**UTK read:** RouteLLM and OptLLM are the canonical fixed-pool routers to
benchmark `@utk/model-proxy` against; Hybrid LLM is the cleanest binary
small/large baseline; UniRoute is the most operationally interesting because
adding a new model needs only representative-prompt evaluation (no router
retraining) — closest to something UTK could host without frontier training.
