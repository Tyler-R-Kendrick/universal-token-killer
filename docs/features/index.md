# Features

## Subcategories

* [Architecture](/features/architecture/) - UTK is a mediation layer between GitHub Copilot tool events and model-visible responses.
* [Copilot Hook](/features/copilot-hook/) - UTK mediates Copilot tool-hook payloads when the event exposes enough data to be observed safely.
* [Detok](/features/detok/detok-mcp.md) - detok is a local stdio MCP server that rewrites LLM-bound text with LLMLingua-2 before the text is sent to a model.
* [Evals](/features/evals/) - UTK's benchmark suites as AgentV SDK evals: custom SDK assertions, configurable targets, agentv compare for A/B deltas, an on-demand GitHub dispatch workflow, Harbor-backed trusted benchmarks, and the n-run tool-calling token-efficiency benchmark.
* [Getting Started](/features/getting-started/) - UTK uses project-local TOML configuration at .utk/config.toml.
* [Model Proxy](/features/model-proxy/model-proxy.md) - @utk/model-proxy is UTK's OpenAI-compatible local proxy.
* [Serialization](/features/serialization/) - UTK includes an internal helper for bash-like tool invocation planning.
* [Skills](/features/skills/) - UTK ships repo-local agent skills for agents that operate the hook-first workflow without adding a public CLI or VS Code extension.
