# Compresr Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Primary website: https://compresr.ai/
Context Gateway repository: https://github.com/Compresr-ai/Context-Gateway
Observed Context Gateway revision: `aa29d621e03cadaf464a9194e6a2647cf3ec09ab`
SDK repository: https://github.com/Compresr-ai/Compresr-SDK
Observed SDK revision: `87a743e0a4d4e2c175c011f21892ab32cc07e3d7`
VS Code extension repository: https://github.com/Compresr-ai/compresr-vscode
Observed VS Code extension revision: `0cb4a60cb9fdf9b47e8c439ca71895e8ba61293c`

## Install And Configuration Status

Compresr was researched from public web pages and temporary clones only. It was
not installed or configured in this workspace.

Documented public install paths:

```powershell
pip install compresr
curl -fsSL https://compresr.ai/api/install | sh
context-gateway
```

Documented product surfaces:

- hosted Compresr API at `api.compresr.ai`;
- Python SDK package `compresr`;
- TypeScript SDK under `Compresr-SDK/typescript`;
- Context Gateway, a Go proxy for agent/model API traffic;
- VS Code extension for compressing Markdown context files;
- on-prem deployment option for enterprise/VPC usage.

Important caveat: Compresr's strongest compression path is a remote service by
default. The VS Code extension explicitly sends selected file contents to
`api.compresr.ai`, and the SDK requires a Compresr API key. This differs from
UTK's local-first detok/LLMLingua promise and from UTK's project-local `.utk/`
artifact model.

## Core Positioning

Compresr positions itself as an intelligent context-compression service that
reduces LLM token costs by dropping irrelevant context before it reaches the
model. Its public site emphasizes query-aware compression for documents and
prompts, while Context Gateway extends the idea to agent workflows by acting as
a transparent proxy between the agent and the LLM API.

This differs from UTK's intended center:

- Compresr compresses prompt/document context through a hosted API and can proxy
  whole LLM conversations.
- Context Gateway compresses history, tool outputs, tool schemas, and tool
  discovery payloads at the provider-request layer.
- UTK mediates GitHub Copilot tool calls directly, persists raw artifacts,
  infers schemas, routes outputs, serializes compact responses, and exposes
  hook/plugin/skill integration without becoming a public CLI or model proxy.

The overlap worth studying is Context Gateway's tool-output pipeline: provider
adapters extract tool results, compression is gated by token thresholds and
format checks, compressed results carry shadow references, and an injected
`expand_context` tool can recover the original output.

## Capability Inventory

