---
type: category
title: Context-Gateway Proxy
description: The @utk/model-proxy layer — compact repeated history, tool schemas, and context before they reach the upstream provider, and route models cost-aware.
tags: [techniques, context-gateway-proxy, internal]
timestamp: 2026-07-03T00:00:00Z
---
# Context-Gateway Proxy

Internal note. Keep public docs focused on shipped UTK behavior.

Axis 4 in [gaps](/gaps.md), owned by `@utk/model-proxy`: an
OpenAI-compatible local gateway that reduces repeated context *before* it reaches
the provider. It is also where UTK's [model-routing](/research/model-routing/overview.md)
adoption lands — route to the cheapest capable model **and** compress its prompt;
the savings compound because each attacks a different sink.

## Techniques in this axis

| Technique | What it does | Shipped surface |
|---|---|---|
| Query-aware content routing/compaction | Route-specific compactors for tool output | [Model Proxy](/features/model-proxy/model-proxy.md) |
| History compaction into session blocks | Replace history with `[utk-block:<id>]` | [Model Proxy](/features/model-proxy/model-proxy.md) |
| Retention: dedup + stale-error purge | Session ledger + retention policy | [Model Proxy](/features/model-proxy/model-proxy.md) |
| Tool-schema minimization | Shrink tool definitions | [Model Proxy](/features/model-proxy/model-proxy.md) |
| Tool discovery filtering / deferred search | Lexical filter + deferred `utk_find_tool` | [Model Proxy](/features/model-proxy/model-proxy.md) |
| Lazy edit-range expansion | Range → server-side expand | [Model Proxy](/features/model-proxy/model-proxy.md) |
| Cache-volatility detection (observe-only) | Report cache-busting tokens | [Model Proxy](/features/model-proxy/model-proxy.md) |

## Shipped-gap record

- [Gap matrix](/techniques/context-gateway-proxy/gap-matrix.md) — the before-v2 → v2
  register of context-gateway gaps UTK has already closed.

## Underlying research & competition

- **Model routing / cascade** is the adjacent research family →
  [model routing](/research/model-routing/overview.md).
- **Active cache alignment** and **semantic response caching** are open gaps
  (see [gaps](/gaps.md), Type A).
- Nearest product competition:
  [Headroom](/competition/headroom/research.md),
  [Compresr](/competition/compresr/research.md),
  [The Token Company](/competition/token-company/research.md),
  [OpenCode DCP](/competition/opencode-dcp/research.md).
