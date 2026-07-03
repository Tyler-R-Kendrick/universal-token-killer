---
type: category
title: Prompt / Input Compression
description: Academic and general prompt (input) compression — reduce the tokens of the prompt/context before the call.
tags: [techniques, prompt-compression, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Prompt / Input Compression

Internal note. Do not link from the public README.

Research date: 2026-07-02

Academic and general **prompt (input) compression** — reduce the tokens of the
prompt/context *before* the call. This is a distinct axis from **output** compression
([`../assistant-prose-compression/`](/techniques/assistant-prose-compression/overview.md)) and **model routing**
([`../models/`](/techniques/model-routing/overview.md)). The LLMLingua family is the real academic baseline here
and was previously only a passing "seam" mention in UTK docs; this folder gives it and
its competitors first-class coverage. Every arXiv ID in the source brief verified
correct; **Selective Context's missing ID is 2310.06201**.

## The governing caveat (CAVEWOMAN)

Input compression is the **dangerous** half of the token ledger. The independent
[CAVEWOMAN](/research/cavewoman/overview.md) evaluation found blind input
compression is a **"strict lose-lose"** (~1.15× mean cost *increase*, accuracy
collapses, because models compensate with longer outputs). So every technique in this
folder must be **gated on fact-retention / recoverability** — never applied blindly.
This is exactly UTK's existing recoverability discipline, now with third-party
evidence.

## Taxonomy (per the survey, arXiv 2410.12388)

| Type | Idea | Subfolder |
|---|---|---|
| **Hard — token pruning** | Delete low-information tokens (keep the rest verbatim) | [`hard-token-pruning/`](/techniques/prompt-compression/hard-token-pruning/overview.md) |
| **Generative — rewriting** | Rewrite chunks more concisely (grammar-preserving) | [`rag-and-generative/`](/techniques/prompt-compression/rag-and-generative/overview.md) |
| **RAG** | Compress retrieved documents before prepending | [`rag-and-generative/`](/techniques/prompt-compression/rag-and-generative/overview.md) |
| **Soft — learned tokens** | Compress text into learned special tokens (needs model-side support) | [`soft-token-compression/`](/techniques/prompt-compression/soft-token-compression/overview.md) |

| Technique | Source | Type | Training-free (end user) | Query-dependent |
|---|---|---|---|---|
| [LLMLingua](/techniques/prompt-compression/hard-token-pruning/llmlingua.md) | 2310.05736 (EMNLP 2023) | Hard pruning | needs local ~7B scorer | no |
| [LongLLMLingua](/techniques/prompt-compression/hard-token-pruning/longllmlingua.md) | 2310.06839 (ACL 2024) | Hard, query-aware | needs local ~7B scorer | **yes** |
| [LLMLingua-2](/techniques/prompt-compression/hard-token-pruning/llmlingua-2.md) | 2403.12968 (ACL 2024 Findings) | Hard, task-agnostic | drop-in (300–560M encoder) | no |
| [Selective Context](/techniques/prompt-compression/hard-token-pruning/selective-context.md) | 2310.06201 (EMNLP 2023) | Hard, self-information | **yes** (frozen GPT-2) | no |
| [RECOMP](/techniques/prompt-compression/rag-and-generative/recomp.md) | 2310.04408 (ICLR 2024) | RAG (extractive+abstractive) | reader drop-in; trained compressors | yes |
| [SCOPE](/techniques/prompt-compression/rag-and-generative/scope.md) | 2508.15813 (preprint) | Generative rewriting | **yes** (but extra LLM call) | no |
| [500xCompressor](/techniques/prompt-compression/soft-token-compression/500xcompressor.md) | 2408.03094 (ACL 2025) | Soft tokens | **no** (needs model-side support) | no |
| [Gist Tokens](/techniques/prompt-compression/soft-token-compression/gist-tokens.md) | 2304.08467 (NeurIPS 2023) | Soft tokens | **no** (needs fine-tuning) | no |

## Already covered in the watchlist (cross-reference, not duplicated)

- **Soft/latent** (Gist, ICAE, xRAG, PCC) →
  [watchlist §9](/techniques/landscape-watchlist.md). Gist is re-covered
  here as the canonical soft-token anchor; ICAE/xRAG/PCC stay in the watchlist.
- **RAG-time** (ACC-RAG, AttnComp, OSCAR, TeaRAG) → [watchlist §10]. RECOMP joins
  here as the extractive/abstractive + empty-string baseline.

## Evaluation references

- **Survey** — arXiv 2410.12388, *Prompt Compression for LLMs: A Survey* (NAACL 2025,
  Selected Oral; `ZongqianLi/Prompt-Compression-Survey`). Source of the hard/soft
  taxonomy above. Note: the "performance varies by task/context length" line is the
  brief's framing, **not** in the survey abstract.
- **PCToolkit** — arXiv 2403.17411, *A Unified Plug-and-Play Prompt Compression
  Toolkit* (`3DAgentWorld/Toolkit-for-Prompt-Compression`). A real plug-and-play
  evaluation harness bundling compressors/datasets/metrics — the basis for the brief's
  "PCToolkit-style evals."

## UTK Relevance

These are the **academic baselines UTK's context compression must beat or gate**, with
two structural cautions:

1. **None is a pure "wrap the API" method.** Each needs an **auxiliary local model** —
   a ~7B causal scorer (LLMLingua/LongLLMLingua), a 300–560M encoder (LLMLingua-2), or
   frozen GPT-2 (Selective Context). That is the engineering cost to weigh against
   UTK's hook-only design.
2. **Soft-token methods (Gist, 500xCompressor) need model-side support** — they emit
   special tokens/KV states, not text — so they are **incompatible with UTK's
   model-agnostic hook** and produce non-recoverable representations. Reference-only.

Best structural fit: **LLMLingua-2** (fast, task-agnostic/cacheable, small encoder,
MIT) — but it is trained on **meeting transcripts (MeetingBank)**, so **code/agent-
context generalization is the open risk to benchmark**. RECOMP's **empty-string when
unhelpful** routing maps cleanly onto a hook that skips useless context. And all of it
sits under the CAVEWOMAN rule: gate on recoverability, never compress input blindly.
