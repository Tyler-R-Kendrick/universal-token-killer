# NotDiamond Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Compound models & productized routers
Source: https://www.notdiamond.ai/ + https://docs.notdiamond.ai/docs/what-is-model-routing (fetched)
Kind: Product — learned model router (the engine behind [OpenRouter Auto](openrouter-auto-router.md)), OpenAI-compatible gateway.

## Positioning

A **learned router** billed as "the world's most powerful intelligent model router
for coding agents." It "intelligently predicts which model to use for each input,
reducing costs while maintaining accuracy," and is the engine powering OpenRouter's
Auto Router.

## Mechanism

A *trained/learned* router — "a framework for training custom routing algorithms
across a range of candidate LLMs on your evaluation data." It builds a **meta-model
that learns when to use each LLM** from (inputs, candidate responses, eval scores),
aiming to "beat every individual model's performance while driving down cost and
latency." Offers **pre-trained routers** (a cross-domain chat router + a coding-agent
cost router) and **custom routers** trained on your own evals (can include your own
models).

## Controls / Knobs

Three tradeoff modes: **Quality** (default, "best response"), **Cost** ("prefers
cheaper models when appropriate"), **Latency** ("minimizes response time while
maintaining quality thresholds"); plus selection of the candidate-model set. No
numeric max-cost cap exposed on the docs page.

## Verified Metrics

**All vendor / case-study claims — NOT independently benchmarked:**

- Homepage: "**Accuracy gains 5%+**", "**Cost savings 30%+**", "**Faster dev cycles
  2×**" — no datasets named.
- Rootly case study: "Not Diamond increased the average accuracy by **39%**" across
  their SRE benchmarks, "with some use cases more than doubling."

No NotDiamond research paper was found on the site.

## Scope

**COST-REDUCTION** — a meta-model routes each query to one model to cut cost/latency
while holding accuracy. **OpenAI-compatible:** yes ("swap the base URL with our
gateway URL"); also usable as a standalone routing API returning a recommended model.

## UTK Relevance

The learned-router benchmark for `@utk/model-proxy`, and notable because it targets
**coding agents** specifically. UTK's differentiator is **training-free** selection +
recoverable artifacts + token compression; NotDiamond needs eval data to train a
meta-model. Its "train a router on your own evals" pattern is worth noting as the
customization ceiling UTK's cheaper deterministic-feature routing trades against.

## Caveats

- **No independently verified NotDiamond numbers** — homepage/case-study only.
- Primary third-party routing benchmarks that *do* exist: **RouterBench**
  (arXiv 2403.12031) and **LLMRouterBench** (arXiv 2601.07206). A secondary
  "RouterArena" claim ("NotDiamond ranks #12 because it frequently selects expensive
  models") surfaced in search but **could not be confirmed against a primary source**
  — do not cite without checking.
