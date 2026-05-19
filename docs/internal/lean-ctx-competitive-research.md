# Lean-ctx Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Upstream repository: https://github.com/yvgude/lean-ctx
Observed upstream revision: `b4e6107aeaf9299c37d841c39bfcc84c0cfefa7e`

## Install And Configuration Status

lean-ctx was researched from the public repository and a temporary clone only.
It was not installed or configured in this workspace.

Documented upstream install paths:

```powershell
curl -fsSL https://leanctx.com/install.sh | sh
brew tap yvgude/lean-ctx && brew install lean-ctx
npm install -g lean-ctx-bin
cargo install lean-ctx
pi install npm:pi-lean-ctx
```

Documented setup and verification flow:

```powershell
lean-ctx setup
lean-ctx doctor
lean-ctx gain --live
```

Documented Copilot setup:

```powershell
lean-ctx init --agent copilot
```

Important caveats:

- lean-ctx is intentionally CLI, MCP, shell-hook, dashboard, package, and SDK
  centered. That is useful competitive research, but conflicts with UTK's
  constraint that UTK should remain hook-first and should not expose a public
  CLI.
- The repository includes editor integrations, a VS Code extension package,
  browser extension pieces, shell startup modification, MCP configuration
  writers, and a public npm binary package.
- The license is Apache-2.0, with portions under MIT. Concepts are safe to
  study, but UTK should still implement its own architecture and not inherit
  lean-ctx's broader runtime surface by accident.

## Core Positioning

lean-ctx describes itself as a "Context Layer" or "Context Runtime" for AI
development. Its value proposition is broad: compress shell output, read code in
compact modes, expose MCP tools, track context usage, persist session memory,
build graph context, enforce budgets/governance, produce dashboards, package
context, and support many AI coding clients.

This differs from UTK's intended center:

- lean-ctx replaces or wraps the agent's context stack through a public Rust
  binary, shell hooks, MCP tools, and editor integrations.
- UTK mediates GitHub Copilot tool calls, persists raw artifacts, infers schemas,
  routes outputs, and returns compact serialized responses through hooks and
  skills.

The overlap worth studying is lean-ctx's shell-output pattern catalog, safe
command rewrite registry, Copilot `preToolUse` hook wiring, token accounting,
archive/retrieve model, compression-level configuration, and honest
recoverability/savings reporting.

See `docs/internal/lean-ctx-protocol-architecture-deep-dive.md` for the deeper
protocol and Context OS analysis covering CEP, CCP, TDD/CRP, CLP, A2A, Context
IR, ledgers, proofs, governance, and UTK architecture implications.

## Capability Inventory

