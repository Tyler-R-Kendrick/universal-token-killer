---
name: utk-init
description: Use when initializing Universal Token Killer schema artifacts for a project, discovering registered Copilot tools, seeding .utk output schemas, or narrowing schema generation to specific tool ids with descriptions or sample outputs
---

# UTK Init

Initialize UTK by discovering registered tools, generating output schemas from observable evidence, and writing project-local `.utk/` artifacts. This skill is for hook-first setup only. Do not create a public CLI or VS Code extension. Do not create mediation MCP servers; the only local MCP helper is `detok` for LLMLingua-2 text rewriting.

## Workflow

1. Read `references/input-contract.md` to capture optional user scope: specific tool ids, agent skill names, descriptions, sample inputs, and sample outputs.
2. Read `references/tool-discovery.md` to find registered tools in the target project. Prefer explicit registries and hook descriptors over guesses.
3. Read `references/schema-generation.md` to seed schemas from observed outputs, then samples, then description-derived tentative schemas.
4. Read `references/session-agents.md` to initialize `.utk/session-agents`, link it into `.github/agents`, and create reusable Copilot subagents for repeated reasoning or domain-specific work.
5. Read `references/session-skills.md` to initialize `.utk/session-skills`, link it into `.agents/skills`, and create reusable Agent Skills for redundant session work.
6. Read `references/report.md` before replying so the final summary includes generated paths, confidence, and unresolved gaps.

## Operating Rules

- Initialize every registered tool unless the user supplies a narrower list.
- Use provided tool descriptions as schema hints, not as facts about observed runtime output.
- Mark description-derived schemas as tentative and list validation gaps.
- Preserve UTK architecture: raw artifacts, schema history, routing metadata, TOON or compressed JSON serialization, and `.utk/config.toml`.
- Dynamic session agents must require sketch-of-thought through the `reason-with-lexicon` tool and must reference llguidance/guidance grammar sidecars instead of inlining expert lexicons.
- Dynamic session skills should reduce token usage by moving repeated workflow instructions into compact `SKILL.md` bundles under `.utk/session-skills`.
- Pass through nothing just because it is non-shell; non-shell tool outputs are in scope when observable.
