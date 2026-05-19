# Caveman Competitive Research

Internal note. Do not link this document from the public README unless the
competitive strategy becomes intentionally public.

Research date: 2026-05-19
Upstream repository: https://github.com/JuliusBrussee/caveman
Observed upstream revision: `18e45320a0b1aecc959a807f8568ee44b3aaa055`

## Install And Configuration Status

Caveman was installed/configured in this workspace for GitHub Copilot with the
upstream documented command:

```powershell
npx -y github:JuliusBrussee/caveman -- --only copilot --with-init
```

The dry run first reported that this command would run:

```powershell
npx -y skills add JuliusBrussee/caveman -a github-copilot --yes --all
```

The real install completed successfully. It installed the Caveman skill bundle
and ran `caveman-init` in `C:\src\utk`.

Files and directories created by the install:

- `.github/copilot-instructions.md`: GitHub Copilot repo instruction file.
- `.agents/skills/cavecrew`
- `.agents/skills/caveman`
- `.agents/skills/caveman-commit`
- `.agents/skills/caveman-compress`
- `.agents/skills/caveman-help`
- `.agents/skills/caveman-review`
- `.agents/skills/caveman-stats`
- `skills-lock.json`
- `.cursor/rules/caveman.mdc`
- `.windsurf/rules/caveman.md`
- `.clinerules/caveman.md`
- `.opencode/AGENTS.md`
- `AGENTS.md`

Important caveat: the upstream Copilot command is not Copilot-only once
`--with-init` runs. It explicitly installs the GitHub Copilot skill profile, but
the repo-local init script writes always-on rule files for several IDE agents.
That side effect is useful to track because UTK should avoid surprising
cross-agent configuration when the user chooses a specific integration target.

## Core Positioning

Caveman is primarily prompt-layer output compression. It makes the agent answer
in terse fragments while preserving technical substance. Its value proposition
is lower output-token cost and denser conversational turns, not structured
tool-output mediation.

This differs from UTK's desired center:

- Caveman compresses what the assistant says.
- UTK compresses and mediates tool input/output, persists raw artifacts, infers
  schemas, routes outputs, and returns compact recoverable responses.

The overlap worth studying is Caveman's product packaging: skills, commands,
agent-specific installation, persistent activation rules, stats, and a small MCP
proxy for metadata compression.

## Capability Inventory

