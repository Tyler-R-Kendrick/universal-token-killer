# Configuration

UTK uses project-local TOML configuration at `.utk/config.toml`. Missing config is created automatically on first mediation.

## Default Config

```toml
[serialization]
default = "toon"

[serialization.providers.toon]
enabled = true

[serialization.providers.json-compact]
enabled = true

[serialization.providers.tron]
enabled = true

[plugins]
serialization_paths = [".utk/plugins/serialization"]

[routing]
deterministic_confidence_threshold = 0.95
constrained_routing_enabled = true

[persistence]
raw_outputs = true
storage_root = ".utk"

[detok]
enabled = true

[detok.prompt]
model = "default/LLMLingua2"
rate = 0.33
min_chars = 0

[detok.copilot_pre_tool_use]
enabled = true
rate = 0.33
min_chars = 8000
deny_tools = ["bash", "powershell", "create", "edit", "view", "grep", "glob"]
rewrite_fields = ["prompt", "instructions", "description", "question", "message", "summary", "notes", "body"]
protected_fields = ["command", "cmd", "path", "file", "files", "cwd", "url", "pattern", "regex", "glob", "patch", "diff", "content", "old_string", "new_string", "id"]

[tools]
registry = []

[tracing]
enabled = false
capture_inputs = true
capture_outputs = true
emit_eval_set = true
storage_root = ".utk/events"
process_id = "utk"

[model_proxy]
enabled = true
host = "127.0.0.1"
port = 8787
upstream_provider = "github-models"
upstream_base_url = "https://models.github.ai/inference"
upstream_api_version = "2026-03-10"
upstream_organization = ""
compression_level = "standard"
min_tokens = 1024
reserve_output_tokens = 4096
tool_discovery_mode = "static-filter"
cache_volatility = "observe"
session_id_header = "x-utk-session-id"
session_blocks_enabled = true
history_compaction_mode = "replace-with-summary-block"
history_compaction_enabled = true
history_compaction_threshold = 0.75
dedupe_policy = "compact"
stale_error_policy = "compact"
purge_error_after_turns = 4
artifact_search_enabled = true
context_proofs_enabled = true
deferred_tool_search_enabled = true
provider_strict_mode = false
prompt_asset_style = "pipe-index"
remote_compressors_enabled = false
prompt_compression_enabled = true
prompt_compression_provider = "github-models"
prompt_compression_model = "openai/gpt-4.1"
prompt_compression_base_url = "https://models.github.ai/inference"
prompt_compression_api_version = "2026-03-10"
prompt_compression_min_tokens = 64
prompt_compression_timeout_ms = 2500
inject_expand_context = true
minimize_tool_schemas = true
expand_edit_ranges = true
protected_fields = ["command", "cmd", "path", "file", "files", "cwd", "url", "pattern", "regex", "glob", "patch", "diff", "content", "old_string", "new_string", "id"]
protected_tools = ["edit", "write", "apply_patch", "auth*", "secret*"]
protected_file_patterns = [".env*", "*.pem", "*.key"]
deny_tools = ["auth*", "secret*", "credential*"]

[prompt_optimization]
enabled = true
surfaces = ["system-prompt", "ghcp-agent", "agent-skill", "tool-definition", "recovery-tool", "copilot-instructions", "session-agent", "session-skill"]
min_tokens = 256
target_ratio = 0.50
persist_originals = true
cache_volatility = "observe"
asset_style = "pipe-index"
```

Current note: `.utk/config.toml` itself and core mediation artifacts are project-local under `.utk/`. `persistence.storage_root` is also used by auxiliary template helpers; keep it at `.utk` unless you are deliberately testing alternate storage behavior.

## Serializer Overrides

Set a global provider:

```toml
[serialization]
default = "tron"
```

Override individual tools by exact id or trailing wildcard:

