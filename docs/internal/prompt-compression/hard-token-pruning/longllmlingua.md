# LongLLMLingua Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Prompt compression → hard token pruning (query-aware)
Primary source: arXiv **2310.06839** — *LongLLMLingua: Accelerating and Enhancing LLMs in Long Context Scenarios via Prompt Compression*
Repo: [`microsoft/LLMLingua`](https://github.com/microsoft/LLMLingua), MIT (same monorepo)
Verification: ✅ claimed ID correct (v1 2023-10-10, v2 2024-08-12). **Venue: ACL 2024
(main).** Authors Huiqiang Jiang, Qianhui Wu, Xufang Luo, Dongsheng Li, Chin-Yew Lin,
Yuqing Yang, Lili Qiu (Microsoft).

## Positioning

The **query-aware** LLMLingua for **long-context / RAG**: keep the tokens relevant to
*this* question, and fight the "lost in the middle" position bias.

## Mechanism

Extends LLMLingua with **question-aware coarse-to-fine** compression (uses the query
via **contrastive perplexity** to retain query-relevant tokens), plus **document-level
reordering** to counter position bias, a **dynamic compression ratio**, and
**subsequence recovery**.

## Verified Metrics

Authors' own (GPT-3.5-Turbo): **NaturalQuestions +up to 21.4% with ~4× fewer tokens**;
**94.0% cost reduction on the LooGLE benchmark**; end-to-end latency **1.4×–2.6×
faster** when compressing **~10k-token** prompts at **2×–6×** ratios.

## Scope

**TOKEN-REDUCTION (prompt/input), query-aware.** Black-box target (no model-side
support); needs a local ~7B scorer like LLMLingua.

## UTK Relevance

The right shape for a UTK **RAG surface** — query-conditioned pruning is more accurate
than query-blind pruning when the question is known. But "query-aware" means the
**question must be available at compression time**, which **rules out query-independent
pre-compression/caching** of context artifacts. Its reordering also assumes UTK
controls document order in the prompt.

## Caveats

- **Query-dependent** → cannot pre-compress/cache context ahead of the query.
- Same **local ~7B scorer** cost as LLMLingua — not a pure API wrapper.
- LooGLE 94% cost cut and NQ +21.4% are authors' own; gated by the CAVEWOMAN input
  caveat.
