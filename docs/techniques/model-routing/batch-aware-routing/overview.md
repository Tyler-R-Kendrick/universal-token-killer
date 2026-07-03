---
type: category
title: Batch-Aware Routing
description: "Amortize repeated system/tool prompt tokens by batching multiple queries into one call and routing at batch level (Batch Prompting, RoBatch)."
tags: [techniques, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Batch-Aware Routing

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Layer definition:** amortize the **repeated system/tool prompt tokens** across
multiple queries by **batching** them into one call, and (for the newer papers)
jointly choose the **model and the batch size**. This is the layer **most aligned
with UTK's token axis**: a shared system/tool prompt paid **once per batch instead
of once per query** is a genuine token reduction, not just a `$/task` win — and
UTK's fixed tool-schema + system context is exactly the "shared prefix" that
dominates per-call cost.

**Scope:** COST-REDUCTION with a **real token component** (unlike pure routing).
Caveat: batching needs **multiple independent queries available at once**
(throughput/serving setting) — relevant to the `@utk/model-proxy` batch surface,
less to a single interactive coding-agent turn.

**Verification note:** the brief flagged both 2026-dated papers as likely
fabricated. They are **real** — the "future-dated" worry was wrong because today is
2026-07-02, so March/May 2026 papers are in the past. Confirmed via arXiv + dblp +
ACM + manual PDF-stream extraction (see [master Verification
Status](/techniques/model-routing/overview.md#verification-status) for the one honest caveat).

| Technique | Primary source | Verified | Role |
|---|---|---|---|
| [Batch Prompting](/techniques/model-routing/batch-aware-routing/batch-prompting.md) | arXiv 2301.08721 (EMNLP 2023) | ✅ rock-solid anchor | Pack K queries into one prompt; shared exemplars paid once |
| [RoBatch](/techniques/model-routing/batch-aware-routing/robatch.md) | arXiv 2605.28268 | ✅ real (2026-05) | Jointly route **model + batch size** under a cost budget |
| [Batch-level robust routing](/techniques/model-routing/batch-aware-routing/batch-level-robust-routing.md) | arXiv 2603.26796 (ACM CAIS 2026) | ✅ real (2026-03) | Route per **batch** under cost **and GPU-capacity** limits |

**UTK read:** **Batch Prompting (Cheng et al.) is the anchor to lean on** — it is
the rock-solid EMNLP 2023 foundation and the only one predating any date ambiguity.
RoBatch is the single closest published match to a "batch-aware routing" feature
(joint model + batch-size). The LinkedIn/MIT batch-level paper is more about GPU
capacity/robustness than raw prompt-token amortization. All three are `@utk/model-
proxy` batch-surface references; none is training-free (all use trained routers/
proxies).
