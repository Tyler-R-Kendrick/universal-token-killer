---
name: model-proxy
description: Use when configuring, running, or verifying the UTK model proxy — the OpenAI-compatible local context gateway for GitHub Copilot — including history compaction into recoverable [utk-block] summaries, deferred tool discovery (utk_find_tool), repeated/stale tool-output dedupe, route-specific compactors, observe-only cache-volatility detection, expand_context and proof recovery endpoints, prompt-compression policy, upstream provider routing (github-models, azure-ai-inference, azure-openai, openai), and .utk/model-proxy artifacts
---

# UTK Model Proxy

Use this skill to configure, run, and verify `@utk/model-proxy` — UTK's OpenAI-compatible local proxy that reduces repeated context before requests reach the upstream provider.

The proxy is context-gateway, not a public CLI or VS Code extension. It forwards Chat Completions, Responses, and Models requests while keeping originals local under `.utk/model-proxy` and returning compact, recoverable model-visible text. Default behavior is local-first: remote compressors and model downloads stay disabled unless explicitly enabled.

## References

- `references/pipeline.md`: request pipeline (normalize → policy → budget → prompt optimize → content route → retention → tool discovery → persist → forward → recover) and local-first compaction behavior.
- `references/endpoints-and-recovery.md`: HTTP endpoints plus `expand_context`, `proof`, and `find_tool` recovery contracts.
- `references/configuration.md`: `[model_proxy]` policy defaults, provider routing, and metrics.

## Commands

```bash
npm run build -w @utk/model-proxy
npm test -w @utk/model-proxy
```

Keep detok MCP and preToolUse hook guidance in the `detoks` skill and the `utk-detoks` plugin; keep tool-hook mediation in the `utk` skill.