| Capability | What it does | How lean-ctx implements it | UTK relevance |
|---|---|---|---|
| Single Rust binary | Provides the primary delivery artifact. | `rust/Cargo.toml` builds `lean-ctx` as both library and binary with many optional features. | UTK should avoid copying the public CLI shape, but can learn from a small internal hook runner with shared core logic. |
| Public CLI surface | Exposes many direct commands. | `rust/src/cli/dispatch.rs` routes `-c`, `gain`, `dashboard`, `pack`, `proof`, `verify`, `instructions`, `index`, `serve`, and many more. | Competitive reference only. UTK should keep user-facing workflows in hooks/skills, not a public CLI. |
| Shell command compression | Compresses verbose command output. | `lean-ctx -c <command>` executes through `shell::exec`, then `shell::compress::engine` applies pattern modules, terse compression, cleanup, and safety checks. | Directly relevant to RTK parity and UTK's shell tool-call mediation. |
| Command rewrite registry | Defines commands eligible for hook rewriting. | `rewrite_registry.rs` lists VCS, build, package, lint, infra, HTTP, search, file-read, and directory commands. | UTK's bash-like llguidance tool should have a similar single source of truth for structured command templates. |
| Copilot hook wiring | Registers Copilot MCP and hooks. | `hooks/agents/copilot.rs` writes `.vscode/mcp.json`, `.github/mcp.json`, and `.github/hooks/hooks.json` with `preToolUse` rewrite/redirect and `postToolUse` observe commands. | UTK already targets Copilot hooks; lean-ctx is a useful pattern for repo-local hook files and fail-open behavior. |
| Pre-tool rewrite | Rewrites shell commands before execution. | `hook_handlers.rs` parses hook payloads, rewrites command fields to `lean-ctx -c`, `lean-ctx read`, or `lean-ctx grep`, and emits hook update JSON. | UTK's hook should be more generalized: mediate shell and non-shell tool calls, not just wrap known shell commands. |
| Read redirection | Redirects file reads through compressed cache output. | PreToolUse redirect can run `lean-ctx read` or `lean-ctx grep`, write output to a temp file, and update the tool input path. | Useful pattern, but UTK should prefer artifact-backed mediation instead of mutating file paths to temp outputs unless the hook requires it. |
| Post-tool observation | Records hook events for context awareness. | `handle_observe` normalizes shell, MCP call, file read, tool input, prompt, response, thinking, session, and compaction events into radar JSONL records. | UTK should capture non-shell tool calls too; this validates the user's requirement that non-shell events are not pass-through by default. |
| Pattern modules | Compresses many command families. | `rust/src/core/patterns` includes modules for git, gh, cargo, npm, pnpm, docker, kubectl, terraform, rg/grep, tsc, vitest/test output, curl, JSON schema, logs, and many more. | UTK can compare fixture coverage against this list when expanding RTK parity metrics. |
| Safety gates for errors | Preserves diagnostic output. | Build/check/lint error outputs are detected and returned verbatim or safely truncated to preserve paths, lines, and messages. | Strong UTK rule: optimization must not destroy actionable compiler/test diagnostics. |
| Output policy | Protects commands from compression. | `output_policy` and `excluded_commands` can mark outputs verbatim or passthrough. | UTK's TOML should support per-tool and per-field protection with explicit policy names. |
| Compression levels | Controls output density. | Config exposes `compression_level = off|lite|standard|max`, mapping to terse/output-density/CRP modes with env overrides. | UTK can mirror simple levels for serializers/detok while keeping default behavior deterministic. |
| File read modes | Reads code at different densities. | Feature catalog lists `auto`, `full`, `map`, `signatures`, `diff`, `aggressive`, `entropy`, `task`, `reference`, and `lines:N-M`. | UTK's schema summaries and artifact recovery can adopt "summary vs exact range" semantics. |
| Tree-sitter AST support | Extracts structural code summaries. | Rust feature gates include tree-sitter grammars for Rust, TS/JS, Python, Go, Java, C/C++, Ruby, C#, Kotlin, Swift, PHP, Bash, Dart, Scala, Elixir, and Zig. | Useful for future UTK code-output schemas, but not required for hook-first tool mediation. |
| MCP tools | Provides a large tool catalog. | Registry builds dozens of `ctx_*` tools including read, shell, search, graph, session, knowledge, proof, gain, heatmap, handoff, and refactor. | UTK explicitly does not need an MCP server as a core product; only learn from schema and tool-definition organization. |
| Dynamic tool categories | Reduces exposed MCP surface. | Feature catalog describes on-demand categories loaded by `ctx_load_tools` with tool-list-change notifications. | UTK can use the idea for generated skills/agents: expose only relevant schemas/templates for the current session. |
| Context archive | Stores large outputs for later retrieval. | `core/archive.rs` hashes content, writes text and metadata under the lean-ctx data directory, indexes FTS, and provides retrieve/range/search helpers. | Very relevant. UTK's `.utk/` raw and serialized artifacts should offer similar retrieve/range/search affordances. |
| Session state | Persists task, findings, decisions, stats, and compaction snapshots. | `core/session/persistence.rs` writes JSON sessions plus `latest.json` and snapshot text, preferring project-root matches. | UTK session-agents and session-skills should keep project-local state and avoid cross-project leakage. |
| Knowledge system | Stores facts and recall across sessions. | CLI and MCP expose `knowledge remember`, `recall`, `search`, import/export, status, and health. | UTK may use learned route/schema facts, but should scope them carefully to `.utk/` and explicit skills. |
| Graph intelligence | Builds project graph context. | Architecture describes property graph, imports/calls/exports/type refs, hybrid search, and graph-aware reads. | Future competitive capability. UTK should prioritize tool-call compression first, then graph hints if they reduce repeated reads. |
| Context proof and verification | Provides governance artifacts. | Tools and CLI include `ctx_proof`, `ctx_verify`, quality gates, evidence ledger, and replay hashes. | UTK's eval-backed artifact recoverability is the right adjacent investment. |
| Dashboard and TUI | Displays savings/context status. | `lean-ctx dashboard`, `watch`, `gain --live`, and heatmap routes surface context and savings. | UTK docs should display stats, but a dashboard is probably product drift unless demanded. |
| Context packages | Exports/imports portable context bundles. | `lean-ctx pack` builds `.lctxpkg` files with knowledge, graph, session, gotchas, provenance, and integrity. | Possible future `.utk` artifact bundle idea for PRs or session handoff. |
| Skills marketplace | Ships a `skills/lean-ctx` agent skill. | The skill auto-installs lean-ctx and instructs agents to use CLI/MCP commands. | UTK should keep its skills spec-compliant and narrower, avoiding auto-install surprises. |
| Benchmarks | Reports token savings by language, mode, and session simulation. | `BENCHMARKS.md` is generated by `lean-ctx benchmark report .` and includes raw/compressed tokens, savings, latency, and quality. | UTK's RTK parity metrics should keep comparable scenario names, raw/compact tokens, retention, recovery, and fail thresholds. |