| Capability | What it does | How Caveman implements it | UTK relevance |
|---|---|---|---|
| Core caveman mode | Makes responses terse while preserving technical details. | Skill prompt and activation rule tell the model to drop articles, filler, pleasantries, and hedging; keep code, errors, and technical terms exact; use fragments. | UTK could add a persona-free "terse response" layer for summaries, but should not replace schema-backed tool mediation with style prompts. |
| Intensity levels | Lets users choose `lite`, `full`, `ultra`, and `wenyan-*` variants. | Skill prompt enumerates modes; hooks and commands store the current mode in a flag file for Claude Code. | UTK serializer/config choices can mirror this UX: explicit levels, sticky defaults, and safe overrides. |
| Article and filler dropping | Removes low-information English words from prose. | Prompt rules and Node/Python string compressors remove articles, filler words, pleasantries, hedges, and some leading phrases. | Useful for compact metadata and user-facing summaries; risky for structured facts unless guarded by schema validation. |
| Chinese-script compression modes | Offers `wenyan-lite`, `wenyan-full`, and `wenyan-ultra` for highly compact classical-Chinese-style output. | Prompt examples instruct classical-Chinese-style compression. This is not the same as "Simplified Chinese" localization; it is a terseness mode using Chinese-script/classical register. | UTK should document language/locale compression separately from serialization. Schema facts should remain language-neutral unless user config asks otherwise. |
| Auto-clarity | Drops terse style when compression could create risk or ambiguity. | Prompt rules name safety cases: security warnings, irreversible actions, unclear multi-step order, user confusion, or clarification requests. | Strong pattern for UTK: compact outputs should expand automatically for destructive actions, ambiguous results, or recovery instructions. |
| Code and symbol boundaries | Avoids changing code blocks, inline code, commands, URLs, file paths, API names, and exact error strings. | Skill rules plus compressor validators protect these spans. The MCP shrinker uses regex-protected segments. | Directly relevant. UTK serializers and detok transforms must protect code spans, paths, ids, and error strings. |
| GitHub Copilot configuration | Adds a repo-level instruction file for Copilot. | `caveman-init` writes `.github/copilot-instructions.md` with the activation rule. | UTK should expose Copilot behavior through explicit hook/plugin files and avoid hidden broad writes. |
| Agent skill marketplace install | Installs multiple skills from the repo through `npx skills add`. | Installer shells out to `skills add JuliusBrussee/caveman -a github-copilot --yes --all`. The installed bundle includes seven skills. | UTK should keep skills discoverable, versioned, and narrower than the public runtime. |
| Slash-command style UX | Provides `/caveman`, `/caveman-commit`, `/caveman-review`, `/caveman-compress`, `/caveman-help`, `/caveman-stats`. | Command TOML files and skills describe trigger behavior. | UTK should avoid public CLI, but marketplace commands/skills can be thin entrypoints for hook use, config inspection, and artifact recovery. |
| Commit message compression | Produces terse Conventional Commit messages. | `caveman-commit` skill constrains subject format, types, length, and body use; it explicitly does not run `git commit`. | UTK can learn from bounded, non-mutating skills for artifact summaries or route reports. |
| Review comment compression | Produces one-line PR review comments with path/line/problem/fix. | `caveman-review` skill enforces line-specific comments and expands for security or architectural nuance. | Good model for compact route explanations and actionable error summaries. |
| Memory/document compression | Rewrites natural-language memory files to terser prose. | `caveman-compress` detects natural-language files, backs up originals, calls Claude, validates headings/code/URLs/paths/inline code, retries targeted fixes, and restores on failure. | UTK's detok/llmlingua path should match the safety contract but keep all transforms local when promised. |
| Sensitive-file refusal | Avoids compressing likely secrets or private key files. | Filename/path heuristics reject secrets, credentials, key material, and private config paths before reading/sending content. | UTK should apply the same before local or remote text rewriting, especially for tool artifacts. |
| Stats reporting | Shows estimated saved output tokens and approximate dollar savings. | Claude hook parses active session JSONL usage, applies benchmark-derived compression ratio for `full`, and writes a statusline suffix/history file. | UTK should display measured savings from mediated tool calls, not only estimate conversational output savings. |
| Claude Code hooks | Auto-activates Caveman and reinforces mode each prompt. | SessionStart hook writes a flag and injects rules; UserPromptSubmit hook tracks activation/deactivation and can block `/caveman-stats` to return stats. | UTK's hook model should similarly separate activation, per-turn context, and report generation. |
| Statusline badge | Shows active Caveman mode and optional savings count in Claude Code. | Shell/PowerShell statusline scripts read flag/suffix files. | UTK could expose compact status summaries through Copilot-compatible affordances where available, but should not depend on statusline-only proof. |
| Cavecrew subagents | Provides terse investigator, builder, and reviewer roles. | Subagent prompts constrain output contracts so delegated results re-enter the main context in compressed form. | UTK can use the same idea for schema discovery, route review, and artifact recovery agents, with machine-checkable output contracts. |
| MCP shrink proxy | Wraps an upstream MCP server and compresses safe metadata fields. | `caveman-shrink <upstream-command>` spawns the upstream MCP server over stdio and rewrites `description` fields in list responses. It does not transform tool-call results. | This is adjacent to UTK's detok work. UTK should compete by mediating actual tool outputs, not only tool metadata, while preserving opt-in metadata shrinking. |
| Multi-agent installer | Detects many agents and installs via their native mechanisms. | Single Node installer has provider matrix, soft probes, dry-run, uninstall, hooks, MCP registration, and repo init. | Useful packaging reference. UTK should keep installs explicit, auditable, and scoped to selected integrations. |
| Plugin packaging | Ships a Codex plugin manifest with skills and branding. | `plugins/caveman/.codex-plugin/plugin.json` points to local skills, icon assets, metadata, and default prompt. | UTK's plugin marketplace packaging should follow this discoverability pattern while exposing hooks, skills, agents, and MCPs separately. |

## Implementation Mechanics

### Prompt-Layer Compression

Caveman's main behavior is implemented as instructions rather than a deterministic
runtime transform. The skill and repo instruction file define:

