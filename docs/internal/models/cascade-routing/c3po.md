# C3PO Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Cascade routing (cost-constrained)
Primary source: arXiv **2511.07396** — *C3PO: Optimized Large Language Model Cascades with Probabilistic Cost Constraints for Reasoning*
Repo: [`AntonValk/C3PO-LLM`](https://github.com/AntonValk/C3PO-LLM) — **no declared license (all-rights-reserved)**, ~5 stars
Verification: ✅ **GENUINE paper — the brief's "possibly hallucinated" flag was
wrong.** Submitted 2025-11-10, **accepted at NeurIPS 2025** (confirmed via
neurips.cc + OpenReview). Relative to today (2026-07-02) it is a valid past
publication; the "future-dated" worry was an artifact of the brief predating the
submission. Authors Antonios Valkanas, Pavel Rumiantsev, Mark Coates (McGill) with
Soumyasundar Pal, Yingxue Zhang (Huawei Noah's Ark Lab, Montréal).

## Positioning

The cascade with an **explicit probabilistic cost ceiling**. Where FrugalGPT and
Cascade Routing optimize expected cost, C3PO **bounds the probability** that a
single query blows the budget — relevant when you need a hard-ish cost guarantee,
not just best-effort.

## Mechanism

**Self-supervised cascade optimization.** Learns per-model **early-exit thresholds
from unlabeled model outputs** by measuring agreement between cheaper models and
the **most-powerful model (MPM)** — no ground-truth labels needed. Adds **conformal
prediction** to bound, at confidence level α (e.g. 5–10%), the probability that
per-query inference cost exceeds a user-specified budget; **PAC-Bayes** bounds
certify the decision rules generalize.

## Verified Metrics

- **MATH-500**, LLaMA cascade (authors' claim vs their own baselines): C3PO reaches
  **62.5% accuracy at $0.0019/question**, whereas **self-consistency (SC) using the
  MPM gets 57% at $0.0053/question**. (SC = self-consistency; MPM = most powerful
  model.)
- Also evaluated on **GSM8K, BigBench-Hard (SNARKS, DATE), and AIME** — on AIME
  reported as near-max model accuracy at ~1/3 the cost (from figures). Only the
  **MATH-500 point is cleanly quotable**; the rest live in figures/appendices.
- All comparisons are against the authors' SC/MPM baselines; no named independent
  benchmark.

## Scope

**COST-REDUCTION** (bounding/optimizing dollar inference cost under a probabilistic
budget), secondarily LATENCY-COMPUTE.

## UTK Relevance

The **conformal cost-budget guarantee** is the novel angle vs FrugalGPT / Cascade
Routing, and it maps onto a real proxy need: a caller who wants "spend at most $X/
task with 95% confidence." The **self-supervised, label-free threshold learning**
(agreement between cheap models and the MPM) is attractive because it does not need
a labeled dataset — a partial answer to the "router has a cost" problem.

## Caveats

- **Reasoning-focused** (math/logic); relevance to a coding-agent *token* layer is
  indirect — track the mechanism, not the MATH-500 number.
- Repo has **no license** despite the paper saying "we make our code available" —
  treat as all-rights-reserved; real adoption caveat.
