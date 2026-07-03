---
type: category
title: Selective Ensembling
description: "Use ensemble or best-of-n only when the marginal quality gain beats the added cost (BEST-Route, RoBoN, Zooter)."
tags: [research, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Selective Ensembling

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Layer definition:** use ensemble / best-of-n / multi-sample test-time compute
**adaptively** — only as much as the query needs — rather than a fixed fanout. This
sits between pre-call routing (one model, one sample) and full ensembling (always
fan out). The techniques here differ in scope, so read them individually:

| Technique | Primary source | Verified | What it selects | Scope |
|---|---|---|---|---|
| [BEST-Route](/research/model-routing/selective-ensembling/best-route.md) | arXiv 2506.22716 (ICML 2025) | ✅ ID correct | Model **and** number of samples | **COST-REDUCTION** |
| [Zooter](/research/model-routing/selective-ensembling/zooter.md) | arXiv 2311.08692 (NAACL 2024) | ✅ ID correct | One expert model per query (no fanout) | **COST-REDUCTION / COMPUTE** |
| [RoBoN](/research/model-routing/selective-ensembling/robon.md) | arXiv 2512.05542 | ✅ **real, not hallucinated** | Which model to draw each best-of-n sample from | **LATENCY-COMPUTE** (accuracy-per-compute, *not* a cost/token saver) |

**Scope correction worth flagging:** RoBoN is **not** a cost/token reducer — it
keeps compute **parity** and spends a fixed best-of-n budget *better* for more
accuracy. Only BEST-Route and Zooter cut cost. Do not present RoBoN as a savings
technique.

**UTK read:** **BEST-Route is the most relevant** — it bridges routing with
test-time scaling (cheap-model multi-sampling can beat one big-model call at lower
cost), which is a concrete `@utk/model-proxy` escalation policy. **Zooter** is the
clean "route to one expert, don't fan out" baseline. **RoBoN** only matters if UTK
is *already* running best-of-n and wants more accuracy per fixed budget — and it
adds an external reward model's serving cost. BEST-Route and Zooter use **trained
routers**; RoBoN's routing is **training-free** (but leans on a pretrained external
reward model).
