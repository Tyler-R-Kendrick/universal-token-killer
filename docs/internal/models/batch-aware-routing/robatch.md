# RoBatch Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Batch-aware routing
Primary source: arXiv **2605.28268** — *Towards Cost-effective LLMs Routing with Batch Prompting*
Repo: none confirmed (an unverified `github.com/Robatch` org exists; no repo link in the PDF)
Verification: ✅ **real paper — the brief's "likely fabricated" flag was wrong.**
Submitted 2026-05-27; arXiv/CoRR preprint (DOI 10.48550/ARXIV.2605.28268), no
peer-reviewed venue yet. Authors Haotian Xu, Kangfei Zhao, Jiadong Xie (Beijing
Institute of Technology). Verified via abs page, dblp, and **manual PDF-stream
decompression** (bypassing any summarizer); see master Verification Status caveat.

## Positioning

The single **closest published match to a "batch-aware routing" feature**: it jointly
chooses **which model** and **what batch size** per query, specifically to amortize
the shared system-prompt cost.

## Mechanism

Formulates the **"Route-with-Batching Problem"** — jointly pick target model **and**
batch size per query under a total cost budget (stated as **NP-hard**). Two stages:
(1) a **batch-aware proxy utility model**; (2) **budget-aware greedy scheduling**
that upgrades model/batch-size assignments along the cost–utility Pareto frontier
until the budget is exhausted.

## Verified Metrics

Authors' own claims (no independent benchmark); direct from the PDF:

- **System-prompt share of total cost** amortized by batching: **59.5% → 8.4% on
  AGNews** and **90.1% → 53.2% on GSM8K**.
- Beats **"Router-Only"** and **"Batch-Only"** ablations on the cost–accuracy
  trade-off, with final-accuracy differences within **~2%**.
- Six benchmarks incl. **GSM8K, AGNews, IMDB, MMLU**; models **Qwen3 (4B/14B/32B)
  and Gemma3**; baselines **MLP Router / KNN Router**.

## Scope

**COST-REDUCTION** — jointly optimize model + batch size to amortize shared prompt
tokens under a budget. Exactly on-target for this category, and with a real token
component (the shared system prompt is paid per batch, not per query).

## UTK Relevance

The **primary source for joint model + batch-size routing**, which is the
production-serving generalization of what UTK's proxy could do with a stable
tool/system prefix. The AGNews **59.5% → 8.4%** figure is a vivid illustration of
how much of per-call cost is the repeated system prompt — precisely UTK's thesis,
applied at the batch layer.

## Caveats

- **No confirmed official repo** — reimplementation required.
- Preprint, **no peer-reviewed venue yet**; very recent (2026-05).
- Router/proxy are **trained** → not training-free.
- Batching assumes concurrent independent queries (serving, not single turn).
