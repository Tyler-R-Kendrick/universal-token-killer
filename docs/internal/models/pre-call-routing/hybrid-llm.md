# Hybrid LLM Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Pre-call routing
Primary source: arXiv **2404.14618** — *Hybrid LLM: Cost-Efficient and Quality-Aware Query Routing*
Repo: none official located (Microsoft Research publication page only)
Verification: ✅ claimed ID correct (2024-04-22). **Venue confirmed: ICLR 2024**
(via official proceedings.iclr.cc PDF and iclr.cc virtual poster 19625). Authors
Dujian Ding (UBC) with Ankur Mallick, Chi Wang, Robert Sim, Subhabrata Mukherjee,
Victor Rühle, Ahmed Hassan Awadallah (Microsoft) and Laks V. S. Lakshmanan (UBC).

## Positioning

The clean **difficulty-aware binary router**: small (cheap/edge) vs large
(expensive/cloud), with an explicit **target quality knob**. The reference baseline
for any two-model router.

## Mechanism

A **DeBERTa-based router** scores each query's difficulty. Given a tunable target
quality level, it assigns the query to the small or large model. The quality knob
is adjustable **at test time** to slide along the cost/quality curve without
retraining the router. Difficulty labels for training are derived from **BART-score
quality gaps** between the two models.

## Verified Metrics

- "**up to 40% fewer calls to the large model, with no drop in response quality**"
  (abstract).

The specific small/large model pair and evaluation datasets are **not named in the
abstract**, so the 40% is not tied to a named benchmark at the primary-abstract
level. "No quality drop" is the authors' own claim.

## Scope

**COST-REDUCTION.** "40% fewer large-model calls" is **call-level** routing savings
(fewer expensive calls), not per-call token reduction.

## UTK Relevance

The minimal, legible baseline for `@utk/model-proxy`'s binary path — one router,
one quality knob. The **test-time-adjustable quality target** is the feature to
mirror: expose a single knob that trades proxy cost for quality without retraining.

## Caveats

- Router is **trained** (BART-score-derived difficulty labels) → not training-free.
- Headline metric lacks a named benchmark in the abstract; treat as an
  authors'-claim envelope, not a portable guarantee.
- No official code repo found — reimplementation required to benchmark.
