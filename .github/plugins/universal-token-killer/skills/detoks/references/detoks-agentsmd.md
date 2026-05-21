# Detoks AGENTS.md Reference

Use this when shrinking or reorganizing `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Copilot instructions, or similar always-loaded agent instruction files.

## Goal

Keep always-loaded instructions small. Extract durable facts into memory. Extract repeatable procedures and tool/API guidance into agent skills. Leave `AGENTS.md` as routing and policy, with links to memory and skills.

## Workflow

1. Preserve raw `AGENTS.md`.
2. Read `detoks-prompt.md`; use `detoks-prompt` for large prose sections before deciding what to move.
3. Classify each section:
   - Stable repo facts, conventions, preferences, decisions, outcomes: memory.
   - How to use tools, MCPs, CLIs, APIs, workflows, validators, release steps: skill.
   - Critical global policy, safety, terse style, branch rules, mandatory checks: keep in `AGENTS.md`.
4. Replace extracted memory text with a short link/reference to the memory entry or memory index.
5. Replace extracted tool/workflow text with a short instruction to use the relevant skill.
6. Remove duplicated prose after references exist.

## Memory Extraction

Memory entries should be factual, reusable, and searchable. Prefer short bullets with exact paths, commands, project names, and observed outcomes. Do not store transient guesses, stale task status, secrets, or large copied docs.

Replacement pattern:

```markdown
Project history and prior decisions: see memory entry `<memory-key-or-path>`.
```

## Skill Extraction

Create or update a skill when instructions explain how to operate a tool, MCP, CLI, API, framework, deployment flow, test harness, or repeated repo workflow.

Replacement pattern:

```markdown
For `<workflow>`, use `$<skill-name>`.
```

Keep exact commands in the skill reference, not `AGENTS.md`, unless the command is a global safety gate.

## Validation

After refactor, check that `AGENTS.md` still answers:

- What must always be obeyed?
- Which memory holds project history?
- Which skill handles each repeated workflow?
- Which commands prove the refactor did not break packaging?
