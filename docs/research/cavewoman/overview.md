---
type: paper
title: CAVEWOMAN Competitive Research
description: "Primary source: arXiv 2606.24083 — CAVEWOMAN: How Large Language Models Behave Under Linguistic Input and Output Compression Verification: ✅ claimed ID correct (submitted 2026-06-23)."
resource: https://arxiv.org/abs/2606.24083
tags: [research, evaluation, internal]
timestamp: 2026-07-02T00:00:00Z
---
# CAVEWOMAN Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Agent-native token economy (empirical evaluation)
Primary source: arXiv **2606.24083** — *CAVEWOMAN: How Large Language Models Behave Under Linguistic Input and Output Compression*
Verification: ✅ claimed ID correct (submitted 2026-06-23). Authors Morayo Danielle
Adeyemi, Ryan A. Rossi, Franck Dernoncourt (Rossi/Dernoncourt = **Adobe Research** —
**unaffiliated with the caveman product ecosystem**). arXiv preprint, not peer-reviewed.

## Positioning

The **independent empirical test** of the caveman-style compression thesis, and the
single most important item in this folder: it separates *input* compression from
*output* compression and measures which actually saves money. Its finding is the
governing rule for the whole agent-native bucket.

## Mechanism

A two-channel evaluation protocol. It **separately** compresses the user prompt
(input channel) and the model response (output channel) at **five escalating
linguistic-reduction levels** (L0 unconstrained → L1 telegraphic → L2 keyword-only →
L3 noun-phrase skeleton → L4 15-token budget). Every generation is scored on **task
accuracy, realized per-item cost, and agreement with the model's own unconstrained
reference** — input and output channels measured on the same items so the two effects
are directly comparable.

## Verified Metrics

Tested **8 models** (Qwen2.5-VL-7B, Qwen3.5-9B, DeepSeek-R1-Distill-Qwen-7B,
Gemma-4-E4B, GPT-4o, GPT-5.4, Claude Haiku 4.5, Claude Sonnet 4.6) × **5 datasets**
(GSM8K, BoolQ, ARC-Easy, CommonsenseQA, MMLU-STEM) × 5 reduction levels:

- **Output compression** "cuts realized cost on **most** API models (**1.4–2.4× per
  model, up to 3×** best case) and on **all four open-weight models** under
  public-tier pricing."
- **Input compression** is "a **strict lose-lose**: it raises net cost rather than
  lowering it (**~1.15×** on the five-benchmark mean, up to **1.8×** on the worst
  dataset and **2.7×** under stronger compression), because models compensate with
  **longer responses even as accuracy collapses**."

## Scope

**EMPIRICAL-EVAL.** Not a technique — the measurement that tells you which techniques
are safe.

## UTK Relevance

**The strongest third-party validation of UTK's core discipline.** UTK compresses
tool/model output aggressively but treats input/context compression as dangerous
unless recoverability is proven — CAVEWOMAN is independent evidence for exactly that
asymmetry. Concretely it justifies: (1) UTK's terse/RTK output mediation is on the
safe side of the ledger; (2) UTK's insistence on **recoverable** `.utk/` artifacts
and fact-retention gates is not over-caution — naive input compression measurably
*raises* cost and collapses accuracy. Cite this as the "why we gate input
compression" reference.

## Caveats

- **arXiv preprint, not peer-reviewed**; numbers are the authors' own.
- But it is genuinely **independent** of the caveman/getcaveman ecosystem (Adobe
  Research) — the best third-party signal in this set.
- "Output compression helps" holds for *most* (not all) API models + all open-weight
  models under public-tier pricing — provider pricing matters.