## Implementation Mechanics

### Delivery Surface

lean-ctx is a single Rust binary with multiple personalities: CLI command,
interactive shell wrapper, MCP stdio server, HTTP MCP server, dashboard server,
setup utility, hook handler, and benchmark runner. The npm package
`lean-ctx-bin` exists only to install and expose the prebuilt binary as
`lean-ctx`.

UTK should avoid this delivery model. The useful part is a shared core beneath
thin entrypoints. For UTK, those entrypoints should be Copilot hook runners,
skills, and internal package APIs rather than a public command.

### Shell Hook And Command Rewrite

The rewrite registry is a single source of truth for command families that can
benefit from compression. Hook handlers use that registry to decide whether a
tool command can be rewritten to `lean-ctx -c '<command>'`. Special cases rewrite
simple file reads to `lean-ctx read`, simple `rg` calls to `lean-ctx grep`, and
simple `ls` calls to lean-ctx directory handling. Compound commands are parsed
and rewritten segment-by-segment when safe.

Safety is handled by skipping already-rewritten commands, heredocs that cannot
survive quoting, command forms that should remain raw, and build/lint error
output that must preserve diagnostics. This is directly relevant to UTK's
bash-like llguidance work: command structure should be known, template-backed,
and conservative about execution semantics.

### Shell Output Compression

The compression engine first checks for empty output, build-tool diagnostics,
auth/device-flow output, token thresholds, configured output policy, and
verbatim classifications. It then routes structural output to command-specific
patterns, falls back to generic pattern modules, then terse compression, then
lightweight cleanup, then safe truncation.

The important competitive lesson is layered fallback:

- command-specific schema/pattern when known;
- deterministic generic compression when structure is detectable;
- terse text compression only after safety checks;
- raw or truncated output when compression would be unsafe.

### Copilot Integration

The Copilot installer writes both MCP config and hook config:

- `.vscode/mcp.json` for VS Code MCP server registration;
- `.github/mcp.json` for Copilot CLI MCP server registration;
- `.github/hooks/hooks.json` for `preToolUse` and `postToolUse`.

The hook config runs `lean-ctx hook rewrite`, `lean-ctx hook redirect`, and
`lean-ctx hook observe`. This confirms that Copilot hook wiring can combine
argument rewriting with observation, but lean-ctx's implementation is still
mostly shell/read/search focused. UTK should keep the broader requirement:
non-shell tool calls are observable mediation targets whenever the payload is
available.

### MCP Tool Registry

lean-ctx's MCP server registers a large catalog of trait-based tools. The
feature catalog records 51 granular MCP tools, five unified tools, five
resources, five prompts, and dynamic tool categories. The public README claims a
newer count of 59 MCP tools.

This is not a UTK target surface. The useful pattern is tool definition hygiene:
central registration, schema-backed handlers, category gating, canonical tool
names, and tests that keep docs/tool counts synchronized.

### Artifacts, Archive, And Recovery