```toml
[[serialization.overrides]]
tool = "shell.git.diff"
provider = "json-compact"

[[serialization.overrides]]
tool = "shell.gh.*"
provider = "toon"
```

Built-in providers are `toon`, `json-compact`, and `tron`; `compressed-json` remains an alias for existing configs. Serialization plugins load from `packages/plugins/serialization` for maintained defaults, from `.utk/plugins/serialization/<plugin-name>` for workspace plugin packs, and from installed `.utk/packs/<pack-name>` roots. Each plugin pack must include `utk.pack.toml`, a valid `.lark` grammar, and a registrar module. Unsupported or disabled providers fail with explicit configuration errors that include loaded provider ids.

## Detok Hook Policy

Disable all LLMLingua-2 rewriting:

```toml
[detok]
enabled = false
```

Disable only the automatic Copilot `preToolUse` hook path:

```toml
[detok]
enabled = true

[detok.copilot_pre_tool_use]
enabled = false
```

Allow one normally denied tool when a specific prose field is safe to rewrite:

```toml
[[detok.copilot_pre_tool_use.overrides]]
tool = "workspace.ask"
enabled = true
rewrite_fields = ["prompt", "instructions"]
protected_fields = ["path", "file", "content", "patch", "diff", "id"]
```

The hook only returns `modifiedArgs` when compression actually changes an allowlisted field. Errors, unavailable LLMLingua, short text, denied tools, and protected fields fail open.

## Detoks Prompt Model

CLI `utk detoks-prompt` and MCP `detoks-prompt` read `.utk/config.toml`. Use CLI `--file` or `--stdin` for large prompts to keep prompt text outside agent context:

```powershell
node packages/cli/dist/utk.js detoks-prompt --file .\prompt.md
Get-Content .\prompt.md -Raw | node packages/cli/dist/utk.js detoks-prompt --stdin
```

```toml
[detok.prompt]
model = "default/LLMLingua2"
rate = 0.33
min_chars = 0
```

Model ids use `<provider>/<model>`. Built-in ids:

- `default/LLMLingua2`: local LLMLingua-2 path, default.
- `Hugging-Face/Kompress-small`: optional local Kompress-small adapter; requires Kompress inference package; for natural-language prompt spans only.

Prompt compression protects fenced code, indented code, inline code, Markdown blockquotes, and quoted strings. Only remaining natural-language spans are sent to compression model.

## Registered Structured Tools And Cache Policy

Opt fields into UTK's completion handling and caching by naming them in the tool registry. UTK matches user input against `completions` using a normalized-text comparison (case-folded, punctuation collapsed to spaces) and returns the matched completion value **as-is** — no observation-based normalization is applied to the returned string. Tool definitions may also set `curry_fields` to a subset of field names; planner-missed curry fields are auto-filled from the first completion before the invocation is returned.

```toml
[[tools.registry]]
tool = "github.search.issues"
description = "Issue index search"
output_cache = true
bypass_on_cache = true
curry_fields = ["query"]

[[tools.registry.structured_fields]]
name = "query"
completions = ["is:issue is:open label:bug"]
required = true
```

- Per-field grammars are persisted only as `.lark` files at `.utk/tools/<normalized-tool-id>/fields/<normalized-field>.lark` — both the tool id and the field name pass through `normalizeToolId`, so dots and other punctuation are flattened to dashes on disk. `.grammar.json` sidecars are not supported; `lintPack` rejects packs that include them.
- `output_cache = true` enables local cache writes keyed by tool input.
- `bypass_on_cache = true` allows pre-tool hook denial on cache hits to skip repeat calls.
- Optional `completions` provide canonical example values; UTK matches them against the normalized input but does not require them.

## Tracing