| Capability | What it does | How Compresr implements it | UTK relevance |
|---|---|---|---|
| Hosted token compression API | Compresses long text before it enters an LLM call. | SDKs call remote `/compress/question-agnostic/` or `/compress/question-specific/` endpoints with context, model name, ratio, and optional query. | Useful benchmark target, but UTK should not require remote compression for its default path. |
| Agnostic compression | Compresses without a user query. | SDK model `espresso_v1` routes to question-agnostic endpoints and omits query-specific options. | Similar to UTK's safe natural-language detok path when no route/query is available. |
| Query-specific compression | Keeps context relevant to a query. | SDK model `latte_v1` requires `query`; supports coarse paragraph-level mode, heuristic chunking, and placeholder control. | Strong fit for tool-output mediation: use tool intent, last user query, or schema route as preservation signal. |
| Target compression ratio | Lets users choose compression aggressiveness. | Public docs describe ratios from light to aggressive; SDK accepts `target_compression_ratio`. Context Gateway validates 0.1 to 0.9 as removed-token fraction. | UTK TOML should expose comparable provider-specific aggressiveness while preserving hard fact-retention tests. |
| Batch compression | Compresses multiple contexts in one request. | Python and TypeScript SDKs provide batch APIs with shared or per-item queries. | Useful for future UTK route/schema refresh over many tool outputs or session-skill candidates. |
| Streaming compression | Streams compressed output chunks. | SDK exposes streaming methods for agnostic and query-specific compression. | Less central for Copilot hooks, but relevant for large non-shell tool outputs and UI feedback. |
| Context Gateway proxy | Routes agent LLM requests through a local proxy. | Go binary wizard configures provider keys, agent selection, threshold, compression model, and logs. | Competitive surface is broader than UTK. UTK should stay hook-first and avoid proxying model traffic by default. |
| Preemptive history compaction | Summarizes conversation history before the context limit is hit. | Background worker queues summarization at a threshold, stores a ready summary, and logs to `history_compaction.jsonl`. | Adjacent to UTK session-agents/session-skills. UTK can reduce repeated instructions without rewriting full chat history. |
| Tool-output compression | Compresses large tool results before forwarding the LLM request. | Provider adapters extract tool outputs, format/token gates decide eligibility, strategies call Compresr API or local simple/trimming fallbacks, and results are patched back into the request. | Direct competitor. UTK should beat this by using schema-aware TOON/compressed JSON plus raw artifact recovery for Copilot tool calls. |
| Cost-aware gating | Skips compression when compression is not economically worth it. | Tool-output pipe checks target model cost tier unless `bypass_cost_check` is enabled. | UTK metrics should include "compression cost worth it" gates, especially when a remote or expensive compressor is configured. |
| Content-format gating | Compresses only eligible text formats. | Adapters detect content format; config supports allowed/forbidden formats with defaults for text, JSON, and Markdown. | UTK already needs protected fields and binary envelopes. A first-class format classifier would make policy clearer. |
| Skip-tool policy | Avoids compressing specific tool categories. | `skip_tools` resolves provider-specific names and records skipped mapping status. | UTK TOML per-tool overrides should support deny/allow by tool id, pattern, and content class. |
| Shadow references | Stores originals and inserts a compact reference. | Tool-output content is hashed, originals are stored with short TTL, compressed content is cached with longer TTL, and returned text can include `[REF:id]`. | Strong recovery pattern. UTK's `.utk/` artifact paths are more durable; compact responses should expose stable artifact/schema/route ids. |
| `expand_context` tool | Lets the model recover full compressed content. | Gateway injects a phantom tool named `expand_context` with provider-specific JSON schemas. | UTK can expose recovery through skills/hooks without an MCP-first design. For Copilot, recovery should point to `.utk/` artifacts. |
| KV-cache preservation | Keeps already-compressed outputs stable across turns. | Dual TTL store caches compressed results for 24 hours and skips outputs already prefixed with `[REF:]`. | UTK should keep compact response fingerprints stable for identical artifacts and schema routes. |
| Tool discovery compression | Filters and defers tool schemas. | Gateway can use a `tool-search` dispatcher, tool-discovery API, and per-tool schema compression with `tdc_coldbrew_v1`/`toc_latte_v1` style models. | Very relevant to UTK's generated schemas/templates and llguidance-backed bash-like tool. |
| Structured prefix preservation | Keeps an initial structural prefix verbatim. | Structured detector uses JSON/YAML/XML detection and cuts near structural boundaries before compressing the rest. | UTK should prefer schema serialization over prefix-only preservation, but prefix preservation is a useful fallback. |
| Metrics and logs | Writes compression and telemetry JSONL files. | Logs include `history_compaction.jsonl`, `tool_output_compression.jsonl`, `telemetry.jsonl`, session stats, savings, and aggregation. | UTK should continue reporting raw/compact tokens, route confidence, artifact recoverability, and fact retention in evals and runtime stats. |
| Prompt history store | Records prompts for querying and dashboard workflows. | SQLite store under `~/.config/context-gateway/prompt_history.db` with FTS and session/model/provider filters. | UTK should avoid broad global prompt capture by default; project-local `.utk/` histories are safer. |
| VS Code Markdown compression | Compresses `.md` context files with preview, backup, and restore. | Extension commands call remote API, preview side-by-side diff, create `.bak`, and support workspace-wide Markdown compression. | UTK previously removed accidental VS Code-extension direction. The safety model is useful, but UTK should not become a VS Code file-compression extension. |
| On-prem option | Allows private deployment of the compression service. | Public pricing page offers VPC/on-prem with volume pricing and domain-tuned models. | Enterprise-friendly, but UTK's local-first path is a differentiator for sensitive code/tool outputs. |

## Implementation Mechanics

### SDK Compression

The SDK exposes two public compression shapes:

