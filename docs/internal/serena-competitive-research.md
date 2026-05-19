# Serena Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Upstream repository: https://github.com/oraios/serena
Observed upstream revision: `0909ae05f778457086e0529162695cb4f285f79a`

## Install And Configuration Status

Serena was researched from the public repository, public documentation, and a
temporary shallow clone only. It was not installed or configured in this UTK
workspace.

Documented upstream installation paths:

```powershell
uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
serena setup codex
serena start-mcp-server --context=codex --project-from-cwd
serena start-mcp-server --context=copilot-cli --project-from-cwd
```

Documented configuration and state locations:

- `~/.serena/serena_config.yml`: user-level Serena config.
- `.serena/project.yml`: project-local config generated or loaded on project
  activation.
- `.serena/project.local.yml`: project-local uncommitted overrides.
- `.serena/memories/`: project memories used for onboarding and persistent
  project knowledge.
- `~/.serena/memories/global/`: cross-project global memories.
- `~/.codex/config.toml`: documented Codex MCP registration target.
- `~/.codex/hooks.json`: documented Codex lifecycle hook target.

Important caveats:

- Serena is MCP-first and CLI-delivered. Its public package exposes `serena`
  and `serena-hooks` commands. That is useful competitive research, but it
  conflicts with UTK's constraint that UTK stay hook-first and avoid a public
  CLI or core MCP server.
- Serena's token optimization is mostly context avoidance through semantic code
  tools. It is not a generalized tool-output serializer, RTK-style shell output
  compressor, TOON provider, or schema router.
- Serena can auto-install or launch language-server dependencies. Its docs call
  this out as a supply-chain-sensitive path with exact pins, hash checks for
  downloaded artifacts, host allowlists, and managed install directories.
- The source is MIT licensed. Concepts are safe to study, but UTK should
  implement its own hook and serialization architecture rather than importing
  Serena's agent surface.

## Core Positioning

Serena describes itself as a "Coding Agents Toolkit" and "the IDE for your
agent." Its value proposition is to give an LLM semantic retrieval and editing
tools backed by language servers and IDE integrations, so the model can work on
symbols instead of dumping whole files into context.

This differs from UTK's intended center:

- Serena optimizes code-agent context acquisition before or during a coding
  task.
- UTK mediates GitHub Copilot tool calls, captures shell and non-shell tool
  outputs, persists raw artifacts, infers schemas, routes results, and returns
  compact serialized responses.

The overlap worth studying is Serena's concrete answer to "how do we spend
fewer tokens while preserving agency?": stable symbolic handles, progressive
disclosure, project onboarding memories, narrow context/mode tool sets, hook
nudges, and measured evaluations that include negative deltas.

## Token Optimization Model

Serena does not mainly shrink text after it is produced. It changes what the
agent asks for:

1. A broad source-file read becomes `get_symbols_overview`.
2. A second broad read becomes `find_symbol` with `include_body=false` and
   `depth=1`.
3. Only the exact symbol body needed for reasoning or editing is fetched with
   `include_body=true`.
4. Cross-file exploration uses `find_referencing_symbols`,
   `find_implementations`, `find_declaration`, or type-hierarchy style tools.
5. Project knowledge that would otherwise be rediscovered is written to
   Markdown memories and exposed later as a name list, not injected wholesale.
6. Hooks nudge the agent when it drifts into repeated grep/read calls instead
   of symbolic operations.

This is an "avoid irrelevant context" strategy rather than "compress every
payload" strategy. UTK can borrow the avoidance layer, but should still keep
RTK-style shell parity, schema-backed payload mediation, raw artifact recovery,
and pluggable serializers as its core.

## Capability Inventory

