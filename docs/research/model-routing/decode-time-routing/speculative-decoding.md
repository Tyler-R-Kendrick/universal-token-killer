---
type: paper
title: Speculative Decoding Competitive Research
description: "Speculative decoding uses a draft model to propose tokens and a target model to verify them — a latency optimization, not a billable-token saver (arXiv 2211.17192)."
resource: https://arxiv.org/abs/2211.17192
tags: [research, model-routing, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Speculative Decoding Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Decode-time routing
Verification: ✅ all brief-cited IDs correct; foundational anchors and the correct
"collaborative" papers added below.

## Positioning & Scope (read first)

Speculative decoding accelerates **self-hosted** inference: a fast **draft** model
proposes K tokens, the **target** model verifies them in one parallel forward pass,
and an accept/reject rule keeps the output **provably identical** to the target's.

Because the output distribution is preserved, it emits the **exact same tokens** —
so it is **LATENCY-COMPUTE only**. It **cannot** reduce the billable input+output
tokens that Copilot / OpenAI / Anthropic charge for, and it needs **logit access to
both draft and target**, which hosted APIs do not expose to a mediation layer like
UTK. For UTK this is **reference-only**: relevant to `@utk/model-proxy` throughput
*if UTK self-hosts*, never a billable-token claim.

## Foundational Anchors

### Fast Inference from Transformers via Speculative Decoding
- **arXiv 2211.17192** — Yaniv Leviathan, Matan Kalman, Yossi Matias (**Google
  Research**); submitted 2022-11-30; **ICML 2023 (Oral)**. No official Google repo;
  community impls: `feifeibear/LLMSpeculativeSampling`, `romsto/Speculative-Decoding`.
- **Mechanism:** the canonical primary source. A small draft model proposes K
  tokens; the large target scores them in one parallel pass; a novel
  **speculative-sampling** accept/reject rule guarantees the output distribution is
  **provably identical** to the target's. No retraining, no architecture change.
- **Verified metrics (authors' own):** **T5-XXL (11B)** with a T5-small draft —
  **WMT En→De: 3.4× (argmax) / 2.6× (temp=1)**; **CNN/DM: 3.1× (argmax) / 2.3×
  (temp=1)**. GPT-like 97M (lm1b) and LaMDA 137B report **acceptance-rate α only**,
  not wall-clock. The 2×–3× headline is specifically **T5-XXL**.

### Accelerating Large Language Model Decoding with Speculative Sampling
- **arXiv 2302.01318** — Charlie Chen, Sebastian Borgeaud, Geoffrey Irving,
  Jean-Baptiste Lespiau, Laurent Sifre, John Jumper (**DeepMind**); submitted
  2023-02-02; arXiv preprint (no peer-reviewed venue). Community impl:
  `feifeibear/LLMSpeculativeSampling`.
- **Mechanism:** concurrent, independent formulation ("speculative sampling") with a
  modified rejection-sampling scheme preserving the target distribution within
  hardware numerics.
- **Verified metrics (authors' own):** **Chinchilla 70B**, distributed — **XSum:
  1.92× (nucleus p=0.8) / 2.01× (greedy)**; **HumanEval: 2.46× (nucleus, temp 0.8,
  47.0% pass rate)**. Headline **2–2.5×** TPU wall-clock.

These two are the standard **dual citation** for speculative decoding.

## The Brief's Cited Paper

### Decoding Speculative Decoding
- **arXiv 2402.01528** — Minghao Yan, Saurabh Agarwal, Shivaram Venkataraman
  (**UW–Madison**); submitted 2024-02-02; **NAACL 2025 (Long)**. Official repo
  [`uw-mad-dash/decoding-speculative-decoding`](https://github.com/uw-mad-dash/decoding-speculative-decoding).
- **Mechanism:** an empirical study (350+ experiments) of what actually drives
  speculative-decoding throughput. Finds the **draft model's latency, not its
  language-modeling quality**, dominates end-to-end gains, and uses this to design
  hardware-efficient draft models.
- **Verified metrics (authors' own):** **111% higher throughput** than existing
  draft models, measured with **LLaMA-65B** and **OPT-66B** targets. Baseline is
  prior draft models; no independent benchmark.
- **Note:** reinforces the scope thesis — wins are a function of *your* hardware and
  draft latency, not portable to hosted endpoints that bill per token regardless of
  internal decoding.

## Collaborative / Multi-Model Decoding — and the brief's category error

The brief's phrase "collaborative variants fuse knowledge from multiple LLMs during
decoding" maps to **two different** real papers with **opposite** goals — do not
conflate them:

### CoSD — Speculate, then Collaborate (quality, NOT speed)
- **arXiv 2502.08020** — Ziyao Wang (UMD), Muneeza Azmat, Ang Li, Raya Horesh,
  Mikhail Yurochkin (**IBM Research / MIT-IBM Watson AI Lab**); submitted
  2025-02-11; **ICML 2025 (poster)**. Official repo
  [`ATP-1010/CoSD`](https://github.com/ATP-1010/CoSD).
- **Mechanism:** one LLM drafts a sequence; a learned rule / decision tree decides
  **token-by-token** when to invoke a complementary assistant LLM to overwrite draft
  tokens, **fusing two models' knowledge** at inference with no training. Borrows
  the draft-verify *mechanics* but for **capability fusion, not speedup**.
- **Verified metrics (authors' own, diffuse):** "up to **10% accuracy improvement**"
  across MMLU, GSM8K, HumanEval, Hellaswag, TruthfulQA over 6 model pairs (e.g. pair
  1: 52.41% avg vs 50.79% draft-alone) — **not** isolated to a single benchmark.
- **Scope:** LATENCY-COMPUTE **inverted** — it *adds* compute (two models + a
  verifier) to raise accuracy. **This is the brief's category error:** CoSD is a
  quality technique, so it does **not** belong in a "reduce self-hosted latency"
  bucket.

### CoS — Fast LLM Collaborative Decoding via Speculation (the speed one)
- **arXiv 2502.01662** — Fu et al.; submitted 2025-02-01. Reports **1.11×–2.23×
  faster** than standard collaborative decoding at equal quality. This is the paper
  to cite if you want the **latency-focused** collaborative variant.

## UTK Relevance

Reference-only, for `@utk/model-proxy` self-hosting throughput. **Never present any
number here as a UTK token/cost saving on the hosted path.** If the doc needs "the
collaborative decoding paper," cite **CoSD (2502.08020) for knowledge fusion** and
**CoS (2502.01662) for speed** — and keep both out of billable-token claims.
