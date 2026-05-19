# Cavemem Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Upstream repository: https://github.com/JuliusBrussee/cavemem
Observed upstream revision: `1fe41e9c9f28380d3da9640f02812f8e5565839a`

## Install And Configuration Status

Cavemem was researched from the public repository, README MCP section, docs, and
a temporary shallow clone only. It was not installed or configured in this UTK
workspace.

Documented upstream install paths:

```bash
npm install -g cavemem
cavemem install
cavemem install --ide cursor
cavemem install --ide codex
cavemem status
cavemem viewer
```

Documented configuration and state locations:

- `~/.cavemem/settings.json`: global settings.
- `~/.cavemem/data.db`: local SQLite store by default.
- `~/.cavemem/models`: local embedding model cache by default.
- `~/.cavemem/worker.state.json`: worker/backfill status.
- `~/.cavemem/worker.pid`: local worker pid file.
- `~/.codex/config.toml`: Codex MCP and feature flag registration target.
- `~/.codex/hooks.json`: Codex lifecycle hook registration target.

Important caveats:

- Cavemem is intentionally a public CLI, global installer, MCP server, local
  worker, web viewer, SQLite database, and cross-agent memory product. That is
  useful competitive research, but conflicts with UTK's boundary that UTK should
  stay hook-first, project-local, and not expose a public CLI or core MCP server.
- Cavemem stores compressed memories. UTK stores raw and compact tool artifacts.
  These are adjacent but not interchangeable: memories summarize session
  history, while UTK artifacts must remain exact recovery material.
- The README says agents query through "three MCP tools," but the current MCP
  table and source expose four tools: `search`, `timeline`,
  `get_observations`, and `list_sessions`.
- The repository is MIT licensed.

## Core Positioning

Cavemem describes itself as "Cross-agent persistent memory for coding
assistants. Stored compressed. Retrieved fast. Local by default." Hooks capture
session events, redact private spans, compress prose through deterministic
Caveman grammar, write observations to SQLite/FTS5, and expose prior context
through progressive MCP retrieval.

This differs from UTK's intended center:

- Cavemem remembers agent sessions across tools and IDEs.
- UTK mediates GitHub Copilot tool calls, persists full-fidelity raw outputs,
  infers schemas, routes outputs, and returns compact recoverable responses.

The overlap worth studying is substantial: protected-token compression, hook
capture, local-first persistence, progressive disclosure, hybrid search, privacy
at write boundary, and explicit performance budgets for hook handlers.

## Capability Inventory