| Capability | What it does | How Serena implements it | UTK relevance |
|---|---|---|---|
| MCP server delivery | Exposes Serena tools to many agents. | `SerenaMCPFactory` builds a FastMCP server and converts active Serena tools into MCP tools with JSON schemas, OpenAI-compatible schema cleanup, descriptions, and read/destructive annotations. | Competitive reference only. UTK should not become MCP-first, but can learn from schema hygiene and tool annotations. |
| Public CLI surface | Installs, configures, starts servers, generates projects, and manages memories. | `pyproject.toml` exposes `serena` and `serena-hooks`; docs use `serena setup codex`, `serena start-mcp-server`, and memory subcommands. | Avoid copying this surface. UTK internal hook runners are fine, but public CLI is out of scope. |
| LSP-backed symbol overview | Returns top-level file symbols without reading full source. | `get_symbols_overview(relative_path, depth, max_answer_chars)` groups LSP symbols by kind and can return counts or depth-0 summaries when too large. | Strong pattern for UTK's future code-output routes: compact structure first, exact artifact later. |
| Symbol search | Finds classes, methods, functions, and other code entities by name path. | `find_symbol` supports name-path patterns, suffix/absolute matching, `substring_matching`, `max_matches`, kind filters, body inclusion, and child depth. | UTK can model tool outputs as stable handles plus recoverable artifacts, similar to `name_path` + `relative_path`. |
| Reference search | Finds symbols that reference a target symbol. | `find_referencing_symbols` returns referencing symbol metadata plus short surrounding snippets, then falls back to reference summaries/counts if output is too long. | Useful result-routing pattern: include actionable facts first, then progressively shorter summaries. |
| Declaration and implementation lookup | Jumps from a use site to declaration/definition/implementation. | `find_declaration`, `find_implementations`, JetBrains equivalents, and LSP retrievers use file/line/column and regex anchoring. | Helps UTK think about "artifact pointers" that can be followed exactly without carrying raw content. |
| Symbol edits | Edits by symbol boundaries rather than line ranges. | `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol`, `rename_symbol`, and `safe_delete_symbol` rely on LSP or JetBrains refactoring. | UTK should not become an editor, but schema-generated command templates can use similarly constrained parameters. |
| File fallback tools | Provides normal file read/list/find/search/edit operations. | `read_file`, `list_dir`, `find_file`, `search_for_pattern`, `replace_content`, line edits, and text file creation are available unless excluded by context/mode. | Reinforces the layered model: semantic tools first, generic tools as fallback. UTK should route generic tool output too. |
| Progressive shortening | Avoids dumping oversized tool answers. | Several tools accept `max_answer_chars`; symbol/reference/search tools build shortened alternatives such as counts, per-file summaries, or result maps. | Directly relevant to UTK compact response generation and route fallback design. |
| Context files | Adjusts prompt and tool availability per client. | YAML contexts include `codex`, `copilot-cli`, `claude-code`, `vscode`, JetBrains contexts, `chatgpt`, and generic agent contexts. Contexts can exclude tools and override descriptions. | UTK should keep Copilot-specific behavior explicit in config and generated hooks rather than one generic prompt. |
| Modes | Adds task-state-specific prompts and tool inclusion rules. | YAML modes include `editing`, `interactive`, `one-shot`, `planning`, `onboarding`, `no-onboarding`, `no-memories`, and query modes. | Relevant to UTK session-skills/session-agents: expose only the skill/schema set relevant to the current phase. |
| Project activation | Makes a workspace the active project and initializes language/memory state. | `activate_project` loads or autogenerates `.serena/project.yml`, computes language composition, gathers ignore specs, and updates active tools/modes. | UTK's `utk-init` can borrow the pattern: project-local setup that discovers capabilities and writes explicit artifacts. |
| Project onboarding | Captures persistent project knowledge for later sessions. | The `onboarding` tool instructs the agent to inspect project structure, commands, conventions, and write Markdown memories. A `memory_maintenance` seed defines conventions. | Very relevant. UTK init should generate schema summaries, tool contracts, and session skills as project-local knowledge. |
| Memory system | Stores reusable project/global knowledge in human-readable Markdown. | `read_memory`, `write_memory`, `list_memories`, `delete_memory`, `rename_memory`, and `edit_memory`; references use backticked `mem:` links and renames can update references. | UTK `.utk/` artifacts should remain human-readable where possible, referenceable by stable names, and versionable. |
| Read-only and hidden memory policy | Protects or hides memory subsets. | Global/project config merge `read_only_memory_patterns` and `ignored_memory_patterns`; ignored memories disappear from tools. | Mirrors UTK protected fields/tools and artifact recovery policy. |
| Tool inclusion policy | Narrows exposed and active tools. | `ToolInclusionDefinition` supports `excluded_tools`, `included_optional_tools`, and `fixed_tools`; project read-only mode removes editing tools. | UTK TOML should keep explicit provider/tool/field policies with deterministic failure on invalid config. |
| Hooks for tool-use drift | Nudges agents back to symbolic tools. | `serena-hooks remind` tracks repeated grep/read-file calls by session and can deny with additional context; `activate` prompts project activation; `cleanup` removes session hook data. | Useful pattern for UTK Copilot hooks. UTK should mediate, not merely remind, and should include non-shell tool calls. |
| Codex integration | Documents Codex MCP and hook setup. | Docs add `[mcp_servers.serena]` to `~/.codex/config.toml`, enable `codex_hooks`, and create `~/.codex/hooks.json` with `PreToolUse`, `SessionStart`, and `Stop` hooks. | Confirms lifecycle-hook packaging patterns, but UTK should keep repo/plugin hook bundles and avoid global-only assumptions. |
| Copilot CLI integration | Documents Copilot CLI MCP registration. | `/mcp add` or `~/.copilot/mcp-config.json` with `serena start-mcp-server --context=copilot-cli --project-from-cwd`; hooks mirror VS Code recommendations. | Competitive reference for Copilot discovery; UTK's Copilot plugin should expose hooks/skills without needing an MCP core. |
| Client-specific tool bias mitigation | Counters built-in tool preference. | Serena ships a detailed Claude Code system-prompt override that declares symbolic tools primary and built-ins secondary for code. | UTK skills should explicitly teach when to use compact artifacts and when to recover raw outputs. |
| Dashboard and logs | Provides GUI visibility into server state, logs, memories, and tools. | Config exposes `web_dashboard`, `gui_log_window`, logging paths, and a Flask dashboard. | Nice product reference, but likely product drift for UTK until stats reporting needs a UI. |
| Language-server backend | Supports many languages through SolidLSP and pinned dependencies. | `solidlsp` language server modules and docs cover Python, TS/JS, Rust, Go, Java, C/C++, C#, Ruby, PHP, Swift, Kotlin, Scala, Bash, TOML, YAML, and many more. | Future optional code-structure provider. Do not make LSP availability mandatory for tool-output mediation. |
| JetBrains backend | Uses JetBrains IDE/plugin capabilities for richer refactors. | JetBrains tools include find symbol, references, overview, type hierarchy, move, inline, rename, safe delete, inspections, and debug helpers. | UTK should remain editor-agnostic, but can compare "semantic handle" quality against IDE-backed tools. |
| Security posture | Documents local-trust assumptions and dependency risks. | Security docs recommend sandboxing, limiting tools, keeping network services local, exact dependency pins, host allowlists, hash verification, and managed install paths. | UTK should carry the same explicit safety language for hooks, raw artifacts, and local detok transforms. |
| Evaluation framework | Measures additive value of Serena tools against built-ins. | Docs use agent-executed evaluations over task categories, record call counts/payload sizes/prerequisites, and classify positive, neutral/negative, and out-of-scope findings. | UTK should keep deterministic CI metrics for RTK parity, but Serena's additive-value framing is good for future semantic-context evals. |

