---
type: category
title: Decode-Time Routing (Speculative Decoding)
description: Speculative decoding and decode-time methods that cut self-hosted latency but not billable API tokens.
tags: [techniques, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Decode-Time Routing (Speculative Decoding)

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Layer definition:** reduce **self-hosted decode latency/compute** by using a fast
draft model to propose tokens and the target model to verify them. **This does not
reduce billable hosted-API tokens** — it is included here for completeness and for
the `@utk/model-proxy` self-hosting story, not as a UTK token win.

**The scope thesis (verify before ever citing a number here):** speculative
decoding is **provably output-identical** to normal decoding, so it emits the exact
same token sequence the target would. It can only move **self-hosted wall-clock /
GPU compute** — it is **structurally incapable** of reducing the input+output token
count that Copilot / OpenAI / Anthropic bill, and it requires **draft + target logit
access** that hosted APIs do not expose to a mediation layer like UTK. If a hosted
provider uses speculative decoding server-side, it is invisible to and
unbillable-through UTK.

See [`speculative-decoding.md`](/techniques/model-routing/decode-time-routing/speculative-decoding.md) for the full write-up
(two foundational anchors + the "Decoding Speculative Decoding" study + the two
"collaborative decoding" variants and the category error the brief made about
them).

| Paper | arXiv | Verified | Scope |
|---|---|---|---|
| Fast Inference via Speculative Decoding (Leviathan et al., Google, ICML 2023) | 2211.17192 | ✅ anchor | LATENCY-COMPUTE (lossless) |
| Accelerating LLM Decoding w/ Speculative Sampling (Chen et al., DeepMind) | 2302.01318 | ✅ anchor | LATENCY-COMPUTE (lossless) |
| Decoding Speculative Decoding (Yan et al., NAACL 2025) | 2402.01528 | ✅ ID correct | LATENCY-COMPUTE |
| CoSD: Speculate, then Collaborate (ICML 2025) | 2502.08020 | ✅ (maps to brief's "collaborative") | **Quality fusion, not latency** |
| CoS: Fast LLM Collaborative Decoding via Speculation | 2502.01662 | ✅ latency sibling | LATENCY-COMPUTE |

**UTK read:** **reference-only.** Matters to `@utk/model-proxy` throughput/latency
*if UTK ever self-hosts models*, never to the Copilot billable-token path — the same
discipline the [watchlist](/techniques/landscape-watchlist.md) applies
to KV-cache (§11). The brief conflated two different "collaborative" papers: CoSD is
a **quality** technique (adds compute), CoS is the **speed** one.
