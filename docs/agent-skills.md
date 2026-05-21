# Agent Skills

UTK ships repo-local agent skills for agents that operate the hook-first workflow without adding a public CLI or VS Code extension. Canonical skills live under root `skills/`, and the local `detok` MCP helper is available separately for LLMLingua-2 text rewriting.

## Marketplace Compatibility

The skills are packaged as Agent Skills compatible with `agentskills.io` and `skills.sh` discovery:

- each skill lives under root `skills/<name>/`;
- each skill has a root `SKILL.md` with YAML frontmatter;
- frontmatter `name` matches the directory name and uses lowercase hyphenated identifiers;
- frontmatter `description` explains what the skill does and when to use it;
- detailed operating guidance is split into focused `references/` files for progressive disclosure;
- `agents/openai.yaml` provides OpenAI-specific display metadata and a default prompt that explicitly invokes the skill.

Validate local discovery before publishing:

```bash
npx skills add . --list
```

Expected discoverable skills:

```text
detoks
utk
utk-init
```

## GitHub Copilot Plugin Marketplace

UTK also exposes these skills through the GitHub Copilot CLI plugin marketplace convention:

- `.github/plugin/marketplace.json`: repository marketplace manifest.
- `.github/plugins/universal-token-killer/.github/plugin/plugin.json`: plugin manifest.
- `.github/plugins/universal-token-killer/skills/`: Copilot-installable copies of the UTK skills.
- `.github/plugins/universal-token-killer/agents/`: custom Copilot agents.
- `.github/plugins/universal-token-killer/.mcp.json`: plugin MCP server config for `detok`.

Install from a local checkout:

```bash
copilot plugin marketplace add .
copilot plugin install universal-token-killer@universal-token-killer
```

The plugin skill copies must stay byte-for-byte synchronized with `skills/`; package-boundary tests enforce this.

## `skills/utk`

Use for day-to-day operation and recovery:

- Copilot hook behavior and pass-through rules;
- `.utk/config.toml` serializer selection;
- raw and compact artifact recovery;
- schema and route summaries.

## `skills/utk-init`

Use when initializing UTK for a project. The skill discovers registered tools, optionally narrows to user-specified tools or named skills, and generates schema seeds for all selected tool outputs.

It accepts optional descriptions and samples:

```yaml
tools:
  - id: github.pull-request.list
    description: Returns JSON pull request summaries with number, title, author, state, labels, and url fields.
  - id: shell.git.diff
    sampleInput:
      command: git diff -- README.md
    sampleOutput: |
      diff --git a/README.md b/README.md
      ...
```

Evidence priority is observed output, sample output, existing fixtures, then description-derived tentative schemas. Description-only schemas are marked as needing observed output before they are treated as validated.

Expected output is a concise init report with tool count, source, schema path, serializer, and unresolved validation gaps.

`utk-init` also prepares reusable session context:

- `.utk/session-agents`, symlinked or junctioned to `.github/agents` when no concrete `.github/agents` directory exists.
- `.utk/session-skills`, symlinked or junctioned to `.agents/skills` when no concrete `.agents/skills` directory exists.

Generated session agents must require sketch-of-thought through `reason-with-lexicon` and store the formal lexicon grammar as a guidance sidecar. Generated session skills keep repeated procedure text in compact `SKILL.md` bundles plus focused `references/` files.

## `skills/detoks`

Use when an agent should compress bulky prompt text, consolidate `detoks-skill` guidance into `detoks`, shrink AGENTS.md-style always-loaded files into memory and skills, or refactor GitHub Copilot custom agents into smaller subagents. The root skill routes to focused references for `detoks-prompt`, skill cleanup, AGENTS.md cleanup, GHCP subagent orchestration, and MCP details.

## Synchronization Rules

Canonical skill files under `skills/` are the source of truth. The Copilot plugin copies under `.github/plugins/universal-token-killer/skills/` must stay byte-for-byte synchronized with the canonical folders; package-boundary tests enforce this.