## Implementation Mechanics

### MCP Tool Generation

Serena's MCP layer converts Python tool classes to FastMCP tools. The factory
pulls JSON schemas from function metadata, sanitizes schemas for OpenAI-style
tools when needed, parses docstrings into descriptions and parameter text, and
adds `readOnlyHint` / `destructiveHint` annotations from the tool's edit marker.

For UTK, the interesting part is not MCP itself. It is the disciplined
tool-definition pipeline: one tool class owns runtime behavior, schema
generation, description generation, and safety annotation. UTK's dynamically
generated schemas/templates should aim for the same single-source-of-truth
quality.

### Symbol Handles Instead Of Raw Files

Serena's system prompt repeatedly teaches agents to avoid full-file reads. The
core handle shape is a pair such as `name_path` and `relative_path`, sometimes
with `body_location`, `kind`, child summaries, and snippets. The agent can carry
these handles cheaply across turns, then request exact bodies only when the task
requires them.

UTK can use the same mental model for mediated outputs:

- return compact route metadata and stable artifact ids;
- carry only the facts needed for the next reasoning step;
- recover raw artifacts or exact slices only when needed;
- avoid making compact responses pretend to be the full payload.

### Progressive Answer Shortening

Several Serena tools build fallback summaries before calling `_limit_length`.
Examples include symbol kind counts, depth-0 overviews, `relative_path ->
name_path` maps, references without code context, per-file reference counts, and
"found N references" summaries.