UTK can emit per-run traces in the [agentevals.io](https://agentevals.io) open standard. Tracing is **off by default**; turn it on per-workspace:

```toml
[tracing]
enabled = true              # default: false
capture_inputs = true       # include utk.inputs tags on spans
capture_outputs = true      # include utk.outputs tags on spans
emit_eval_set = true        # also write <run>.eval_set.json next to the jaeger.json
storage_root = ".utk/events"
process_id = "utk"          # process key in the Jaeger document
```

When enabled, every traced mediation writes Jaeger JSON + (optionally) a Google-ADK EvalSet derived from the spans. See [Tracing](tracing.md) for the wiring overview and [refs/agentevals-spec.md](refs/agentevals-spec.md) for canonical wire shapes.

## Model Proxy

`@utk/model-proxy` is the approved public proxy package. It exposes an OpenAI-compatible local endpoint for explicit opt-in use:

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `GET /v1/models`
- `GET /healthz`
- `GET /metrics`
- `POST /v1/utk/expand_context`
- `POST /v1/utk/find_tool`
- `POST /v1/utk/proof`

Environment defaults:

```powershell
$env:UTK_MODEL_PROXY_HOST = "127.0.0.1"
$env:UTK_MODEL_PROXY_PORT = "8787"
$env:UTK_MODEL_PROXY_UPSTREAM_PROVIDER = "github-models"
$env:UTK_MODEL_PROXY_UPSTREAM_BASE_URL = "https://models.github.ai/inference"
$env:UTK_MODEL_PROXY_UPSTREAM_API_KEY = $env:GITHUB_TOKEN
$env:UTK_MODEL_PROXY_WORKSPACE_ROOT = "<workspace path>"
```

The development default uses GitHub Models so VS Code/Microsoft Foundry AI Toolkit workflows can allocate or defer model choice through the model catalog. GitHub Models chat traffic maps `/v1/chat/completions` to `https://models.github.ai/inference/chat/completions`, and `/v1/models` to `https://models.github.ai/catalog/models`.

Azure AI Inference services:

```toml
[model_proxy]
upstream_provider = "azure-ai-inference"
upstream_base_url = "https://<resource>.services.ai.azure.com/models"
upstream_api_version = "2024-05-01-preview"
```

Foundry OpenAI v1-compatible deployments:

```toml
[model_proxy]
upstream_provider = "azure-openai"
upstream_base_url = "https://<resource>.openai.azure.com/openai/v1"
```

Prompt compression is model-backed when credentials are available. By default it calls GitHub Models with `prompt_compression_model = "openai/gpt-4.1"` and a bounded `prompt_compression_timeout_ms = 2500`, then intercepts system, developer, and user prompt text before the final upstream request. Tool outputs still use UTK routing, TOON/compressed JSON, `.utk` artifacts, and expansion refs before any model-backed compression.

`POST /v1/utk/expand_context` accepts `{ "id": "...", "range": "N-M", "query": "text", "blockId": "b0001" }` or `{ "handle": { "artifactId": "...", "range": "N-M" } }` for full, line-range, search, block, or handle-based recovery from indexed `.utk/model-proxy` artifacts. `POST /v1/utk/find_tool` resolves deferred tool catalogs. `POST /v1/utk/proof` returns deterministic stored raw/compact hash, fact-retention, no-leakage, and recovery checks for an artifact id.

## Defaults And Precedence

Configuration is resolved in this order:

1. exact tool override;
2. trailing wildcard override;
3. global `serialization.default`;
4. built-in default `toon`.

An override only applies if the selected provider is enabled.

## Common Profiles

Prefer TOON globally, but use JSON for diffs:

```toml
[serialization]
default = "toon"

[[serialization.overrides]]
tool = "shell.git.diff"
provider = "json-compact"
```

Prefer JSON for all GitHub CLI output:

```toml
[serialization]
default = "toon"

[[serialization.overrides]]
tool = "shell.gh.*"
provider = "json-compact"
```

Prefer TRON globally, but use TOON for one tool family:

```toml
[serialization]
default = "tron"

[[serialization.overrides]]
tool = "shell.gh.*"
provider = "toon"
```
