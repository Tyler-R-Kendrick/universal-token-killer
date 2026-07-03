---
type: paper
title: RoBoN Competitive Research
description: "Primary source: arXiv 2512.05542 — RoBoN: Routed Online Best-of-n for Test-Time Scaling with Multiple LLMs Repo: j-geuter/RoBoN, MIT (README is setup-only, no metrics) Verification: ✅ real paper —…"
resource: https://arxiv.org/abs/2512.05542
tags: [research, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# RoBoN Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Selective ensembling (routed best-of-n)
Primary source: arXiv **2512.05542** — *RoBoN: Routed Online Best-of-n for Test-Time Scaling with Multiple LLMs*
Repo: [`j-geuter/RoBoN`](https://github.com/j-geuter/RoBoN), MIT (README is setup-only, no metrics)
Verification: ✅ **real paper — the brief's "future-dated / likely hallucinated"
flag was wrong** (posted 2025-12-05, which is past relative to today 2026-07-02;
corroborated by OpenReview forum `H3N6zBj60L`). Authors Jonathan Geuter (Harvard
SEAS / Kempner Institute) & Gregor Kornhardt (TU Berlin). Venue: arXiv preprint,
under review — no accepted venue confirmed.

## Positioning

**Routed online best-of-n across multiple models.** Instead of drawing all n
best-of-n samples from one model, RoBoN spreads them across a pool to exploit
cross-model diversity — the "selective ensemble" done at the sample level.

## Mechanism

**Training-free** test-time scaling across multiple models. It routes generations
**one at a time** across a model pool, choosing the next model to sample from using
a **reward-model score plus an agreement signal** over already-generated responses.
It exploits cross-model diversity within a **fixed total sample budget** (compute
parity), rather than committing to one model's n samples up front.

## Verified Metrics

Authors' own claims (no independent benchmark), best-of-n at **n=256**:

- Up to **+3.4% absolute accuracy** over the best single-model best-of-n.
- **MATH500:** 0.838 vs 0.804. **OlympiadBench:** 0.411 vs 0.393. **MinervaMath:**
  0.323 vs 0.306. **GSM8K:** 0.968 vs 0.960. **MMLU-STEM:** 0.364 vs 0.355.
- Base LLMs: Qwen2.5-Math-7B-Instruct, DeepSeek-Coder-6.7B-Instruct, Llama-3.1-8B-
  Instruct, Qwen2.5-Coder-7B-Instruct; reward model: Skywork-Reward-V2-Llama-3.1-8B.

## Scope

**LATENCY-COMPUTE — and a scope correction.** RoBoN is **not** a token/cost saver:
it keeps compute **parity** and spends a fixed best-of-n budget *better* for more
accuracy. Do not present it as a savings technique.

## UTK Relevance

**Narrow.** Relevant only if `@utk/model-proxy` is **already** running best-of-n and
wants more accuracy per fixed budget. Two things stand out for UTK, though: it is
**training-free** (the routing needs no trained router, unlike BEST-Route/Zooter),
and its "diversify across models within a budget" idea is the principled version of
"don't fan out fully." Both come at the cost of an **external reward model** at
inference.

## Caveats

- **Not** a cost/token reduction — accuracy-per-compute only.
- Gains are largest at **large n (256)**; small at low n.
- Requires an **external reward model** at inference (added serving cost).
- Preprint, under review; very recent (2025-12).
