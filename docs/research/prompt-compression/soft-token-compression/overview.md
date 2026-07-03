---
type: category
title: Soft-Token Compression
description: "Soft prompt compression into learned special tokens — reference-only for UTK because it needs model-side support (Gist Tokens, 500xCompressor)."
tags: [research, prompt-compression, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Soft-Token Compression

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Type:** compress text into a few **learned special tokens** (embeddings / KV states),
not text. Achieves the **highest ratios** in this folder (26×–480×) but the output is
**non-recoverable** and **requires model-side support** — so it is **incompatible with
UTK's model-agnostic hook** and is **reference-only** (a ceiling on how far compression
can go, not an adoptable technique).

| Technique | Source | Ratio | Model-side support | Training |
|---|---|---|---|---|
| [500xCompressor](/research/prompt-compression/soft-token-compression/500xcompressor.md) | 2408.03094 (ACL 2025) | 6×–480× | yes (special tokens + KV injection) | trained encoder (LoRA) |
| [Gist Tokens](/research/prompt-compression/soft-token-compression/gist-tokens.md) | 2304.08467 (NeurIPS 2023) | up to 26× | yes (gist tokens) | model fine-tuning |

Related soft/latent methods (**ICAE, xRAG, PCC**) are covered in
[watchlist §9](/techniques/landscape-watchlist.md); Gist is re-covered here
as the canonical anchor.

**UTK read:** **reference-only.** These need training the model (or a bridge) and
produce **non-recoverable** latent representations — the opposite of UTK's
compact-but-**recoverable** text philosophy. Useful as the theoretical ceiling ("how far
can compression go") and as the contrast that motivates UTK's recoverable-text stance;
not adoptable on a training-free, model-agnostic hook.
