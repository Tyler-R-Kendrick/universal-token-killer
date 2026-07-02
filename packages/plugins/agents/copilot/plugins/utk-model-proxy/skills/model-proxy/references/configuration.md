# Configuration And Metrics

`[model_proxy]` policy is loaded from `.utk/config.toml`, then environment overrides, then explicit server/library overrides.

## Key defaults

- `session_id_header = "x-utk-session-id"`
- `upstream_provider = "github-models"`
- `upstream_base_url = "https://models.github.ai/inference"`
- `history_compaction_mode = "replace-with-summary-block"`
- `dedupe_policy = "compact"`
- `stale_error_policy = "compact"`
- `tool_discovery_mode = "static-filter"`
- `deferred_tool_search_enabled = true`
- `remote_compressors_enabled = false`
- `prompt_compression_enabled = true`
- `prompt_compression_provider = "github-models"`
- `prompt_compression_min_tokens = 64`
- `provider_strict_mode = false`
- `protected_tools = ["edit", "write", "apply_patch", "auth*", "secret*"]`
- `protected_file_patterns = [".env*", "*.pem", "*.key"]`

## Provider routing

- `github-models`: `/v1/chat/completions` -> `/inference/chat/completions`; `/v1/models` -> `/catalog/models`; uses `Authorization: Bearer` plus GitHub API version headers.
- `azure-ai-inference`: `/v1/chat/completions` -> `/models/chat/completions?api-version=...`; uses the `api-key` header for API keys.
- `azure-openai`: uses Foundry/OpenAI v1-compatible base URLs such as `https://<resource>.openai.azure.com/openai/v1`.
- `openai`: keeps normal OpenAI-compatible `/v1` routing.

Provider ids are open-ended. Custom providers are injected as `UpstreamProviderAdapter` implementations that build requests and hydrate typed options from `provider_options`; prompt compression can use the same adapter registry.

```toml
[model_proxy]
upstream_provider = "acme-provider"
prompt_compression_provider = "acme-compressor"
provider_options = { acme-provider = { tenant = "enterprise" }, acme-compressor = { region = "east" } }
```

## Metrics

`GET /metrics` reports request and stream counts, raw/compact tokens, prompt-token savings, tool-discovery savings, session blocks, dedupe and stale-error counts, provider failures, cache-volatility findings, recovery expansions, providers, route reasons, and last artifact id.
