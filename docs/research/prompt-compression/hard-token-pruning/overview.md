---
type: category
title: Hard Token Pruning
description: "Hard prompt compression that deletes low-information tokens while keeping the rest verbatim (the LLMLingua family, Selective Context)."
tags: [research, prompt-compression, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Hard Token Pruning

Internal note. Do not link from the public README.

Research date: 2026-07-02

**Type:** delete low-information tokens from the prompt, keeping the rest **verbatim**
(no rewriting). The LLMLingua family + Selective Context. All treat the target LLM as
**black-box** (no model-side support) but all need an **auxiliary local model** to
score tokens. All four are **MIT-licensed**.

| Technique | Source | Scorer model | Speed | Query-aware | Best for |
|---|---|---|---|---|---|
| [LLMLingua](/research/prompt-compression/hard-token-pruning/llmlingua.md) | 2310.05736 (EMNLP 2023) | ~7B causal (Alpaca-7B) | slow (iterative) | no | the original budgeted pruner |
| [LongLLMLingua](/research/prompt-compression/hard-token-pruning/longllmlingua.md) | 2310.06839 (ACL 2024) | ~7B causal | slow | **yes** | long-context / RAG |
| [LLMLingua-2](/research/prompt-compression/hard-token-pruning/llmlingua-2.md) | 2403.12968 (ACL 2024 F.) | 300–560M encoder | **fast** (1 pass) | no | task-agnostic, cacheable |
| [Selective Context](/research/prompt-compression/hard-token-pruning/selective-context.md) | 2310.06201 (EMNLP 2023) | frozen GPT-2 | medium | no | fully training-free baseline |

**UTK read:** **LLMLingua-2** is the structural front-runner for a hook-based reducer
(fast, single encoder pass, query-independent so cacheable, small model, MIT) — but its
**MeetingBank** training domain makes code/agent-context generalization the thing to
benchmark. **Selective Context** is the only *fully* training-free option (frozen
GPT-2, self-information), at the cost of coarser, unidirectional pruning. **LongLLMLingua**
is query-aware — powerful for RAG but it needs the question at compression time, so it
can't pre-compress/cache. All are gated by the CAVEWOMAN input-compression caveat (see
the [parent overview](/research/prompt-compression/overview.md)).
