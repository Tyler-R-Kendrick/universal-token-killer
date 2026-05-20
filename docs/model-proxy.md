# Model Proxy

`@utk/model-proxy` is UTK's OpenAI-compatible local proxy. It forwards Chat Completions, Responses, and Models requests while reducing repeated context before it reaches the upstream provider.

## Pipeline

Request flow:

```text
normalize -> resolve policy -> budget -> prompt optimize -> content route -> retention -> tool discovery -> artifact persist -> forward -> recover/retry
```

Default behavior is local-first:

- prompt and tool-output originals are stored under `.utk/model-proxy`;
- compact model-visible text carries `utk-ref` or `utk-prompt-ref` handles;
- high-pressure sessions replace eligible old history/tool spans with recoverable `[utk-block:<id>]` summary messages;
- deferred tool discovery can send only `utk_find_tool` plus recovery/protected tools, then retry once when the upstream requests a schema;
- model-backed prompt compression can intercept system, developer, and user prompts before the final upstream request;
- repeated and stale read-only tool outputs compact to handles while raw artifacts remain authoritative;
- cache-volatility detection is observe-only;
- remote compressors and model downloads are disabled by default.

## Endpoints

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/models`
- `GET /healthz`
- `GET /metrics`
- `POST /v1/utk/expand_context`
- `POST /v1/utk/find_tool`
- `POST /v1/utk/proof`

`/v1/utk/expand_context` accepts:

```json
{ "id": "utk_0123456789abcdef", "range": "10-20", "query": "error TS2322", "blockId": "b0001" }
```

or a compact handle:

```json
{ "handle": { "artifactId": "utk_0123456789abcdef", "range": "10-20", "routeId": "test-error" } }
```

Omit `range` and `query` for full recovery. `range` is 1-based and inclusive. `query` returns matching lines from the indexed raw artifact.

`/v1/utk/proof` accepts:

```json
{ "artifactId": "utk_0123456789abcdef", "requiredFacts": ["TS2322"] }
```

If `compactText` is omitted, the proxy verifies the stored compact artifact. It returns raw and compact hashes plus deterministic checks for raw artifact availability, compact artifact availability, hash match, required facts, raw leakage, and recovery.

`/v1/utk/find_tool` accepts:

```json
{ "catalogId": "utkc_0123456789abcdef", "query": "vitest tests" }
```

The response returns the best matching deferred tool schema or `tool: null`. Non-streaming upstream calls can invoke `utk_find_tool`; the proxy resolves one schema and retries once. Streaming calls stay pass-through.

## Config

`[model_proxy]` policy is loaded from `.utk/config.toml`, then environment overrides, then explicit server/library overrides.

Key defaults:

- `session_id_header = "x-utk-session-id"`
- `upstream_provider = "github-models"`
- `upstream_base_url = "https://models.github.ai/inference"`
- `upstream_api_version = "2026-03-10"`
- `history_compaction_mode = "replace-with-summary-block"`
- `dedupe_policy = "compact"`
- `stale_error_policy = "compact"`
- `tool_discovery_mode = "static-filter"`
- `deferred_tool_search_enabled = true`
- `remote_compressors_enabled = false`
- `prompt_compression_enabled = true`
- `prompt_compression_provider = "github-models"`
- `prompt_compression_model = "openai/gpt-4.1"`
- `prompt_compression_base_url = "https://models.github.ai/inference"`
- `prompt_compression_min_tokens = 64`
- `provider_strict_mode = false`
- `protected_tools = ["edit", "write", "apply_patch", "auth*", "secret*"]`
- `protected_file_patterns = [".env*", "*.pem", "*.key"]`

Provider routing:

- `github-models`: `/v1/chat/completions` -> `/inference/chat/completions`; `/v1/models` -> `/catalog/models`; uses `Authorization: Bearer` plus GitHub API version headers.
- `azure-ai-inference`: `/v1/chat/completions` -> `/models/chat/completions?api-version=...`; uses `api-key` header for API keys.
- `azure-openai`: uses Foundry/OpenAI v1-compatible base URLs such as `https://<resource>.openai.azure.com/openai/v1`.
- `openai`: keeps normal OpenAI-compatible `/v1` routing.

## Metrics

`GET /metrics` reports request and stream counts, raw/compact tokens, prompt-token savings, tool-discovery savings, session blocks, dedupe and stale-error counts, provider failures, cache-volatility findings, recovery expansions, providers, route reasons, and last artifact id.

## Competitive Coverage

UTK v3 tracks these competitor-inspired capabilities:

- Compresr: replace-with-summary-block history compaction, tool-output compaction, static/deferred tool discovery, expand-context recovery.
- Headroom: route-specific compactors, observe-only cache volatility, CCR-like artifact recovery and dedupe/stale policies.
- lean-ctx: line range/search/handle/block recovery, build-log route fixtures, stored compact/raw proof hashes.
- OpenSlimEdit: tool definition minimization, file-read/edit-loop compaction, line-range edit expansion.
- Kompress/CaveGemma: optional provider registry and fail-open provider error taxonomy after protected-span extraction.
- prompt-compression: pipe-index prompt assets with retrieval-led references.
