---
type: technique
title: LLMLingua Competitive Research
description: "Primary source: arXiv 2310.05736 — LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models Repo: microsoft/LLMLingua, MIT (monorepo for all three LLMLingua papers)…"
resource: https://arxiv.org/abs/2310.05736
tags: [techniques, prompt-compression, internal]
timestamp: 2026-07-02T00:00:00Z
---
# LLMLingua Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Prompt compression → hard token pruning
Primary source: arXiv **2310.05736** — *LLMLingua: Compressing Prompts for Accelerated Inference of Large Language Models*
Repo: [`microsoft/LLMLingua`](https://github.com/microsoft/LLMLingua), MIT (monorepo for all three LLMLingua papers)
Verification: ✅ claimed ID correct (v1 2023-10-09). **Venue: EMNLP 2023 (main).**
Authors Huiqiang Jiang, Qianhui Wu, Chin-Yew Lin, Yuqing Yang, Lili Qiu (Microsoft).

## Positioning

The original **budgeted hard-pruning** prompt compressor and the family the whole
LLMLingua line builds on.

## Mechanism

**Coarse-to-fine.** A **budget controller** allocates a compression budget across
prompt components (instruction / demonstrations / question); then a **token-level
iterative** algorithm drops **low-perplexity** (predictable, low-information) tokens
using a **small causal LM (Alpaca-7B / GPT2-Alpaca) as scorer**. An instruction-tuning
step aligns the small LM's distribution with the target LLM.

## Verified Metrics

Authors' own: "**up to 20× compression with little performance loss**" over **GSM8K,
BBH, ShareGPT, Arxiv-March23**. The **20×** figure is specifically **GSM8K**
(quarter-shot: EM **77.33 at 117 tokens (20×)** vs **78.85** full-shot — a 1.52-point
drop). 20× is a **best case** (GSM8K CoT); other datasets compress less.

## Scope

**TOKEN-REDUCTION (prompt/input).** Compresses the prompt before the API call; the
target LLM is **black-box (no model-side support)**, but a **local ~7B scorer is
required**.

## UTK Relevance

The reference baseline UTK's context compression is measured against, and the origin of
the "budget controller + perplexity pruning" pattern. For UTK the blocker is the
**~7B local scorer** (GPU/weights) and the slow iterative pass — heavy for a hook path.
Track the *idea* (budget-allocated, information-theoretic pruning); prefer the faster
LLMLingua-2 realization if UTK ever hosts a compressor.

## Caveats

- Needs a **local ~7B scorer** and instruction-tuning to align it — **not a pure API
  wrapper**.
- Iterative token pass is **slow** (exactly what LLMLingua-2 later accelerates 3–6×).
- **20× is GSM8K CoT best case**, not a portable guarantee; gated by the CAVEWOMAN
  input caveat.