| Capability | What it does | How Cavemem implements it | UTK relevance |
|---|---|---|---|
| Public CLI | Installs integrations, manages config, starts worker/MCP, searches memory, exports JSONL, compresses files. | `apps/cli` publishes `cavemem` with commands for install/uninstall/status/config/start/stop/viewer/doctor/search/compress/reindex/export/mcp. | Competitive reference only. UTK should keep internal hook runners and skills, not a public CLI. |
| Cross-IDE installers | Wires hooks and MCP into multiple clients. | `packages/installers` supports Claude Code, Cursor, Gemini CLI, OpenCode, and Codex. | Useful packaging reference, but UTK should keep install scope explicit and repo/plugin-local where possible. |
| Codex integration | Registers both hooks and MCP for Codex. | Writes `features.codex_hooks = true` plus `[mcp_servers.cavemem]` in `~/.codex/config.toml`, and lifecycle hooks in `~/.codex/hooks.json`. | Strong reference for Codex hook shapes and fail-open installer behavior. UTK should avoid global default writes unless user explicitly asks. |
| Lifecycle hook capture | Captures prompts, tool calls, turn summaries, and sessions. | `packages/hooks` handles `session-start`, `user-prompt-submit`, `post-tool-use`, `stop`, and `session-end`. | Directly relevant. UTK's Copilot hook should capture observable shell and non-shell tool calls, but for artifact mediation rather than general memory. |
| Fast hook path | Keeps hooks lightweight. | Playbook says hooks must complete under 150 ms p95; embedding and indexing are handed to worker. | UTK hooks should preserve this split: synchronous raw persistence, async enrichment when expensive. |
| Privacy boundary | Redacts private spans before write. | `redactPrivate` strips `<private>...</private>` and drops unclosed private tags to end-of-input before compression/storage. | UTK should keep redaction before serialized/summary artifacts while preserving raw-artifact policy choices explicitly. |
| Deterministic compression | Compresses prose without model calls. | `@cavemem/compress` tokenizes preserved segments and transforms only prose by removing pleasantries, hedges, fillers, articles, and applying abbreviations. | Very relevant to UTK's `compressed-json`/detok safety: deterministic protected-span handling beats prompt-only compression for technical content. |
| Protected token tokenizer | Keeps technical spans byte-exact. | Token kinds include fenced code, inline code, URLs, paths, commands, versions, dates, numbers, identifiers, headings, prose, and newlines. | UTK should borrow the protected-token taxonomy for serializer and LLMLingua guardrails. |
| Intensity levels | Controls compression aggressiveness. | Settings support `lite`, `full`, and `ultra`; schema describes approximate savings targets. | UTK provider config can mirror this for prose summaries, but structured facts need schema validation first. |
| Expansion | Makes compressed memories human-readable. | `expand` maps known abbreviations back through the lexicon; dropped filler is intentionally not restored. | Useful for compact artifact viewing, but UTK raw recovery must remain exact rather than expanded approximation. |
| SQLite storage | Persists sessions, observations, summaries, and embeddings locally. | `@cavemem/storage` uses `better-sqlite3`, WAL mode, FK constraints, FTS5, sessions, observations, summaries, and embeddings tables. | Strong reference for `.utk/` metadata indexes if flat files become hard to query. |
| FTS5 search | Provides keyword memory search. | `observations_fts` is maintained by SQLite triggers; BM25 scores are flipped so higher is better downstream. | UTK could index artifacts and schema summaries for recovery, but not at the cost of exact file artifacts. |
| Vector search | Adds semantic re-ranking. | Worker embeds expanded observations using local Transformers.js by default, or optional Ollama/OpenAI providers. | Optional future artifact search provider. Default UTK should not add remote calls or model downloads. |
| Hybrid ranking | Blends BM25 and cosine. | `hybridRank` normalizes BM25/cosine to [0,1] and blends by `search.alpha`. | Useful for recovery UX and session-skill discovery, but exact schema routes remain deterministic. |
| Progressive MCP retrieval | Lets agents filter before fetching bodies. | `search` returns compact hits; `timeline` returns IDs/kinds/timestamps; `get_observations` fetches full bodies; `list_sessions` navigates sessions. | Very relevant. UTK compact responses should return handles first and exact artifacts only on request. |
| MCP stdio server | Exposes memory retrieval to agents. | `apps/mcp-server` builds an MCP server with zod input schemas and lazy embedder loading. | UTK explicitly does not need a core MCP server, but can learn from progressive contracts. |
| Local worker | Backfills embeddings and serves viewer. | `apps/worker` binds Hono server to `127.0.0.1`, writes pid/state files, self-exits after idle timeout, and embeds in batches. | Pattern for optional asynchronous artifact enrichment. Not required for UTK core mediation. |
| Read-only web viewer | Lets humans browse sessions. | Worker renders sessions/observations as expanded text at loopback port 37777. | Possible future UTK artifact viewer, but docs/skills may be enough for now. |
| Prior-session context | Injects small startup context. | `sessionStart` can return up to three recent session summaries scoped by cwd, as `Prior-session context`. | UTK session-skills/session-agents can use similar scoped startup hints, but avoid stale raw tool outputs in prompts. |
| Tool-use observation truncation | Stores compact tool-use observations. | `postToolUse` writes `tool input=... output=...`, truncating stringified input/output to 500 chars and body to 4000 chars. | Key contrast: Cavemem memory truncates; UTK must persist full raw outputs before compacting. |
| Export | Dumps memory to JSONL. | CLI has `cavemem export <out.jsonl>`. | UTK should support artifact manifest/report export, not necessarily global memory export. |
| Evals | Measures token savings and round-trip properties. | `evals/src/bench.ts` compares token counts before/after compression over markdown corpus fixtures. | UTK should keep broader RTK parity metrics: token savings plus fact retention and recoverability. |