- question-agnostic compression with `espresso_v1`;
- query-specific compression with `latte_v1`.

Both Python and TypeScript clients validate request schemas, select endpoints
based on whether `query` is present, and return token accounting fields:
original context, compressed context, original tokens, compressed tokens, actual
compression ratio, tokens saved, and duration. The SDK supports sync, async,
streaming, and batch variants.

For UTK, the useful pattern is a clean provider interface that exposes token
metrics with every result. The risk is remote dependency: a hosted API may be
fine as an optional provider, but UTK defaults should remain deterministic,
local, and recoverable.

### Context Gateway Pipeline

Context Gateway is a Go proxy that sits between an agent and provider API. The
public docs say it monitors token usage, pre-computes summaries near 75 percent
of context limit, compresses large tool outputs on the fly, and records JSONL
events.

The inspected source shows several concrete pipes:

- preemptive history summarization;
- tool-output compression;
- tool-discovery filtering;
- schema/search-result compression;
- task/subagent output handling;
- provider adapters for Anthropic, OpenAI, Gemini, Bedrock, LiteLLM, Ollama,
  and others.

This is broader than UTK's desired hook-only footprint. The competitive lesson
is not to build a whole proxy. The lesson is to make UTK's narrower Copilot
tool-event surface more precise, more deterministic, and easier to audit.

### Tool-Output Compression

The tool-output pipe:

1. extracts provider-native tool outputs through adapters;
2. skips disabled, passthrough, cheap-model, missing-adapter, empty, already
   compressed, denied-tool, unsupported-format, too-small, and too-large cases;
3. derives a query from assistant intent, last user message, tool names, or
   empty string for query-agnostic models;
4. hashes original content into a shadow id;
5. reuses cached compressed content when available;
6. stores original content for expansion;
7. compresses through configured strategy;
8. rejects compression if token savings do not clear `refusal_threshold`;
9. patches compressed content back into the provider request;
10. records mapping status and token metrics.

This is the closest competitive match to UTK. UTK's advantage should be
schema-aware compact serialization and project-local artifacts. Compresr's
approach is relevance compression plus recoverability; UTK should make
recoverability stronger by using real files under `.utk/` rather than in-memory
TTL storage.

### Expand Context And Shadow Store

Context Gateway stores originals with a default short TTL and compressed
variants with a longer TTL. It injects an `expand_context` tool whose schema is
precomputed for Anthropic, OpenAI Chat Completions, and OpenAI Responses. When
the model needs detail, it can call `expand_context` with the shadow id.

This is a good UX pattern: compressed text includes an affordance that explains
how to recover more detail. UTK should adapt the idea without requiring a model
proxy. A Copilot compact response can include artifact ids and a skill-guided
recovery path, and session-agents/session-skills can know how to retrieve raw
artifacts from `.utk/`.

### Tool Discovery And Schema Compression

Compresr's gateway includes a separate tool-discovery pipe. It can filter large
tool sets, defer tool schemas behind a search tool, and compress individual
tool schemas when they are requested. The config comments distinguish:

- stage 1: tool discovery, using a discovery model;
- stage 2: schema compression, using a tool-output compression model;
- optional search-result compression for returned tool schemas.

This overlaps with UTK's generated schemas/templates and the desired
llguidance-backed bash-like tool. UTK should preserve this architecture goal:
do not only compress outputs after the fact; also reduce tool-choice and
argument-construction tokens through generated schemas, templates, and formal
completion constraints.

### VS Code Extension

The VS Code extension is intentionally file-centric:

- commands for current-file compression, preview, workspace compression,
  restore, API key, model selection, and ratio selection;
- Markdown-only guard;
- side-by-side diff preview;
- `.bak` backup before applying changes;
- global VS Code setting for API key and defaults.

This is not a direction UTK should copy as a primary product surface. It is,
however, a useful safety reference for any user-approved file rewrite: preview,
backup, explicit apply/discard, and clear API/data disclosure.

## Competitive Opportunities For UTK

1. Beat Compresr's proxy-based tool-output compression on Copilot-native
   precision: mediate actual Copilot tool events instead of rewriting provider
   requests indirectly.
