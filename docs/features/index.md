# Features

## Subcategories

* [Architecture](/features/architecture/) - UTK is a mediation layer between GitHub Copilot tool events and model-visible responses.
* [Copilot Hook](/features/copilot-hook/) - UTK mediates Copilot tool-hook payloads when the event exposes enough data to be observed safely.
* [Detok](/features/detok/detok-mcp.md) - detok is a local stdio MCP server that rewrites LLM-bound text with LLMLingua-2 before the text is sent to a model.
* [Evals](/features/evals/) - Multi-benchmark leaderboard (compression, needle-in-a-haystack, tool selection, agent workflows) comparing UTK, baseline, and competitor compaction techniques on tokens, quality, modeled cost, and modeled latency.
* [Getting Started](/features/getting-started/) - UTK uses project-local TOML configuration at .utk/config.toml.
* [Model Proxy](/features/model-proxy/model-proxy.md) - @utk/model-proxy is UTK's OpenAI-compatible local proxy.
* [Serialization](/features/serialization/) - UTK includes an internal helper for bash-like tool invocation planning.
* [Skills](/features/skills/) - UTK ships repo-local agent skills for agents that operate the hook-first workflow without adding a public CLI or VS Code extension.
