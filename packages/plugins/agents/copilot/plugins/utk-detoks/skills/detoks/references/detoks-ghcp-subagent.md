# Detoks GitHub Copilot Subagent Reference

Use this when optimizing GitHub Copilot custom agents, `.agent.md` files, plugin agents, or subagent orchestration.

## Official Format Facts

GitHub Copilot custom agents are Markdown files with YAML frontmatter and a Markdown body. GitHub's custom-agent reference defines fields such as `name`, required `description`, `target`, `tools`, `model`, `disable-model-invocation`, `user-invocable`, `mcp-servers`, and `metadata`; the Markdown body holds behavior and instructions and is capped at 30,000 characters.

VS Code custom agents also support `agents` and `handoffs` frontmatter. `agents` restricts which subagents can be invoked and requires the `agent` tool in `tools`. `handoffs` entries support `label`, `agent`, `prompt`, optional `send`, and optional `model`.

Compatibility rule: GitHub Copilot cloud currently ignores VS Code/IDE `argument-hint` and `handoffs`. Keep handoff syntax only when targeting VS Code or mixed local IDE use, and do not rely on it for GitHub.com cloud behavior.

Sources:

- https://docs.github.com/en/copilot/reference/custom-agents-configuration
- https://code.visualstudio.com/docs/copilot/customization/custom-agents
- https://docs.github.com/copilot/reference/copilot-cli-reference/cli-command-reference

## Refactor Workflow

1. Preserve raw `.agent.md`.
2. Split YAML frontmatter from Markdown body.
3. Clean frontmatter separately:
   - keep required `description`;
   - keep `name` if display name differs from filename;
   - keep `tools` narrow and valid for target surface;
   - use `target` only when surface-specific behavior matters;
   - remove stale, unsupported, duplicate, or conflicting fields;
   - preserve `mcp-servers` only when needed and valid.
4. Read `detoks-prompt.md`; compress body prose with `detoks-prompt`, preserving links, tool names, code, commands, schemas, and exact output contracts.
5. Identify mixed concerns in body:
   - planning vs implementation;
   - research vs editing;
   - security review vs product work;
   - test authoring vs runtime debugging;
   - data/API/tool operation vs UI/code operation.
6. Split mixed concerns into multiple `.agent.md` subagents when one agent has independent roles, different tool needs, or phase-specific context.
7. Create a coordinator agent when multiple subagents are needed.

## Orchestration Pattern

Coordinator for VS Code local orchestration:

```markdown
---
name: Feature Builder
description: Coordinate research then implementation through specialized subagents.
tools: ['agent']
agents: ['Researcher', 'Implementer']
handoffs:
  - label: Implement Plan
    agent: Implementer
    prompt: Implement the plan from this conversation.
    send: false
---

Use Researcher for read-only context. Use Implementer for code edits after plan approval.
```

For GitHub Copilot cloud or CLI portability, keep explicit body instructions for delegation and do not depend on `handoffs` execution.

## Lint And Validation

Run available GitHub Copilot custom-agent lint/diagnostics for the target environment. If an official CLI linter is unavailable, perform deterministic checks:

```powershell
Get-ChildItem .github\agents, .github\plugins -Recurse -Filter *.agent.md | ForEach-Object { $_.FullName }
```

Then validate each agent file:

- file extension is `.agent.md` or supported `.md`;
- YAML frontmatter parses;
- `description` exists and is non-empty;
- `tools` is a YAML array or accepted string form;
- `agents` is only used with `agent` tool;
- `handoffs` entries include `label`, `agent`, and `prompt`;
- body remains under 30,000 characters for GitHub custom agents;
- every referenced subagent name resolves to a real agent file or documented built-in agent.

Use VS Code Agent Customizations diagnostics when available to catch schema and frontmatter issues. Fix reported formatting before claiming completion.

## Edge Cases

Do not let compressed or regenerated `.agent.md` files:

- use underscores, traversal fragments, or punctuation in file-derived slugs;
- leak injected `tools`, `agents`, `handoffs`, `target`, or `model` fields from multiline descriptions;
- keep duplicate tools, agents, handoffs, or MCP tool names;
- use `agents` or `handoffs` without the `agent` tool;
- keep handoff entries missing `label`, `agent`, or `prompt`;
- rely on VS Code `handoffs` for `target: github-copilot`;
- drop explicit delegation guidance when cloud target cannot execute handoffs;
- inline long body guidance instead of moving it into prompt references;
- leave stale grammar, tool-registration, or prompt-reference sidecars after regeneration;
- serialize `mcp-servers` without narrowed tools when only specific MCP tools are allowed.

Frontmatter-specific checks:

- `description` must be present, concise, and trigger-oriented; move long/raw description detail into references.
- `model`, `disable-model-invocation`, `user-invocable`, `target`, `argument-hint`, `metadata`, `hooks`, and retired `infer` must be normalized against the target surface.
- For `target: github-copilot`, omit VS Code-only `argument-hint`, `hooks`, `agents`, and `handoffs`; add explicit body delegation guidance instead.
- For `target: vscode`, keep valid `argument-hint`, `hooks`, `agents`, and `handoffs`.
- Keep frontmatter field ordering stable: identity, target/model/invocation controls, tools, orchestration, MCP, metadata/hooks.

Tool and MCP checks:

- Accept YAML arrays and comma-separated tool strings, but normalize `#tool:` body-style references before frontmatter output.
- Preserve explicit `*` without redundantly adding `agent`; otherwise add `agent` when `agents` or `handoffs` are used.
- Drop blank or shell-like tool names from frontmatter.
- For MCP servers, preserve `command`, `url`, `args`, `tools`, `env`, and `headers` with template secrets intact.
- Omit MCP servers that have neither `command` nor `url`.

Handoff checks:

- Include only handoffs with `label`, `agent`, and `prompt`.
- Preserve `send` and handoff `model`.
- Quote YAML-sensitive labels/prompts.
- Deduplicate handoffs by label plus target agent.
- Infer `agents` from handoffs for VS Code agents when missing.
