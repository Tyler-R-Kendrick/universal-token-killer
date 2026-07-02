# Mixture-of-Agents (MoA) Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Full ensembling
Primary source: arXiv **2406.04692** — *Mixture-of-Agents Enhances Large Language Model Capabilities*
Repo: [`togethercomputer/MoA`](https://github.com/togethercomputer/MoA), Apache-2.0
Verification: ✅ claimed ID correct (2024-06-07). Authors Junlin Wang et al. (Duke,
**Together AI**, Univ. of Chicago, Stanford). Venue: arXiv preprint (no published
venue surfaced on fetched pages).

## Positioning

The canonical **layered multi-agent ensemble** — the maximal "ensemble everything"
architecture, and the one the master README singles out as **token-multiplying**.

## Mechanism

A **layered architecture**: each layer has multiple LLM "agents," and **every agent
in a layer receives all outputs from the previous layer** as auxiliary context
before generating, iteratively aggregating/refining. Uses only open-source models.
The per-layer re-consumption of all prior outputs is exactly what multiplies token
spend.

## Verified Metrics

All from the arXiv HTML / repo (authors' own claims):

- **AlpacaEval 2.0 (LC win rate):** MoA **65.1 ± 0.6%** vs **GPT-4 Omni 57.5%**;
  MoA-Lite **59.3 ± 0.2%** (still beats GPT-4 Omni).
- **MT-Bench:** MoA **9.25 ± 0.10** average; "MoA w/ GPT-4o" **9.40 ± 0.06**.
- **FLASK:** reported SOTA across dimensions, no single headline number.

## Scope

**TOKEN/COST-INCREASING quality technique.** The multi-layer design where each
layer re-consumes all prior outputs multiplies token spend per query — explicitly a
quality amplifier, not an optimization. **MoA-Lite** is the cost-reduced variant but
still ensembles.

## UTK Relevance

**Reference-only**, as the archetype of what UTK should *not* enable by default. It
is the concrete example behind the "ensemble fanout" caution: MoA consumes each
other's outputs across layers, so cost grows with depth × width. Track it as a
competitor quality play, never as a UTK token win.

## Caveats

- Numbers are authors' own AlpacaEval 2.0 / MT-Bench / FLASK claims; no independent
  benchmark on the fetched pages.
- MoA-Lite reduces but does not eliminate the fanout cost.
