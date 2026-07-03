---
type: category
title: "RAG & Generative Compression"
description: "Prompt compression by rewriting or compressing retrieved chunks rather than deleting tokens (RECOMP, SCOPE)."
tags: [techniques, prompt-compression, internal]
timestamp: 2026-07-02T00:00:00Z
---
# RAG & Generative Compression

Internal note. Do not link from the public README.

Research date: 2026-07-02

Two shapes that both emit **plain text** (reader-agnostic, no model-side support) —
unlike soft tokens — so they are the **most UTK-shaped** compressors in this folder:

- **RAG compression** — compress *retrieved documents* before prepending them.
- **Generative rewriting** — *rewrite* chunks more concisely (grammar-preserving),
  instead of deleting tokens.

| Technique | Source | Shape | Training-free (end user) | Note |
|---|---|---|---|---|
| [RECOMP](/techniques/prompt-compression/rag-and-generative/recomp.md) | 2310.04408 (ICLR 2024) | RAG: extractive + abstractive | reader drop-in; compressors trained | can return **empty string** when docs unhelpful |
| [SCOPE](/techniques/prompt-compression/rag-and-generative/scope.md) | 2508.15813 (preprint) | Generative rewriting | **yes**, but adds an extra LLM call | grammar-preserving; unproven (no code) |

Related RAG-time compressors (**ACC-RAG, AttnComp, OSCAR, TeaRAG**) are in
[watchlist §10](/techniques/landscape-watchlist.md).

**UTK read:** these fit UTK's **text-in/text-out, reader-agnostic** philosophy best.
**RECOMP's empty-string-when-unhelpful** is directly a hook that **skips useless
context** — worth mirroring. **SCOPE's rewriting** preserves grammar where deletion
breaks it, but costs an **extra LLM call** per compression (latency/cost) and is
single-preprint/unproven. Both remain gated by the CAVEWOMAN input-compression caveat
(see [parent overview](/techniques/prompt-compression/overview.md)).