## Implementation Mechanics

### Write Path

Cavemem's write path is deliberately narrow:

1. an IDE hook event reaches the CLI hook runner;
2. the runner opens settings and SQLite through `MemoryStore`;
3. `<private>...</private>` spans are stripped;
4. prose is compressed with the configured intensity;
5. the observation or summary is written to SQLite;
6. FTS5 updates synchronously through SQLite triggers;
7. the worker is fire-and-forget auto-spawned for embedding backfill.

The important discipline is that `MemoryStore` is the only write facade. The
playbook treats raw prose writes to SQLite as a defect.

For UTK, the analogous rule should be: every mediated tool output goes through
the artifact store first, before summaries, serializers, route records, detok
rewrites, or indexes are allowed to exist.

### Read Path And MCP

Cavemem's MCP surface is intentionally progressive:

- `search(query, limit?)` returns compact `{id, score, snippet, session_id, ts}`
  rows.
- `timeline(session_id, around_id?, limit?)` returns only `{id, kind, ts}`.
- `get_observations(ids[], expand?)` returns full observation bodies and
  metadata.
- `list_sessions(limit?)` returns session navigation metadata.

This mirrors the right UX for UTK artifact recovery: agents should usually see
compact route/artifact handles first, then ask for exact raw slices only when
needed. UTK should not copy the MCP requirement, but it should copy the
progressive contract.

### Compression Engine

The compressor is deterministic and offline. It first tokenizes protected
technical spans, then transforms only prose spans. Protected kinds include code
fences, inline code, URLs, paths, shell commands, versions, dates, numbers,
identifiers, and headings.

Compression levels change how aggressively articles, fillers, hedges, and
abbreviations are applied. Expansion can make compressed memories easier for
humans to read, but it cannot restore dropped words. That is acceptable for
memory, but it would be unacceptable for UTK raw artifacts.

### Storage And Search

The SQLite schema has:

- `sessions`: IDE, cwd, start/end, metadata;
- `observations`: compressed content, kind, timestamp, metadata;
- `summaries`: turn/session summaries;
- `observations_fts`: FTS5 index maintained by triggers;
- `embeddings`: one vector per observation for a model/dimension.

Search first gets keyword hits, then optionally blends vector results. If the
embedder is unavailable or disabled, BM25 still works. This graceful degradation
is a useful pattern for UTK optional enrichment providers.

### Hook Semantics

The hook handlers capture different information:

- `session-start`: creates a session and may return recent cwd-scoped summaries;
- `user-prompt-submit`: stores the prompt and returns no retrieval augmentation;
- `post-tool-use`: stores a short tool input/output observation;
- `stop`: stores a turn summary from the last assistant output;
- `session-end`: rolls turn summaries into a session summary and marks the
  session ended.

This confirms a useful separation: hooks capture facts, MCP retrieves memory,
and worker enriches indexes. UTK should similarly separate capture, compact
response, artifact recovery, and optional search/enrichment.

### Installer Behavior

Cavemem writes user-level configuration for supported IDEs. The Codex installer
enables `codex_hooks`, registers the `cavemem` MCP server, and appends hook
commands for SessionStart, UserPromptSubmit, PostToolUse, and Stop while
preserving non-Cavemem hooks.

This is a good implementation reference but a product-boundary warning for
UTK. UTK should prefer repo-local/plugin-local hook files and clear user review,
because global memory installation is broader than UTK's project-local
optimization scope.

## Competitive Implications For UTK

Cavemem is a stronger competitive reference than CaveGemma because it shares
hooks, local persistence, protected technical spans, and progressive retrieval.
However, it optimizes memory, not tool-call payload delivery.

Where Cavemem is strong:

- cross-agent session continuity;
- local-first compressed storage;
- a small progressive MCP retrieval API;
- fast hooks with background indexing;
- deterministic prose compression with protected spans;
- explicit privacy controls at write boundary.