This is close to UTK's desired deterministic route fallback. The difference is
that UTK should also persist the raw and serialized artifacts, validate fact
retention, and report compression metrics. Serena's summaries are useful, but
they are not a recoverability contract by themselves.

### Contexts, Modes, And Tool Surface Control

Serena separates "where am I running?" from "what phase am I in?":

- contexts represent clients such as Codex, Copilot CLI, VS Code, Claude Code,
  ChatGPT, JetBrains Copilot, and generic IDE/agent variants;
- modes represent behavior phases such as editing, planning, onboarding, and
  no-memory/no-onboarding variants.

Both can include or exclude tools, and prompts are rendered with the currently
available tool set. UTK should use the same principle for generated
session-skills and session-agents: the model should see the smallest relevant
schema/template/skill set, not the whole product.

### Project Memories And Onboarding

Serena's memory system is intentionally plain Markdown. On first activation,
onboarding creates project memories that capture structure, commands, style,
and other project-specific facts. Later sessions receive the memory name list
and decide what to read.

This is a strong pattern for UTK's `.utk/` project-local artifacts:

- `utk-init` should generate tool schemas and route summaries once;
- common work patterns should become session skills/agents instead of repeated
  prompt text;
- generated artifacts should be human-readable and versionable when possible;
- names and references should be stable enough for agents to carry cheaply.

### Hooks As Behavioral Pressure

Serena's hooks are not full tool-output mediators. They mostly apply behavioral
pressure:

- `SessionStart` prompts project activation and initial instructions.
- `PreToolUse` tracks repeated grep/read usage and can deny with a reminder.
- `PreToolUse` can auto-approve Serena tool calls under permissive client modes.
- `SessionEnd` removes hook session data.

For UTK, this confirms that hooks are a viable place to influence agent behavior
but also highlights the gap. UTK should mediate actual tool payloads and outputs
where the Copilot hook contract exposes them, including non-shell tools, rather
than stopping at reminders.

### Evaluation Method

Serena's evaluation docs explicitly measure additive value over built-in tools.
The method asks an agent to run task categories using both toolsets, record call
counts, payload sizes, and prerequisites, and report positive, neutral/negative,
and out-of-scope findings. Published results cover several agents and codebases,
with current docs noting the evaluated runs used the JetBrains backend.

UTK should keep its more deterministic RTK parity metrics for CI. Still,
Serena's "delta over built-ins" framing is useful for future UTK evaluations
that measure avoided file reads, fewer repeated searches, and better artifact
recovery behavior.