2. Make `.utk/` artifacts a stronger recovery substrate than TTL shadow refs:
   raw artifact path, serialized artifact path, schema id, route id, serializer
   id, and deterministic content hash in every compact response.
3. Prefer deterministic TOON/compressed-JSON for structured outputs before
   semantic compression. Compresr's relevance compression can drop details; UTK
   should prove required fact retention in CI.
4. Add query/intent-aware compression only after schema/template parsing, using
   the safe field policy already developed for detok/LLMLingua.
5. Add cost-aware routing: skip expensive compression when a tool result is
   short, already compact, low-value, or heading to a cheap model.
6. Add tool-format policy like Compresr's allowed/forbidden content formats,
   but make protected fields mandatory for commands, paths, ids, patches,
   diffs, globs, regexes, and file contents.
7. Expand UTK metrics to report cache/reuse behavior: compact fingerprint
   stability, repeated-output cache hits, artifact recovery success, and
   required-fact retention.
8. Add eval scenarios matching Compresr strengths: large tool outputs, query
   relevance, structured JSON with prefix preservation, tool schema search,
   skipped tools, cheap-model bypass, and expansion/recovery.
9. Keep UTK non-CLI/non-proxy. Internal hook runners and marketplace metadata
   can exist, but the user-facing product should stay Copilot hook + skills +
   project-local artifacts.
10. Preserve local-first differentiation. Compresr's hosted API and on-prem
   offering are strong, but UTK can win sensitive coding-agent workflows by
   keeping raw tool outputs local by default.

## Risks To Avoid

- Do not adopt a public proxy/CLI shape just because Compresr has one. UTK's
  constraint remains hook-first and non-CLI.
- Do not send code, tool outputs, or Markdown context to a remote compressor by
  default. Remote providers must be explicit opt-in.
- Do not rely on lossy semantic compression for structured facts when schema
  serialization can preserve them deterministically.
- Do not use in-memory-only TTL recovery for core artifacts. UTK's recovery
  story should be project-local and durable.
- Do not compress operational fields. Commands, paths, URLs, ids, diffs,
  patches, regexes, globs, and file contents need hard protection.
- Do not treat token savings as sufficient proof. Every competitive eval needs
  fact retention and recoverability metrics.

## Source Files And Pages Reviewed

Public web pages:

- https://compresr.ai/
- https://compresr.ai/docs/overview
- https://compresr.ai/docs/sdk
- https://compresr.ai/docs/gateway
- https://compresr.ai/docs/models
- https://compresr.ai/pricing
- https://pypi.org/project/compresr/
- https://marketplace.visualstudio.com/items?itemName=compresr.compresr

Temporary clone files:

- `Context-Gateway/README.md`
- `Context-Gateway/cmd/agent.go`
- `Context-Gateway/cmd/agent_yaml.go`
- `Context-Gateway/cmd/wizard_core.go`
- `Context-Gateway/cmd/wizard_pipes.go`
- `Context-Gateway/internal/adapters/adapter.go`
- `Context-Gateway/internal/adapters/anthropic.go`
- `Context-Gateway/internal/adapters/openai.go`
- `Context-Gateway/internal/pipes/config.go`
- `Context-Gateway/internal/pipes/tool_output/tool_output.go`
- `Context-Gateway/internal/pipes/tool_output/simple_compressor.go`
- `Context-Gateway/internal/pipes/tool_output/trimming_compressor.go`
- `Context-Gateway/internal/pipes/tool_output/structured_prefix.go`
- `Context-Gateway/internal/phantom_tools/expand_context.go`
- `Context-Gateway/internal/store/store.go`
- `Context-Gateway/internal/preemptive/worker.go`
- `Context-Gateway/internal/prompthistory/prompthistory.go`
- `Context-Gateway/internal/monitoring/savings.go`
- `Context-Gateway/internal/monitoring/aggregator.go`
- `Compresr-SDK/typescript/src/clients/compression.ts`
- `Compresr-SDK/typescript/src/schemas/compression.ts`
- `Compresr-SDK/typescript/src/config/constants.ts`
- `Compresr-SDK/python/compresr/services/compression.py`
- `Compresr-SDK/python/compresr/config.py`
- `compresr-vscode/src/extension.ts`
- `compresr-vscode/src/client.ts`
