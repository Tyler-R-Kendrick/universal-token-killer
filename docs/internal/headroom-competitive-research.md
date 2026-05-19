# Headroom Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Upstream repository: https://github.com/chopratejas/headroom
Observed upstream revision: `10580439bb4227a3f6f375439b0baae60db2f288`

## Install And Configuration Status

Headroom was researched from a temporary clone only. It was not installed or
configured in this workspace.

Documented upstream install paths:

```powershell
pip install "headroom-ai[all]"
npm install headroom-ai
docker pull ghcr.io/chopratejas/headroom:latest
```

Documented runtime entrypoints:

```powershell
headroom proxy --port 8787
headroom wrap claude
headroom wrap codex
headroom wrap copilot
headroom mcp install
headroom learn --apply
```

Important caveat: Headroom is explicitly CLI/proxy/MCP/library centered. That
is useful as competitive research, but it conflicts with UTK's current product
constraint that UTK is hook-first and must not become a public CLI. Any adopted
capability should be implemented through UTK's Copilot hook, plugin, skill, or
internal runner surfaces.

## Core Positioning

Headroom describes itself as "the context compression layer for AI agents." The
public value proposition is broad context compression before content reaches an
LLM: tool outputs, logs, RAG chunks, files, conversation history, and message
arrays. It exposes that behavior through a Python package, TypeScript SDK,
OpenAI-compatible proxy, MCP server, agent wrappers, and plugin hooks.

This differs from UTK's intended center:

- Headroom compresses whole LLM request context and wraps agents through a
  proxy/CLI flow.
- UTK mediates GitHub Copilot tool calls, persists raw artifacts, infers output
  schemas, routes results, serializes compact responses, and keeps the hook as
  the primary integration point.

The overlap worth studying is Headroom's routing and recovery model:
ContentRouter chooses a compression strategy, SmartCrusher handles structured
JSON/tool output, CacheAligner preserves provider cache behavior, and CCR
stores originals so compressed results can be recovered later.

## Capability Inventory