## Competitive Opportunities For UTK

1. Add a "semantic handle" concept to UTK compact outputs: route id, schema id,
   artifact id, optional line/range/path handles, and exact recovery command or
   skill guidance.
2. Extend `utk-init` so generated schemas/templates include not only tool output
   formats but also recommended "read less first" flows for repeated work.
3. Model UTK session-skills after Serena memories: terse Markdown, stable names,
   explicit references, and project-local versionability.
4. Add route fallback levels that resemble Serena's progressive shortening:
   full compact facts, handles without snippets, per-group counts, then minimal
   result envelope.
5. Compare UTK against Serena-style workflows in a separate eval track:
   avoided reads, total input/output tokens, raw artifact recoverability, and
   task-success facts retained.
6. Borrow the context/mode split for Copilot plugin packaging: Copilot CLI hooks,
   VS Code/GHCP config, detok usage, and agent-skill marketplace metadata should
   be explicitly scoped.
7. Preserve the UTK boundary: no public CLI, no core MCP server requirement, no
   accidental LSP dependency, and no editor-specific mandatory path.
8. Use Serena's negative-delta honesty. UTK docs/evals should state where raw
   output, exact diagnostics, or full files are better than compression.

## Risks And Non-Goals

- Do not turn UTK into a Serena clone. Serena is a semantic coding toolkit; UTK
  is a generalized Copilot tool-hook optimizer.
- Do not make LSP initialization a prerequisite for UTK mediation. LSP can be a
  future optional provider, not the core.
- Do not replace raw artifact persistence with memories. Memories are summaries;
  UTK still needs exact raw recovery.
- Do not let prompt-only tool-use guidance replace deterministic mediation,
  schema routing, TOON/compressed-JSON serialization, and metric gates.
- Do not adopt Serena's global CLI setup as the default UTK user experience.
- Do not let hook reminders become a bypass for non-shell tool mediation.

## Source Files Reviewed

- `README.md`
- `pyproject.toml`
- `src/serena/mcp.py`
- `src/serena/agent.py`
- `src/serena/project.py`
- `src/serena/hooks.py`
- `src/serena/config/serena_config.py`
- `src/serena/config/context_mode.py`
- `src/serena/tools/tools_base.py`
- `src/serena/tools/symbol_tools.py`
- `src/serena/tools/file_tools.py`
- `src/serena/tools/memory_tools.py`
- `src/serena/tools/config_tools.py`
- `src/serena/tools/cmd_tools.py`
- `src/serena/resources/config/prompt_templates/system_prompt.yml`
- `src/serena/resources/config/contexts/codex.yml`
- `src/serena/resources/config/contexts/copilot-cli.yml`
- `src/serena/resources/config/modes/editing.yml`
- `docs/02-usage/030_clients.md`
- `docs/02-usage/040_workflow.md`
- `docs/02-usage/045_memories.md`
- `docs/02-usage/050_configuration.md`
- `docs/02-usage/070_security.md`
- `docs/04-evaluation/000_evaluation-intro.md`
- `docs/04-evaluation/010_methodology.md`
- `docs/04-evaluation/030_results/000_evaluation-results.md`

## External Sources

- Serena repository: https://github.com/oraios/serena
- Client integration docs: https://oraios.github.io/serena/02-usage/030_clients.html
- Workflow docs: https://oraios.github.io/serena/02-usage/040_workflow.html
- Memory docs: https://oraios.github.io/serena/02-usage/045_memories.html
- Configuration docs: https://oraios.github.io/serena/02-usage/050_configuration.html
- Security docs: https://oraios.github.io/serena/02-usage/070_security.html
- Evaluation intro: https://oraios.github.io/serena/04-evaluation/000_evaluation-intro.html
- Evaluation methodology: https://oraios.github.io/serena/04-evaluation/010_methodology.html
