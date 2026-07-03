---
type: category
title: "Token-Optimization Taxonomy (Sinks, Not Substitutes)"
description: "The map over UTK’s token-optimization technique tree: prompt compression, model routing, output compression, and tool-schema reduction are complementary sinks, not substitutes."
tags: [techniques, taxonomy, internal]
timestamp: 2026-07-02T00:00:00Z
---
# Token-Optimization Taxonomy (Sinks, Not Substitutes)

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-07-02

This is the **map** that ties the competitive-research tree together. It exists to
correct one recurring mistake:

> **The big mistake is treating all token optimizers as substitutes.** They are not —
> they attack **different sinks**. Prompt compression, model routing, output
> compression, tool-schema reduction, and caching are *complementary layers*, and the
> best coding-agent stack composes several of them.

For the breadth-first technique survey see
[`token-optimization-landscape-watchlist.md`](/techniques/landscape-watchlist.md);
for the model-level deep dives see [`models/`](/research/model-routing/overview.md); for input
compression see [`prompt-compression/`](/research/prompt-compression/overview.md); for
output/skill compression see
[`assistant-prose-compression/`](/techniques/assistant-prose-compression/overview.md). This doc sits above
all of them.

## The three axes (keep them separate)

Every technique in this tree reduces one of three different things. Conflating them is
how "savings" numbers mislead:

- **TOKEN-REDUCTION** — cuts billable prompt/output tokens. UTK's core.
- **COST-REDUCTION** — cuts expected `$/task` via cheaper model selection. Routing /
  cascade / compound models.
- **LATENCY-COMPUTE** — self-hosted inference speed, *not* billable tokens. Speculative
  decoding, KV-cache.

Never present a COST- or LATENCY-axis number as a TOKEN win.

## Sink → best techniques

Which lever attacks which sink, with pointers into this tree:

| Sink | Best techniques | Where |
|---|---|---|
| Repeated system / tool / schema tokens | Provider prompt caching; tool/schema pruning; dynamic toolsets; **SkillReducer** | [watchlist §4, §14](/techniques/landscape-watchlist.md); [SkillReducer](/research/skillreducer/overview.md) |
| Huge shell / log / tool output | **RTK**; **Headroom**; **Caveman Code**; snip-style filters | [Headroom](/competition/headroom/research.md); [Caveman Code](/competition/caveman/products/caveman-code/research.md); [rtk-parity](/features/evals/rtk-parity.md) |
| Overloaded repo context | Repo maps; code-graph pruning; SWE-Pruner; Serena-like symbol nav | [watchlist §1–3](/techniques/landscape-watchlist.md); [Serena](/competition/serena/research.md) |
| Verbose model replies | **Caveman / CaveGemma**; Chain-of-Draft; output budgets | [caveman](/competition/caveman/research.md); [cavegemma](/competition/caveman/products/cavegemma/research.md); [watchlist §7](/techniques/landscape-watchlist.md) |
| Bad model choice | **OpenRouter Auto / Pareto Code**; RouteLLM; **NotDiamond**; **Fugu** | [compound-and-productized-routers](/research/model-routing/compound-and-productized-routers/overview.md); [pre-call-routing](/research/model-routing/pre-call-routing/overview.md) |
| High-stakes uncertainty | **Fusion**; **Fugu Ultra**; gated best-of-n; verifier escalation | [full-ensembling](/research/model-routing/full-ensembling/overview.md); [selective-ensembling](/research/model-routing/selective-ensembling/overview.md); [Fusion](/competition/openrouter/products/fusion/research.md) |
| RAG bloat | **LongLLMLingua**; **RECOMP**; Selective Context; contextual compression | [prompt-compression](/research/prompt-compression/overview.md); [watchlist §10](/techniques/landscape-watchlist.md) |
| Long static prefixes | Provider prompt caching **before** compression | [watchlist §14](/techniques/landscape-watchlist.md) |
| Bloated agent skills/instructions | **SkillReducer** (routing-desc + progressive disclosure) | [SkillReducer](/research/skillreducer/overview.md) |

## The layered architecture pattern

For a coding agent the best stack is not one technique — it is layered, each layer
attacking its own sink:

