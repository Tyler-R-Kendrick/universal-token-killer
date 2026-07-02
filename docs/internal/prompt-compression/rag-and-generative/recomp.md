# RECOMP Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Prompt compression → RAG compression
Primary source: arXiv **2310.04408** — *RECOMP: Improving Retrieval-Augmented LMs with Compression and Selective Augmentation*
Repo: [`carriex/recomp`](https://github.com/carriex/recomp), MIT
Verification: ✅ claimed ID correct (2023-10-06). **Venue: ICLR 2024.** Authors
Fangyuan Xu, Weijia Shi, Eunsol Choi.

## Positioning

The **RAG document compressor** with a useful trick UTK should copy: it can **return an
empty string** when the retrieved documents are useless.

## Mechanism

Compresses retrieved documents into short **textual summaries** before prepending them
to the reader LM. Two compressors: an **extractive** one (selects salient sentences) and
an **abstractive** one (synthesizes across documents). **Selective augmentation:** "if
the retrieved documents are irrelevant to the input or offer no additional information
to LM, our compressor can return an **empty string**."

## Verified Metrics

Authors' own: "a compression rate of as low as **6%** with minimal loss in performance"
on **language modeling and open-domain QA**. (6% is a *compression rate* — output is 6%
of input — not an error rate.) Compressors trained for one reader LM **transfer** to
other reader LMs on the LM task.

## Scope

**TOKEN-REDUCTION of RAG input** (retrieved passages). Output is **plain text prepended
to any reader LM** — **no model-side support required** for the reader.

## UTK Relevance

**Best fit** in this folder for UTK-style plain-text prepend pipelines: the compressed
output is text and reader-agnostic. Two directly transferable ideas: (1) the
**empty-string routing** ("skip unhelpful context") maps onto hook-based "don't spend
tokens on useless retrievals" logic; (2) compressor **transfer** across reader models
suits UTK's model-agnostic stance. The cost is that the **compressors themselves are
trained** (an extractive dual-encoder; an abstractive T5 distilled from a larger LM) — so
not zero-training, but the reader stays drop-in.

## Caveats

- Reader is drop-in; the **compressors are trained models** — not a pure API wrapper.
- 6% is the **compression rate**, not an accuracy figure; gated by the CAVEWOMAN input
  caveat.
