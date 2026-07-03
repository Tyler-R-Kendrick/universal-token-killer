---
type: category
title: Tool-Output Mediation
description: UTK's core axis — evict raw tool payloads to recoverable .utk/ references and return compact, schema-routed, serialized responses to the model.
tags: [techniques, tool-output-mediation, internal]
timestamp: 2026-07-03T00:00:00Z
---
# Tool-Output Mediation

Internal note. Keep public docs focused on shipped UTK behavior.

UTK's **home axis** (Axis 1 in [gaps](/gaps.md)). It mediates the tool
event boundary: the full result is persisted to disk, chat receives a compact,
recoverable response. This is the safe side of the [CAVEWOMAN](/research/cavewoman/overview.md)
rule — compress output freely, keep input recoverable.

## Techniques in this axis

| Technique | What it does | Shipped surface |
|---|---|---|
| Raw-payload eviction + reference stubs | Persist full output to `.utk/`, return a ≤400-char stub | [Artifacts And Recovery](/features/architecture/artifacts.md) |
| Structural serializers (TOON / TRON / json-compact) | Compact structural notations for tool output | [Serialization Providers](/features/serialization/serialization.md) |
| Schema inference + shape-based routing | Deduplicate repeated shapes, route by fingerprint | [Schema Routing](/features/serialization/schema-routing.md) |
| detok text compression | LLMLingua-2 rewriting of LLM-bound text | [Detok MCP](/features/detok/detok-mcp.md) |
| Tool-call bypass (lexical + embedding) | Skip redundant tool calls | [Bypass eval scenarios](/features/evals/tool-calling-bypass-scenarios.md) |
| Bash-like tool templates + memoization | Structured invocation planning with exact-match cache | [Bash-Like Tool Templates](/features/serialization/bash-like-tool.md) |

## Underlying research

- Input/detok compression → [prompt compression](/research/prompt-compression/overview.md)
  (the LLMLingua family, Selective Context) is the academic baseline UTK's detok seam must beat or gate.
- Serialization notation accuracy cost is an open validation gap — see [gaps](/gaps.md).

## Nearest competition

- [RTK](/features/evals/rtk-parity.md) (shell-only predecessor UTK generalizes),
  [Headroom](/competition/headroom/research.md),
  [Serena](/competition/serena/research.md),
  [lean-ctx](/competition/lean-ctx/research.md),
  [OpenSlimEdit](/competition/openslimedit/research.md).
