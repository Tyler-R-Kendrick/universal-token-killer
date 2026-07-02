# Model-Level Optimization Landscape (Routing / Ensemble / Cascade / Decode)

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-07-02

This folder tracks **model-level** cost/quality optimization — choosing *which*
model(s) to call, *how many* samples to draw, *when* to escalate, and *how* to
decode — as a distinct competitive-research axis from UTK's core
**prompt/context token compression**. It is the deep-dive expansion of §15
("Local Triage / Draft-Review Routing") in
[`../token-optimization-landscape-watchlist.md`](../token-optimization-landscape-watchlist.md),
extended to cover cascades, ensembling, test-time scaling, batch-aware routing,
and speculative decoding.

Every technique here is verified against a primary source (arXiv abstract/HTML
or an official repo). Numbers are quoted with the benchmark they came from and
are the authors' own claims unless a named independent benchmark is cited. The
source brief for this folder was ChatGPT-generated, so each arXiv ID was checked
independently — and, unusually, **all of them resolved to the correct paper**.
The three IDs flagged as "future-dated / likely hallucinated" (C3PO, RoBoN,
RoBatch, and the batch-level routing paper) are **real**: the suspicion was an
artifact of the brief predating those 2025–2026 submissions relative to today
(2026-07-02). The only content error was a **truncated title** (Self-MoA). See
[Verification Status](#verification-status) for the scope corrections that matter
more than the IDs.

## Why This Is a Separate Layer From Token Compression

This is the single most important framing, and UTK should encode it explicitly:

> **Routing / cascading / ensembling do not reduce token count directly. They
> reduce *expected cost per task*** by choosing cheaper models, drawing fewer
> samples, taking shorter reasoning paths, or exiting early. They can reduce
> tokens *indirectly* — by avoiding retries, avoiding overpowered models,
> amortizing shared prompts across a batch, or preventing full ensemble fanout —
> but the primary lever is `$/task`, not `tokens/call`.

Consequences for how UTK reads this landscape:

- These techniques belong to the **`@utk/model-proxy` layer** (model selection
  and routing), **not** the hook-path token-compression layer. They are
  **complementary** to UTK's compression: route to the cheapest capable model
  *and* compress its prompt — the savings compound.
- **Scope discipline (same rule the watchlist applies to KV-cache):** do not
  report cost-per-task routing savings as "token savings," and do not present
  **speculative decoding** (self-hosted decode latency) as billable-token
  savings at all. Keep the three axes separate:
  - **TOKEN-REDUCTION** — cuts billable prompt/output tokens (UTK's core).
  - **COST-REDUCTION** — cuts expected `$/task` via cheaper model selection
    (routing/cascade; most of this folder).
  - **LATENCY-COMPUTE** — self-hosted inference speed/throughput, not billable
    tokens (speculative decoding, decode-time methods).
- The recurring lesson UTK already encodes applies here too: **savings must be
  gated on correctness/recoverability.** A cascade that double-pays on failures,
  or a router that needs a frontier model to route, can cost *more* than calling
  the strong model once.

## The Layered Taxonomy (subfolders)

| Layer | What it optimizes | Subfolder | Techniques |
|---|---|---|---|
| **Pre-call routing** | Choose the cheapest capable model *before* generation | [`pre-call-routing/`](pre-call-routing/) | RouteLLM, Hybrid LLM, OptLLM, Universal Model Routing |
| **Cascade routing** | Try the cheap path first; escalate only when confidence is low | [`cascade-routing/`](cascade-routing/) | FrugalGPT, Cascade Routing, C3PO |
| **Selective ensembling** | Use ensemble / best-of-n *only* when marginal value exceeds cost | [`selective-ensembling/`](selective-ensembling/) | BEST-Route, RoBoN, Zooter |
| **Full ensembling** | Maximize quality, usually at higher token/cost | [`full-ensembling/`](full-ensembling/) | LLM-Blender, Mixture-of-Agents, Self-MoA |
| **Batch-aware routing** | Amortize repeated system/tool prompt tokens across queries | [`batch-aware-routing/`](batch-aware-routing/) | Batch Prompting (anchor), RoBatch, batch-level robust routing |
| **Decode-time routing** | Reduce self-hosted latency/compute, *not* API tokens | [`decode-time-routing/`](decode-time-routing/) | Speculative decoding (+ collaborative variants) |
| **Compound & productized routers** | Shipped products that route/coordinate models behind one endpoint | [`compound-and-productized-routers/`](compound-and-productized-routers/) | Sakana Fugu, OpenRouter Auto/Pareto/Fusion, NotDiamond |
| **Routing research (2nd-gen)** | Failure modes & controls basic routers miss | [`routing-research/`](routing-research/) | ParetoBandit, EquiRouter, RouteJudge, R2-Router |

There is a further conceptual layer with no single paper family behind it:

- **Agent-step routing** — route planning, retrieval, code-gen, review/judge,
  and summarization to *different* models/paths within one agent run. This is a
  practical architecture pattern (see [Most Relevant for Coding
  Agents](#most-relevant-for-coding-agents)) rather than a citeable technique,
  and it is where UTK's leverage is highest.

## Most Relevant for Coding Agents

For a coding agent the highest-leverage move is **not** "pick one model per
chat." It is **route each phase separately**, with a cheap default path and an
explicit escalation trigger:

| Agent phase | Cheap / default path | Escalation trigger |
|---|---|---|
| Issue triage | Small model / classifier | Ambiguous requirement, high blast radius |
| Repo search | Embeddings + symbol graph + cheap summarizer | Cross-cutting architectural change |
| Planning | Mid-tier model | Security, infra, data migration, concurrency |
| Patch generation | Cheapest model that passes local tests | Failed compile/test, large refactor |
| Review / judge | Specialized verifier or stronger model | Risky diff, low confidence, repeated failures |
| Final summary | Small model | User-facing compliance / legal / security explanation |

The pattern:

```text
router → cheapest capable model → verifier / confidence check → escalate only if needed
```

For token/cost optimization this beats both naive "call the best model once" and
naive "ensemble everything." It is the pattern UTK's `@utk/model-proxy` should
implement, gated by UTK's existing correctness/recoverability evals.

## What To Be Careful About

Three traps, each of which turns a "savings" technique into a net loss:

1. **The router has a cost.** A router that needs a frontier model, full repo
   context, or multiple probes can erase the savings it creates. Good routers use
   **cheap features**: prompt length, task type, file count, dependency-graph
   distance, historical success rate, test-failure class, required tool set,
   estimated output length. (Cf. SoT's 67M-param DistilBERT router in
   [`../sketch-of-thought-competitive-research.md`](../sketch-of-thought-competitive-research.md).)
2. **Double-paying on failures.** If the cheap model produces a bad patch and the
   strong model then redoes the whole task *with extra failure context*, the
   cascade can cost more than going straight to the strong model. Cascades need
   **early rejection signals**: compile check, static analysis, a small verifier,
   confidence calibration, or partial-diff scoring — the cheaper and earlier the
   better.
3. **Ensemble fanout.** MoA, LLM-Blender, and best-of-n are **quality techniques
   first**. They become cost/token optimization *only* when gated to tasks where
   the expected retry/escalation cost is worse than the ensemble cost. Ungated,
   they multiply spend.

## UTK Positioning

- **Adopt (at `@utk/model-proxy`):** pre-call routing with cheap features and
  cascade routing with early rejection are the direct precedents for the proxy's
  model-selection path. Their taxonomies are a benchmark checklist; their numbers
  are the bar to meet or beat. Pairs with the Local-Splitter seven-tactic study
  already tracked in the watchlist (§15).
- **Gate, don't default (selective ensembling):** expose best-of-n / ensemble as
  an *escalation-only* option, never a default; gate on the same fact-retention
  and recoverability evals UTK applies to compression.
- **Reference-only (full ensembling, decode-time):** full MoA/LLM-Blender are
  quality amplifiers that raise cost — track as competitors' quality plays, not
  UTK token wins. Speculative decoding is self-hosted-inference plumbing for the
  proxy, never a billable-token claim.
- **Do not conflate axes:** never present COST-REDUCTION or LATENCY-COMPUTE
  numbers from this folder as UTK TOKEN-REDUCTION wins.

## Source Ledger

Primary sources verified on 2026-07-02. Cite these when re-checking; do not cite a
number without its benchmark.

| Technique | Layer | Primary source | Repo (license) / venue |
|---|---|---|---|
| RouteLLM | Pre-call | arXiv 2406.18665 | `lm-sys/RouteLLM` (Apache-2.0) / arXiv preprint |
| Hybrid LLM | Pre-call | arXiv 2404.14618 | no repo / **ICLR 2024** |
| OptLLM | Pre-call | arXiv 2405.15130 | `LLMs-EffiUse-Lab/OptLLM` (no license) / ICWS 2024 |
| Universal Model Routing (UniRoute) | Pre-call | arXiv 2502.08773 | no repo / arXiv (reported ICLR 2026, secondary) |
| FrugalGPT | Cascade | arXiv 2305.05176 | `stanford-futuredata/FrugalGPT` (Apache-2.0) / **TMLR 2024** |
| Cascade Routing | Cascade | arXiv 2410.10347 | `eth-sri/cascade-routing` (Apache-2.0) / **ICML 2025** |
| C3PO | Cascade | arXiv 2511.07396 | `AntonValk/C3PO-LLM` (no license) / **NeurIPS 2025** |
| BEST-Route | Selective | arXiv 2506.22716 | `microsoft/best-route-llm` (MIT) / **ICML 2025** |
| Zooter | Selective | arXiv 2311.08692 | no repo / **NAACL 2024** |
| RoBoN | Selective | arXiv 2512.05542 | `j-geuter/RoBoN` (MIT) / arXiv preprint (under review) |
| LLM-Blender | Full ensemble | arXiv 2306.02561 | `yuchenlin/LLM-Blender` (Apache-2.0) / **ACL 2023** |
| Mixture-of-Agents | Full ensemble | arXiv 2406.04692 | `togethercomputer/MoA` (Apache-2.0) / arXiv preprint |
| Self-MoA | Full ensemble | arXiv 2502.00674 | `wenzhe-li/Self-MoA` (unspecified) / arXiv preprint |
| Batch Prompting (anchor) | Batch-aware | arXiv 2301.08721 | `xlang-ai/batch-prompting` / **EMNLP 2023 Industry** |
| RoBatch | Batch-aware | arXiv 2605.28268 | no confirmed repo / arXiv preprint (2026-05) |
| Batch-level robust routing | Batch-aware | arXiv 2603.26796 | no repo / **ACM CAIS 2026** |
| Fast Inference via Spec. Decoding (Leviathan) | Decode-time | arXiv 2211.17192 | community impls / **ICML 2023 Oral** |
| Spec. Sampling (Chen, DeepMind) | Decode-time | arXiv 2302.01318 | community impls / arXiv preprint |
| Decoding Speculative Decoding | Decode-time | arXiv 2402.01528 | `uw-mad-dash/decoding-speculative-decoding` / **NAACL 2025** |
| CoSD (collaborative — quality) | Decode-time | arXiv 2502.08020 | `ATP-1010/CoSD` / **ICML 2025** |
| CoS (collaborative — speed) | Decode-time | arXiv 2502.01662 | no repo / arXiv preprint |

## Verification Status

**Headline result:** every one of the brief's cited arXiv IDs resolved to the
**correct** paper — **zero misattributions**, unusual for a ChatGPT-sourced brief.
The three "future-dated → likely hallucinated" suspects (C3PO, RoBoN, RoBatch, plus
the batch-level routing paper) are **real, recent** publications; the flag was an
artifact of the brief predating them relative to today. The only content error was
**Self-MoA's truncated title** (brief gave the subtitle only). What actually needs
correcting is **scope**, not citations:

| Technique | Status | Scope / correction |
|---|---|---|
| RouteLLM | Verified | COST-REDUCTION. Two headline figures come from **different surfaces** — ">2×" (abstract) vs "85% / 95% GPT-4 on MT-Bench" (README). |
| Hybrid LLM | Verified | COST-REDUCTION (call-level). ICLR 2024. The "40%" has **no named benchmark** in the abstract. |
| OptLLM | Verified | COST-REDUCTION. Repo is **effectively unlicensed** (LICENSE 404s). |
| UniRoute | Verified | COST-REDUCTION; unseen-pool novelty confirmed. **No numeric headline** in abstract, **no repo**, ICLR 2026 venue **secondary-only**. |
| FrugalGPT | Verified | COST-REDUCTION. The **98%** is a **cross-dataset best case at 2023 prices**, not a per-task number. |
| Cascade Routing | Verified | COST-REDUCTION. Abstract is qualitative; the ~14% SWE-Bench figure is **not table-verified — do not quote**. |
| C3PO | Verified (**real, not hallucinated**) | COST-REDUCTION. NeurIPS 2025. Repo has **no license**. |
| BEST-Route | Verified | COST-REDUCTION. "**<1% drop**" is **in-distribution (0.8%)**; OOD MT-Bench is 1.59%. |
| Zooter | Verified | COST-REDUCTION/COMPUTE. NAACL 2024. "**44% of tasks**" is a win-rate, not accuracy; 2023-era 13B models. |
| RoBoN | Verified (**real, not hallucinated**) | **LATENCY-COMPUTE — NOT a saver.** Improves accuracy at compute **parity**; training-free routing + external reward model. |
| LLM-Blender | Verified | TOKEN-INCREASING quality method. **No quotable headline number** from the primary source. |
| Mixture-of-Agents | Verified | TOKEN/COST-INCREASING quality method. AlpacaEval 2.0 LC 65.1% vs GPT-4o 57.5%. |
| Self-MoA | Verified (**title corrected**) | TOKEN-INCREASING, but removes multi-**model** overhead. +6.6 pp AlpacaEval LC vs mixed-MoA (skeptical control). |
| Batch Prompting | Verified | COST-REDUCTION **with a real token component** (anchor). 5× is short-dataset; GSM8K ~2.4×. |
| RoBatch | Verified (**real, not hallucinated**) | COST-REDUCTION. **No confirmed repo**; preprint (2026-05). System-prompt cost 59.5%→8.4% on AGNews. |
| Batch-level robust routing | Verified (**real, not hallucinated**) | COST-REDUCTION **+ CAPACITY**. ACM CAIS 2026. More about GPU capacity/robustness than token amortization. |
| Speculative decoding (all) | Verified | **LATENCY-COMPUTE only.** Output-identical → cannot reduce billable tokens; needs draft+target logit access hosted APIs don't expose. |
| CoSD | Verified | **Quality fusion, not latency** — the brief's "collaborative = latency" framing is a **category error**. CoS (2502.01662) is the speed variant. |

**Honest caveat on the newest sources.** The two 2026 batch-routing papers (RoBatch
2605.28268, batch-level 2603.26796) were verified through this environment's proxied
web tools, backed by control tests (a fake ID 404'd; a misleading-title fetch was
refused), curated-index cross-checks (dblp, ACM), and manual PDF-stream extraction.
Fabrication is very implausible, but for an ironclad record a human should click the
arXiv/dblp/ACM links once. **Batch Prompting (Cheng et al., EMNLP 2023)** is the
rock-solid anchor that predates any date ambiguity.

All metrics are the authors' own claims unless a named independent benchmark is
cited; none are independently reproduced in this workspace.

## Non-Goals

- Do not adopt any router/cascade that requires training the frontier model or a
  frontier-model-sized router on the UTK hook path — model-agnosticism is UTK's
  core (same rule as the watchlist's soft/latent and tokenizer sections).
- Do not present speculative-decoding or KV-level decode savings as UTK token
  savings; they do not change billable hosted-API tokens.
- Do not enable ensemble/best-of-n by default; a wrong-but-confident fused answer
  is a correctness bug, and fanout is a cost regression.
- Do not cite any metric in this folder without its benchmark, and do not cite
  the two unverified batch-routing entries as established results.
