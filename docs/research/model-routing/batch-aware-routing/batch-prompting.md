---
type: paper
title: Batch Prompting Competitive Research (category anchor)
description: "Primary source: arXiv 2301.08721 — Batch Prompting: Efficient Inference with Large Language Model APIs Repo: xlang-ai/batch-prompting (official) Verification: ✅ claimed ID correct (2023-01-19, rev."
resource: https://arxiv.org/abs/2301.08721
tags: [research, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Batch Prompting Competitive Research (category anchor)

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Batch-aware routing (foundation)
Primary source: arXiv **2301.08721** — *Batch Prompting: Efficient Inference with Large Language Model APIs*
Repo: [`xlang-ai/batch-prompting`](https://github.com/xlang-ai/batch-prompting) (official)
Verification: ✅ claimed ID correct (2023-01-19, rev. 2023-10-24). **Venue: EMNLP
2023 Industry Track.** Authors Zhoujun Cheng, Jungo Kasai, Tao Yu (xlang-ai / HKU).
The rock-solid, well-cited foundation of this category.

## Positioning

The original **batch prompting** technique and the anchor UTK should cite for this
layer: pack multiple samples into a single prompt so the shared few-shot
exemplars/instructions are paid **once for K questions** instead of K times.

## Mechanism

Group K independent samples into one prompt with the shared instruction/exemplar
prefix stated once; the model answers all K in one completion. Token (and time) cost
per sample drops **roughly inverse-linearly with batch size** until context or
accuracy limits bite.

## Verified Metrics

Authors' own claims, with benchmarks:

- Up to **5× token AND time cost reduction at batch size b=6** — the 5× headline
  comes from **simpler/shorter datasets**, not GSM8K.
- **GSM8K / Codex (code-davinci-002):** accuracy **55.7% → 58.7%**; token cost per
  sample **~8.78 → ~3.61 at b=6** (**~2.4×** on GSM8K specifically).
- Ten datasets: CommonsenseQA, StrategyQA, GSM8K, SVAMP, AQuA, AddSub, MultiArith,
  RTE, MNLI, SST-5. Models: Codex, GPT-3 (text-davinci-003), GPT-3.5-turbo, GPT-4.

## Scope

**COST-REDUCTION with a genuine TOKEN component** — the shared prompt prefix is
literally billed once per batch, so input tokens per sample fall. This is the
closest thing in the whole `models/` folder to UTK's own token axis.

## UTK Relevance

**Most on-axis technique in this folder.** UTK's fixed **tool-schema + system
context** is the exact "shared prefix" batch prompting amortizes. For the
`@utk/model-proxy` batch/serving surface, batch prompting is a directly applicable
token win — and it composes with UTK compression (compress the shared prefix, then
amortize it). Complements, not competes with, provider prompt caching (which
amortizes a stable prefix across *sequential* calls; batching amortizes across
*simultaneous* ones).

## Caveats

- Requires **multiple independent queries available at once** — a throughput
  setting, not a single interactive turn.
- Accuracy can drop and parsing gets harder at large batch sizes / long inputs;
  gate on UTK's fact-retention evals.
- Headline 5× is dataset-dependent (short inputs); the coding-relevant GSM8K number
  is ~2.4×.