Where UTK can stay stronger:

- exact raw tool-output artifacts;
- schema-aware compact responses;
- shell and non-shell tool mediation in the active Copilot turn;
- TOON/compressed-JSON providers;
- RTK parity metrics with fact retention and recoverability;
- project-local `.utk/` artifacts instead of global memory by default.

## Competitive Opportunities For UTK

1. Add a progressive artifact recovery API shape even if exposed as skills/docs
   rather than MCP: list observations, search summaries, fetch raw slice, fetch
   compact artifact, fetch schema/route history.
2. Reuse Cavemem's protected-token taxonomy for UTK detok and serializer
   validation: fences, inline code, URLs, paths, commands, versions, dates,
   numbers, identifiers, headings, and exact errors.
3. Add optional `.utk` artifact indexes after raw files are stable. SQLite/FTS5
   could help large projects, but raw files and manifests must remain canonical.
4. Separate synchronous hook work from async enrichment. Hook path should persist
   raw output and return compact response; embeddings/search/backfill should be
   optional and out-of-band.
5. Add cwd/project scoping to any generated memory/session-skill hints so facts
   from one repo do not bleed into another.
6. Adopt privacy-at-boundary checks for configured protected fields and
   `<private>`-style spans before compact artifacts or summaries are written.
7. Benchmark memory-style recall separately from RTK parity. Cavemem's success
   metric is retrieval continuity; UTK's is token savings plus exact tool-output
   recoverability.
8. Document truncation choices explicitly. Cavemem can truncate tool observations
   because it is memory; UTK cannot truncate raw artifacts.

## Risks And Non-Goals

- Do not turn UTK into a global persistent memory product.
- Do not make UTK's core depend on MCP retrieval.
- Do not store only compressed memory when exact raw tool output is required.
- Do not install global hooks/config by default when the user asked for a
  project-local Copilot hook.
- Do not let vector search become a substitute for deterministic schema routing.
- Do not let prose expansion be presented as raw recovery.
- Do not add remote embedding providers as a default path.

## Source Files Reviewed

- `README.md`
- `CLAUDE.md`
- `docs/architecture.md`
- `docs/mcp.md`
- `docs/compression.md`
- `examples/settings.example.json`
- `apps/cli/package.json`
- `apps/cli/src/commands/hook.ts`
- `apps/cli/src/commands/mcp.ts`
- `apps/cli/src/commands/status.ts`
- `apps/mcp-server/src/server.ts`
- `apps/worker/src/server.ts`
- `apps/worker/src/embed-loop.ts`
- `apps/worker/src/viewer.ts`
- `packages/compress/src/compress.ts`
- `packages/compress/src/tokenize.ts`
- `packages/compress/src/expand.ts`
- `packages/compress/src/privacy.ts`
- `packages/compress/src/lexicon.json`
- `packages/config/src/schema.ts`
- `packages/config/src/defaults.ts`
- `packages/core/src/memory-store.ts`
- `packages/core/src/ranker.ts`
- `packages/storage/src/schema.ts`
- `packages/storage/src/storage.ts`
- `packages/hooks/src/runner.ts`
- `packages/hooks/src/handlers/session-start.ts`
- `packages/hooks/src/handlers/user-prompt-submit.ts`
- `packages/hooks/src/handlers/post-tool-use.ts`
- `packages/hooks/src/handlers/stop.ts`
- `packages/hooks/src/handlers/session-end.ts`
- `packages/installers/src/registry.ts`
- `packages/installers/src/codex.ts`
- `packages/installers/src/claude-code.ts`
- `packages/installers/src/cursor.ts`
- `packages/embedding/src/index.ts`
- `evals/src/bench.ts`

## External Sources

- Cavemem repository and README MCP section: https://github.com/JuliusBrussee/cavemem#mcp
- Caveman repository: https://github.com/JuliusBrussee/caveman
- Cavekit repository: https://github.com/JuliusBrussee/cavekit
- CaveGemma repository: https://github.com/JuliusBrussee/cavegemma
- npm package page: https://www.npmjs.com/package/cavemem