Large outputs can be archived by content hash with metadata, session ID,
created-at timestamp, character count, and token count. Archive retrieval
supports full content, line ranges, and text search. Sessions are persisted as
JSON with latest-session pointers and compaction snapshots. The data directory
defaults to XDG config paths or legacy `~/.lean-ctx`, with an override env var.

UTK should keep the recovery model but change the locality: `.utk/` should hold
raw tool input/output, compact serialized artifacts, schema history, route
summaries, and recovery indexes.

### Metrics And Benchmarks

lean-ctx includes live savings, wrapped reports, benchmark reports, heatmaps,
context dashboards, and stats stores. Its generated benchmark report includes
raw tokens, compressed tokens, savings percentage, latency, quality, and session
simulation costs.

UTK's comparative RTK metrics should preserve this rigor but use UTK-specific
success criteria: fact retention, recoverability, no raw leakage, route
confidence, and compact token count versus RTK baselines.

## Competitive Opportunities For UTK

1. Build a command-template registry for UTK's bash-like tool that separates
   command intent, safe parameters, expected output schema, serializer, and
   llguidance grammar.
2. Expand RTK parity fixtures with lean-ctx-like command families: git, gh,
   npm/pnpm, cargo, docker, kubectl, terraform, rg, tsc, vitest, curl, and JSON
   schema output.
3. Add artifact range/search recovery for `.utk/` raw outputs, not only direct
   file paths.
4. Keep non-shell tool calls first-class by applying the same capture,
   serialization, schema inference, and artifact recovery path to object/JSON
   tool outputs.
5. Add honest savings footers or metadata that distinguish raw tokens,
   compact-response tokens, serializer tokens, and recovery artifact IDs.
6. Use a single policy model for protected commands, protected fields, raw-only
   tools, auth/device flows, patches, diffs, paths, globs, regexes, and exact
   errors.
7. Add dynamic skill/agent schema loading inspired by lean-ctx dynamic tool
   categories, but implement it as Copilot skills/agents rather than MCP tool
   churn.
8. Use benchmark reports that include quality/retention gates, not just
   compression percentage.
9. Consider a project-local context package format for `.utk/` artifacts after
   the hook pipeline is stable.
10. Keep installation side effects explicit and narrow; avoid modifying shell
    startup files, editor extensions, or global MCP configs unless the user asks
    for that integration.

## Risks To Avoid

- Do not let UTK become a public CLI or broad MCP platform to match lean-ctx's
  scope.
- Do not add a VS Code extension simply because lean-ctx ships one.
- Do not compress compiler/test diagnostics if exact file paths, line numbers,
  or error text might be lost.
- Do not rewrite commands that contain heredocs, patches, destructive writes,
  auth flows, or complex quoting unless the parser can prove the rewrite is
  safe.
- Do not store project recovery state only in a global home directory.
- Do not measure success using token savings alone; require fact retention and
  artifact recoverability.
- Do not expose dozens of tools by default. UTK's token-saving value depends on
  reducing schema/tool surface, not expanding it.

## Source Files Reviewed

Public source:

- https://github.com/yvgude/lean-ctx

Temporary clone at revision `b4e6107aeaf9299c37d841c39bfcc84c0cfefa7e`:

- `README.md`
- `ARCHITECTURE.md`
- `BENCHMARKS.md`
- `LEANCTX_FEATURE_CATALOG.md`
- `skills/lean-ctx/SKILL.md`
- `packages/lean-ctx-bin/package.json`
- `rust/Cargo.toml`
- `rust/src/main.rs`
- `rust/src/cli/dispatch.rs`
- `rust/src/hooks/agents/copilot.rs`
- `rust/src/hook_handlers.rs`
- `rust/src/rewrite_registry.rs`
- `rust/src/shell_hook.rs`
- `rust/src/shell/compress/engine.rs`
- `rust/src/core/patterns/mod.rs`
- `rust/src/core/config/mod.rs`
- `rust/src/core/data_dir.rs`
- `rust/src/core/tokens.rs`
- `rust/src/core/archive.rs`
- `rust/src/core/session/persistence.rs`
- `rust/src/server/registry.rs`
- `rust/src/tools/ctx_read.rs`
- `rust/src/tools/ctx_shell.rs`