- words/classes to remove;
- fragments and short synonyms as acceptable output style;
- exact preservation requirements for code and technical terms;
- mode switching commands;
- stop phrases;
- cases where clarity overrides compression.

This is cheap, portable, and easy to install across agents, but it gives no
formal guarantee that facts survive. UTK should treat this as UX inspiration,
not as a substitute for schema inference, raw artifact persistence, and
validator-backed serialization.

### File Compression

`caveman-compress` is more than prompt text. It has a small pipeline:

1. classify file as natural language vs code/config;
2. reject likely sensitive paths before reading;
3. back up the original as `*.original.md`;
4. ask Claude to compress natural-language text;
5. validate that protected regions survived;
6. retry targeted repair;
7. restore the original if validation fails.

This is the strongest safety pattern in the repo. UTK should mirror the
backup/validate/restore structure for any artifact rewriting, while keeping
llmlingua2 rewriting local when UTK promises local processing.

### MCP Metadata Shrinking

`caveman-shrink` is a stdio MCP proxy. It forwards JSON-RPC traffic to an
upstream MCP server and compresses configured string fields in list responses.
By default it targets descriptions for tools, prompts, resources, and resource
templates. It protects code-looking spans through regex sentinels.

It intentionally does not mediate `tools/call` outputs. This is a competitive
opening for UTK because UTK's planned mediation captures shell and non-shell tool
results, persists raw outputs, and returns compact summaries with recovery
artifacts.

### Installer Behavior

The unified installer is a pure Node script with:

- `--dry-run`, `--force`, `--only`, `--with-init`, `--with-mcp-shrink`, and
  `--uninstall`;
- a provider matrix for many agents;
- "soft" providers such as GitHub Copilot that require explicit `--only`;
- JSONC-tolerant settings merge helpers for Claude Code hooks;
- local repo initialization through `src/tools/caveman-init.js`.

The installer's broad `--with-init` behavior is worth avoiding in UTK. If a user
asks for Copilot only, UTK should write Copilot-only files unless they opt into a
multi-agent bootstrap.

## Competitive Opportunities For UTK

1. Add measured stats that distinguish raw bytes/tokens, compact response
   bytes/tokens, artifact bytes, and recoverability. Caveman's stats are mostly
   conversational-output estimates; UTK can show direct tool-call savings.
2. Add a "terse summary" style layer as an optional serializer post-process, but
   keep the schema/route result as the source of truth.
3. Expose a safe metadata-shrink provider for MCP/tool descriptors while keeping
   actual tool outputs in the core mediation pipeline.
4. Add auto-expansion rules for destructive commands, security-sensitive output,
   ambiguous partial failures, and recovery instructions.
5. Build UTK skills with narrow contracts like Caveman's commit/review skills:
   no hidden mutation, explicit inputs, compact output, and clear stop conditions.
6. Avoid broad installer surprises. Selected integration should determine exactly
   which files are written.
7. Preserve code spans, paths, commands, URLs, ids, exact errors, and symbols
   across every compression provider, including local llmlingua2 transforms.
8. Make competitive benchmarks report "UTK vs style-only compression" scenarios,
   because Caveman optimizes assistant prose while UTK optimizes tool payloads.

## Source Files Reviewed

- `README.md`
- `INSTALL.md`
- `src/rules/caveman-activate.md`
- `src/tools/caveman-init.js`
- `bin/install.js`
- `bin/lib/settings.js`
- `skills/caveman/SKILL.md`
- `skills/caveman-help/SKILL.md`
- `skills/caveman-commit/SKILL.md`
- `skills/caveman-review/SKILL.md`
- `skills/caveman-compress/SKILL.md`
- `skills/caveman-compress/scripts/compress.py`
- `skills/caveman-compress/scripts/detect.py`
- `skills/caveman-compress/scripts/validate.py`
- `skills/cavecrew/SKILL.md`
- `src/hooks/caveman-activate.js`
- `src/hooks/caveman-mode-tracker.js`
- `src/hooks/caveman-stats.js`
- `src/mcp-servers/caveman-shrink/index.js`
- `src/mcp-servers/caveman-shrink/compress.js`
- `plugins/caveman/.codex-plugin/plugin.json`
