# ParetoBandit Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Routing research
Primary source: arXiv **2604.00136** — *ParetoBandit: Budget-Paced Adaptive Routing for Non-Stationary LLM Serving*
Repo: [`ParetoBandit/ParetoBandit`](https://github.com/ParetoBandit/ParetoBandit) (code Apache-2.0; paper CC BY 4.0)
Verification: ✅ claimed ID correct (v1 2026-03-31, v2 2026-04-14). Single author
Annette Taberner-Miller. arXiv preprint (cs.LG), no venue.

## Positioning

Routing as a **cost-aware contextual bandit** with a **hard per-request dollar
ceiling** and adaptation to models/prices that change over time — the online-serving,
budget-enforcement angle.

## Mechanism

Two core contributions: (1) an **online primal–dual budget pacer** that enforces a
per-request cost ceiling **without a known horizon**; (2) **geometric forgetting** on
sufficient statistics giving **bounded memory** to track quality/cost shifts. Adds a
**hot-swap model registry** for runtime model changes with budget-controlled
exploration.

## Verified Metrics

Authors' own (not independently benchmarked): on **1,824 benchmark prompts** with a
**3-model portfolio** spanning **~530× cost range** — budget compliance within
**0.4%**; up to **+0.071 quality lift** after price/quality shifts; a cold-started
model integrated within **~142 steps**.

## Scope

**COST-REDUCTION (dollar cost-ceiling enforcement)** with **routing-robustness**
(non-stationary adaptation) effectively co-primary. Note the framing is budget-ceiling
*enforcement* + online adaptation, **not** raw cost-minimization vs a baseline.

## UTK Relevance

The mechanism for "spend at most $X/request" at the proxy layer, and the online-
adaptation counterpart to C3PO's conformal budget bound (which is offline/cascade). If
`@utk/model-proxy` ever needs a live cost ceiling across a shifting model pool, this is
the reference. Lower priority than the coding-specific routers, but the **hot-swap +
budget-paced exploration** is a clean pattern for absorbing new frontier models safely.

## Caveats

- Single-author preprint; minor ID/date boundary anomaly (2604 prefix vs "31 Mar").
- Metrics are the author's own on a 3-model portfolio.
