# Selective Context Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Prompt compression → hard token pruning (self-information)
Primary source: arXiv **2310.06201** — *Compressing Context to Enhance Inference Efficiency of Large Language Models*
Repo: [`liyucheng09/Selective_Context`](https://github.com/liyucheng09/Selective_Context), MIT
Verification: ✅ **ID found (brief gave only the GitHub link): 2310.06201** (v1
2023-10-09). **Venue: EMNLP 2023 (main).** Author Yucheng Li et al. (an earlier related
preprint exists at 2304.12102).

## Positioning

The **fully training-free** hard-pruning baseline — the simplest of the family, and
the conceptual ancestor LLMLingua-2 explicitly critiques.

## Mechanism

A **frozen base LM** (e.g. **GPT-2**, configurable via `model_type`) computes
**self-information** (−log p) for **lexical units** (tokens, phrases, or sentences); the
**lowest-self-information** (most predictable/redundant) units are pruned. A
`reduce_ratio` controls how much is dropped.

## Verified Metrics

Authors' own: **50% context reduction** → **36% less inference memory** and **32% less
inference time**, with only **−0.023 BERTScore** and **−0.038 faithfulness** across four
downstream apps. Data: **arXiv papers, BBC news, conversation transcripts**; tasks:
summarization, QA, response generation. (The README frames it loosely as "2× more
content, ~40% memory & GPU time saved.")

## Scope

**TOKEN-REDUCTION (prompt/input).** Black-box target (no model-side support); needs a
**local small LM** (GPT-2) for the logprobs. **Fully training-free.**

## UTK Relevance

The one **fully training-free** option here — attractive because it needs no distillation
or fine-tuning, just a frozen small LM (and in principle an API that returns token
logprobs could substitute). The cost is quality: **self-information is unidirectional**
(LLMLingua-2 argues this is suboptimal vs bidirectional classification), and its
phrase/sentence-level pruning is **coarser** than token-level, risking loss of needed
spans. A good cheap baseline for UTK to measure LLMLingua-2 against.

## Caveats

- **Unidirectional** self-information (weaker signal than LLMLingua-2's bidirectional
  encoder); **coarser** unit pruning.
- **Not query-aware.**
- Still needs a local GPT-2 + spaCy — not a pure API wrapper; gated by the CAVEWOMAN
  input caveat.