| Capability | What it does | How Headroom implements it | UTK relevance |
|---|---|---|---|
| Universal compression library | Lets application code call `compress(messages)` directly. | Python package and TypeScript SDK normalize message formats, call the proxy/client, and return compressed messages in the original format. | UTK should not expose a public CLI, but a library-grade internal mediation API is still valuable for tests, hooks, and plugins. |
| OpenAI-compatible proxy | Inserts compression between agent/app and model provider. | `headroom proxy` starts a local server and provider adapters route Anthropic/OpenAI/other traffic through it. | Competitive scope is broader than UTK. UTK can avoid proxy complexity by focusing on Copilot tool events. |
| Agent wrap commands | Starts Headroom proxy plus selected coding agent. | `headroom wrap claude|codex|cursor|aider|copilot|openclaw` creates env/config and launches the agent. | UTK should not duplicate public wrapping, but can study provider-specific setup and failure modes for plugin registration. |
| GitHub Copilot wrap support | Routes Copilot CLI through Headroom as a BYOK provider/proxy. | `headroom.providers.copilot` builds `COPILOT_PROVIDER_*` env vars and validates provider/wire API choices. | UTK's hook path is more direct. The env-based proxy route is a fallback/competitor, not the desired architecture. |
| MCP server and MCP compression | Compresses MCP tool outputs and exposes retrieval/stats tools. | `headroom.integrations.mcp.server` profiles tools by name and uses SmartCrusher for JSON-shaped output; CCR retrieval is available through `headroom_retrieve`. | UTK previously ruled out an MCP server for core UTK, but `detok` is a separate MCP. The useful idea is per-tool profiles plus recovery, not an MCP-first product. |
| ContentRouter | Detects content type and chooses compression strategy. | Rust-backed detection plus Python routing for JSON, code, search, logs, mixed content, and text. | Strong fit. UTK's schema router can adopt a similar content-type front door before serializer selection. |
| SmartCrusher | Compresses large structured JSON arrays/tool outputs. | Python shim delegates to Rust/PyO3 `headroom._core.SmartCrusher`; emits CCR sentinels when rows are dropped. | Closest competitor to UTK's schema/TOON/compressed-JSON route. UTK should benchmark against row retention, fact retention, and schema compactness. |
| CodeCompressor | Compresses code using structural awareness. | ContentRouter routes source-like content to code-aware compression paths. | UTK should treat code/diff/file-content fields as protected by default, then optionally summarize through explicit policy. |
| Kompress text compression | Compresses prose/log text through ML-based compression. | README and routing comments describe Kompress-base/HF text compression for plain text. | Similar role to UTK's local LLMLingua2 detok path. UTK should keep exact spans protected and make compression policy observable. |
| CacheAligner | Protects provider KV cache hit rates. | Current implementation is detector-only: finds volatile values in system prompts and warns without rewriting. | Useful design lesson. UTK should report cache-hostile volatility but avoid mutating protected prompt/tool fields silently. |
| CCR reversible compression | Stores originals and inserts retrieval affordances. | CCR uses local hashes, markers, a retrieval tool definition, response handling, and optional proactive expansion. | Directly relevant. UTK's raw artifacts already provide recovery; adding explicit retrieval affordances and route metadata can compete with CCR. |
| Context tracker | Remembers compressed content across turns and may expand relevant data later. | CCR docs describe multi-turn tracking and proactive expansion when a later query matches compressed content. | UTK can approximate this through `.utk/` route histories and artifact lookup without proxying full model traffic. |
| Cross-agent memory | Shares memory across Claude, Codex, Gemini, and other agents. | README advertises shared store and auto-dedup; learn docs describe agent-native output files. | Adjacent. UTK should keep tool schemas/project artifacts local and deterministic before attempting cross-agent memory. |
| Failure learning | Mines past sessions and writes corrective project guidance. | `headroom learn` scans agent logs, builds a digest, calls an LLM, and writes marker-delimited sections to agent-native files. | Useful for future `utk-init`: generate tool schemas and recovery hints from observed sessions, but avoid hidden broad writes. |
| Plugin hooks | Ensures local Headroom runtime is available for initialized agents. | `plugins/headroom-agent-hooks` registers SessionStart and PreToolUse command hooks that call `headroom init hook ensure`. | Good packaging precedent for marketplace discoverability. UTK should keep hooks explicit and scoped to the selected integration. |
| TypeScript SDK hooks | Allows pre/post compression customization. | `CompressionHooks` exposes `preCompress`, `computeBiases`, and `postCompress` with token savings event data. | UTK serializer/route providers should expose similar observe-and-bias hooks internally, with TOML-backed policy. |
| RTK integration | Downloads/installs RTK and can configure context-tool hooks. | `headroom.rtk.installer` downloads a pinned RTK binary and can run `rtk init --global --auto-patch`; `HEADROOM_CONTEXT_TOOL` selects `rtk` or `lean-ctx`. | Important competitive point. Headroom can lean on RTK for shell-output rewriting; UTK should beat RTK directly for Copilot CLI-related tool calls without depending on RTK. |
| Benchmark/eval suite | Reports savings and accuracy preservation. | README claims workload savings and benchmark accuracy; source tree includes eval commands, parity fixtures, and CCR/SmartCrusher tests. | UTK should keep deterministic RTK parity metrics and add Headroom-inspired scenarios for JSON rows, logs, code search, cache volatility, and retrieval. |

## Implementation Mechanics

### Pipeline And Routing

Headroom's public architecture is:

```text
agent/app -> CacheAligner -> ContentRouter -> strategy compressor -> CCR -> LLM
```

The source-backed details are more nuanced:

- `ContentRouter` uses source hints, mixed-content detection, content-type
  detection, strategy selection, compression caching, and routing metadata.
- `SmartCrusher` is no longer a Python implementation. The Python module is a
  compatibility shim around a hard dependency on Rust/PyO3.
- `CacheAligner` is detector-only in the inspected revision. It flags volatile
  UUIDs, timestamps, JWT-like tokens, and hashes, but explicitly does not mutate
  prompts.
- MCP compression profiles are selected by tool-name regexes such as Slack,
  database/query, GitHub/git, logs, file-system, and generic fallback.

For UTK, the key pattern is deterministic routing before compression. UTK should
perform tool/schema detection first, then choose TOON, compressed JSON,
LLMLingua, or a protected pass-through envelope based on explicit policy.

### Reversibility And Retrieval

Headroom's CCR model stores original content and exposes a retrieval affordance.
Tool injection creates a `headroom_retrieve` function definition for OpenAI,
Anthropic, or Google-style tool schemas. Markers reference 24-character hashes
and may allow query-filtered retrieval.

This is highly relevant to UTK because `.utk/` raw artifacts already provide a
project-local recovery substrate. The gap is presentation: UTK should make
artifact ids, route ids, schema ids, and retrieval instructions first-class in
compact responses without leaking raw payloads.

### Copilot Integration

Headroom's Copilot integration is proxy-oriented. The wrapper builds environment
variables such as `COPILOT_PROVIDER_TYPE`, `COPILOT_PROVIDER_BASE_URL`,
`COPILOT_PROVIDER_WIRE_API`, and `COPILOT_PROVIDER_API_KEY`, then launches
Copilot CLI through the local proxy.

