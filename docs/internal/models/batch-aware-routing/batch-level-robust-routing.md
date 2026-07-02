# Batch-Level Robust Routing Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Batch-aware routing (capacity-constrained serving)
Primary source: arXiv **2603.26796** — *Robust Batch-Level Query Routing for Large Language Models under Cost and Capacity Constraints*
Repo: none found
Verification: ✅ **real paper — the brief's "likely fabricated" flag was wrong.**
Submitted 2026-03-25. **Venue: ACM CAIS 2026** (inaugural ACM Conference on AI and
Agentic Systems, San Jose, 2026-05-26/29; DOI 10.1145/3786335.3813134) —
independently confirmed real. Authors Jelena Markovic-Voronov, Kayhan Behdin, Rahul
Mazumder et al. (**LinkedIn + MIT**). dblp lists it as both the CAIS 2026 paper and
a CoRR preprint.

## Positioning

Production-serving routing: route at the **batch level (not per query)**, jointly
optimizing model assignment under **cost + model-capacity (GPU/concurrency)**
limits, with a **robust** variant for uncertainty in predicted performance.

## Mechanism

Assigns models per **batch** rather than per query, optimizing quality under both a
cost budget and per-model capacity constraints. Adds a **robust** formulation that
handles uncertainty in the predicted LLM performance, plus an **offline
instance-allocation** step balancing quality vs throughput.

## Verified Metrics

Authors' own claims, on two multi-task routing benchmarks (Song et al. 2025 set:
MMLU, CMMLU, ACLUE, ARC-C, HotpotQA, SQuAD, MATH, MBPP; Hu et al. 2024 / RouterBench
set):

- **Robustness:** **+1–14%** accuracy (up to 1.2% on set 1; up to 1.7% for kNN-5 and
  **14.4% for kNN-40** on set 2).
- **Batch-level vs per-query:** up to **24% under adversarial batching** (24% set 1
  / 15.8% set 2; ~4% / 1.7% under random batching).
- **Instance allocation:** **+2.7% (set 1) / +3.2% (set 2)**.

## Scope

**COST-REDUCTION + CAPACITY.** Note: this paper is as much about **GPU-capacity and
robustness** as about shared-prompt token amortization — less directly a
token-savings method than Batch Prompting or RoBatch.

## UTK Relevance

Reference for the **serving/capacity** end of batch routing: if `@utk/model-proxy`
ever routes under real GPU/concurrency limits, this is the primary source for
batch-level (vs per-query) assignment and for **robustness to noisy performance
predictions** — which connects to the master README's "the router has a cost / the
estimator can be wrong" cautions.

## Caveats

- More about **capacity/robustness** than prompt-token savings — do not cite it as a
  token-reduction result.
- **No repo**; trained routers → not training-free.
- Very recent (2026-03); ACM CAIS is a brand-new venue.
