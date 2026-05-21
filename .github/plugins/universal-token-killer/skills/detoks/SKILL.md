---
name: detoks
description: Use when compressing prompts, agent skills, AGENTS.md files, GitHub Copilot custom agents, subagent definitions, or bulky artifacts before sending text to LLM context; includes detoks-prompt CLI/MCP use, skill consolidation, AGENTS.md memory/skill extraction, and GHCP subagent/frontmatter orchestration
---

# Detoks

Orchestrate all detoks workflows through this skill. Keep `SKILL.md` as router only; load focused references before changing prompt, skill, AGENTS.md, or GitHub Copilot custom-agent content.

## Route

- Prompt, reusable instruction, large prose artifact: read `references/detoks-prompt.md`.
- Skill or old `detoks-skill` content: read `references/detoks-skill.md`.
- AGENTS.md cleanup: read `references/detoks-agentsmd.md`, then `references/detoks-prompt.md`.
- GitHub Copilot custom agent or subagent refactor: read `references/detoks-ghcp-subagent.md`, then `references/detoks-prompt.md`.
- MCP tool details or rates: read `references/detok-mcp.md`.

## Core Rules

1. Preserve raw source before compression or refactor.
2. Use file/stdin CLI flow for large prompt text; avoid pasting bulky source into chat.
3. Preserve code blocks, inline code, quoted requirements, frontmatter keys, tool names, file paths, links, and exact validation commands.
4. Prefer references and extracted skills over one huge instruction file.
5. State when conclusions depend on compressed text.