UTK's planned Copilot hook is narrower and safer for the current product:
observe the actual tool event, mediate safe inputs/outputs, and return
`modifiedArgs` or compact output only where GitHub's hook contract permits it.
This avoids turning UTK into a general LLM proxy.

### Agent Hooks And Plugin Packaging

Headroom ships a plugin bundle with hook metadata:

- `SessionStart` for `startup|resume`;
- `PreToolUse` for `Bash|PowerShell`;
- command: `headroom init hook ensure`.

The plugin manifest points at a hooks directory and describes the bundle as
startup hooks for Claude Code and GitHub Copilot CLI. This is a useful
marketplace packaging precedent, but it still depends on the public `headroom`
CLI. UTK should duplicate the discoverability pattern while keeping executables
internal hook runners, not public package `bin` commands.

### Failure Learning

`headroom learn` scans session logs for Claude Code, Codex, and Gemini, builds a
compact digest, calls an LLM, and writes marker-delimited learnings to
agent-native files such as `CLAUDE.md`, `AGENTS.md`, `MEMORY.md`, or
`GEMINI.md`.

For UTK, the analogous feature is `utk-init`: generate schemas/templates for
registered tools from observed calls, optional user descriptions, and known
tool contracts. The Headroom lesson is to keep generated sections
marker-delimited and idempotent, and to separate "analyze" from "apply."

## Competitive Opportunities For UTK

1. Beat Headroom on Copilot tool-call precision by mediating actual tool events
   instead of wrapping the whole model provider path.
2. Turn `.utk/` raw artifact persistence into a CCR-equivalent recovery story:
   stable artifact ids, schema ids, route ids, compact metadata, and explicit
   recovery commands/skills.
3. Add a ContentRouter-like pre-router that classifies shell text, JSON, arrays,
   logs, code search, test output, diffs, and arbitrary object outputs before
   selecting a serializer/provider.
4. Keep TOON and compressed JSON as deterministic default serializers. Use
   LLMLingua only for safe natural-language fields and protected text after
   schema/template parsing.
5. Add cache-volatility detection for prompt/tool metadata, but make it
   observe-only unless the user explicitly enables rewriting.
6. Compare UTK against Headroom-style scenarios in evals: structured JSON rows,
   large arrays, mixed logs, grep results, TypeScript errors, package-manager
   output, and non-shell Copilot tool outputs.
7. Report metrics Headroom does not make local and artifact-specific by default:
   raw tokens, compact tokens, serialized artifact tokens, recoverability score,
   required-fact retention, route confidence, and serializer id.
8. Avoid Headroom's surface-area sprawl. UTK should stay hook-first,
   project-local, and Copilot-native while still shipping skills/plugin metadata
   that make the behavior discoverable.

## Risks To Avoid

- Do not adopt Headroom's public CLI shape. UTK's executable entrypoints should
  remain internal hook/plugin runners.
- Do not silently fall back from real dependencies. Headroom's Rust shims fail
  loudly when the extension is unavailable; UTK should do the same for
  `guidance-ts`, TOON, and LLMLingua when a feature requires them.
- Do not mutate operational inputs by default. Paths, commands, globs, regexes,
  patches, diffs, ids, and file contents need protected-field policy.
- Do not confuse benchmark claims with product proof. Headroom reports strong
  savings/accuracy numbers, but UTK needs deterministic CI fixtures for its own
  Copilot tool-call contract.

## Source Files Reviewed

Upstream web pages:

- `README.md`
- `pyproject.toml`
- `Cargo.toml`

Temporary clone files:

- `README.md`
- `pyproject.toml`
- `Cargo.toml`
- `headroom/cli/main.py`
- `headroom/cli/wrap.py`
- `headroom/providers/copilot/wrap.py`
- `headroom/transforms/content_router.py`
- `headroom/transforms/smart_crusher.py`
- `headroom/transforms/cache_aligner.py`
- `headroom/integrations/mcp/server.py`
- `headroom/ccr/tool_injection.py`
- `headroom/learn/analyzer.py`
- `headroom/rtk/installer.py`
- `plugins/headroom-agent-hooks/README.md`
- `plugins/headroom-agent-hooks/hooks/hooks.json`
- `plugins/headroom-agent-hooks/.github/plugin/plugin.json`
- `sdk/typescript/src/compress.ts`
- `sdk/typescript/src/hooks.ts`
- `wiki/ccr.md`
- `wiki/learn.md`
