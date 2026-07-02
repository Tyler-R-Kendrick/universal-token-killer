# OpenRouter Auto Router Competitive Research

Internal note. Do not link from the public README.

Research date: 2026-07-02
Layer: Compound models & productized routers
Source: https://openrouter.ai/docs/guides/routing/routers/auto-router + https://openrouter.ai/blog/insights/model-routing/ (both fetched)
Kind: Product — per-prompt model router (`openrouter/auto`), OpenAI-compatible.

## Positioning

The pragmatic general router: a single meta-model id (`openrouter/auto`) that hands
per-prompt model selection to OpenRouter. Use it for mixed workloads where you don't
know which model each request needs.

## Mechanism

Confirmed from docs: **powered by [NotDiamond](notdiamond.md)**, which "selects a
model per prompt from a curated pool" and "considers factors like prompt complexity,
task type, and model capabilities." Curated-pool examples cited: Claude Sonnet 4.5,
Claude Opus 4.5, GPT-5.1, Gemini 3.1 Pro, DeepSeek 3.2. The response returns the
actual model chosen in the `model` field.

## Controls / Knobs

- **`cost_quality_tradeoff`** — integer **0–10, default 7**; 0 = "pure quality —
  always the most capable model," 10 = "maximize for cost — cheapest wins."
- **`allowed_models`** — restrict routing via wildcard patterns (e.g. `anthropic/*`,
  `openai/gpt-5.1`).
- **`session_id`** — sticky routing for cache hits / consistency.

## Verified Metrics

**None published** on these pages — no accuracy or cost-savings numbers for the Auto
Router itself.

## Scope

**COST-REDUCTION** — routes each prompt to a single model with a cost/quality dial.
"No Auto Router surcharge"; you pay the standard rate for whichever model is
selected. **OpenAI-compatible:** yes (a model id on OpenRouter's endpoint).

## UTK Relevance

The mainstream productized router UTK's `@utk/model-proxy` competes with / can sit
behind. The `cost_quality_tradeoff` dial and `allowed_models` allowlist are the
minimum knob set a proxy router should expose. Its engine (NotDiamond) is the learned
component; UTK's differentiator is training-free selection + recoverable artifacts +
token compression on top of whatever model is chosen.

## Caveats

- All four brief claims verified (NotDiamond-powered; complexity/task/capability
  signals; `cost_quality_tradeoff`; `allowed_models`; returns model used).
- **No published effectiveness numbers** — routing quality is unmeasured on these
  pages; the NotDiamond engine's figures are vendor/case-study only.