```text
phase router          → route triage/plan/patch/review/summary separately
→ model router         → cheapest capable model for the phase (Pareto Code / RouteLLM / NotDiamond)
→ tool/schema/context compressor → cut fixed per-turn tool + schema tokens
→ repo/symbol context selector   → send less repo context (graphs, SWE-Pruner)
→ terse output policy  → compress model + tool output (Caveman / RTK), safely (see below)
→ verifier/escalation gate       → escalate only on low confidence (cascade)
→ prompt/cache reuse   → provider prompt caching on stable prefixes
```

Order matters: **cache stable prefixes before compressing them**, and **compress
output aggressively but input only when recoverable** (next section).

## The one hard rule (CAVEWOMAN)

The independent [CAVEWOMAN](/research/cavewoman/overview.md) evaluation
(arXiv 2606.24083) settles the input-vs-output question:

```text
Compress OUTPUT style aggressively   → cuts realized cost on most API + all open models.
Compress INPUT only when verifiably lossless → blind input compression is a
  "strict lose-lose": models compensate with longer outputs and accuracy collapses.
```

This is exactly UTK's existing recoverability discipline, now with third-party evidence.
It is why every input-side compressor in [`prompt-compression/`](/research/prompt-compression/overview.md)
must be **gated on fact-retention**, and why UTK keeps compact-but-**recoverable** `.utk/`
artifacts rather than lossy compression.

## What to track (prioritized)

### Production / coding-agent layer
1. **OpenRouter Pareto Code Router** — best productized coding-router pattern.
2. **OpenRouter Auto Router** — general mixed-workload routing (NotDiamond engine).
3. **Sakana Fugu / Fugu Ultra** — learned compound-agent orchestration behind one endpoint.
4. **OpenRouter Fusion** — selective ensemble for high-risk tasks (cost multiplier — gate it).
5. **Headroom / RTK / Caveman Code** — compress tool outputs, logs, shell output, repeated context.
6. **Ponytail** — reduce implementation surface area, not just prompt size.
7. **SkillReducer** — shrink agent skills; progressive-disclosure skill bodies.
8. **Caveman / CaveGemma** — terse output style; promising but needs independent eval (see CAVEWOMAN).

### Academic prompt-compression layer
1. **LLMLingua** · 2. **LongLLMLingua** · 3. **LLMLingua-2** (the front-runner) ·
4. **Selective Context** · 5. **RECOMP** · 6. **SCOPE** · 7. **Gist Tokens** ·
8. **500xCompressor** — see [`prompt-compression/`](/research/prompt-compression/overview.md); also
ICAE / xRAG / PCC in [watchlist §9](/techniques/landscape-watchlist.md).

### Routing / ensemble research layer
1. **FrugalGPT** (cascade baseline) · 2. **RouteLLM / NotDiamond** (strong/weak) ·
3. **ParetoBandit / EquiRouter / RouteJudge** (budget control, routing collapse, router
eval) · 4. **best-of-n / Fusion / MoA** (gated ensemble, not default) ·
5. **R2-Router** (routes model **and** output-length budget) — see
[`models/`](/research/model-routing/overview.md).

## UTK positioning across the map

- **UTK owns (hook path):** tool-output mediation (RTK), terse output, tool/schema
  reduction, recoverable `.utk/` artifacts, skill compression. This is the safe side of
  the CAVEWOMAN rule and UTK's core.
- **UTK's proxy layer (`@utk/model-proxy`):** model routing / cascade / compound —
  adopt the [`models/`](/research/model-routing/overview.md) patterns (Pareto Code tiering, cascade
  quality-estimators, R2-Router length budgets); gate on UTK evals.
- **Reference-only (not adoptable on a training-free, model-agnostic hook):** soft-token
  compression (Gist, 500xCompressor), speculative decoding, KV-cache — training and/or
  model-side support required; they set ceilings, not UTK components.
- **The composition thesis:** route to the cheapest capable model **and** compress its
  prompt **and** cache the stable prefix **and** compress the tool output — the savings
  compound because each attacks a different sink.

## Non-goals

- Do not treat these layers as substitutes or double-count their savings across axes.
- Do not compress input blindly (CAVEWOMAN) or drop recoverability for ratio.
- Do not enable ensemble/Fusion by default (cost multiplier); gate to high-stakes work.
- Do not present routing (`$/task`) or decode (latency) numbers as UTK token wins.
