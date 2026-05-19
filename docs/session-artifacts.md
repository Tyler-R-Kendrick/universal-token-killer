# Session Agents And Skills

UTK can turn repeated session-specific work into project-local reusable
artifacts. This reduces future prompt tokens by moving repeated reasoning
contracts, lexicons, and procedures into `.utk/` files that agents can discover.

This is not background automation. Session agents and skills are created by
`utk-init` or by explicit helper calls when a user or host has enough evidence
that the work pattern is likely to recur.

## Initialization

`initializeWorkspaceStore(workspaceRoot)` creates:

```text
.utk/config.toml
.utk/config.json
.utk/.gitignore
.utk/session-agents/
.utk/session-skills/
```

It then links discovery locations when safe:

```text
.github/agents -> .utk/session-agents
.agents/skills -> .utk/session-skills
```

If `.github/agents` or `.agents/skills` already exists as a concrete
directory, UTK leaves it in place.

The initialization step is idempotent: existing config files, symlinks, and
junctions are preserved.

## Dynamic Session Agents

Session agents are created when repeated chat patterns suggest domain-specific
reasoning will likely recur. The helper writes:

```text
.utk/session-agents/<agent-name>.agent.md
.utk/session-agents/grammars/<agent-name>.<hash>.guidance.json
.utk/session-agents/tools/<agent-name>.reason-with-lexicon.json
```

Generated agents must:

- require sketch-of-thought before recommendations;
- call `reason-with-lexicon`;
- reference a guidance grammar hash instead of inlining the expert lexicon;
- keep visible answers concise and actionable;
- preserve UTK's hook-first, artifact-backed architecture.

Candidate discovery is trigger-based. A profile becomes a candidate when enough
configured triggers appear in recent messages.

The generated agent file intentionally references the grammar hash and grammar
path instead of copying the full lexicon grammar into every prompt.

## Dynamic Session Skills

Session skills are created for repeated procedures that do not need a full
custom subagent. The helper writes:

```text
.utk/session-skills/<skill-name>/SKILL.md
.utk/session-skills/<skill-name>/agents/openai.yaml
.utk/session-skills/<skill-name>/references/*.md
```

Generated skills keep the root `SKILL.md` compact and place detailed procedure
or checklist material in `references/`.

This mirrors the canonical repo skill pattern: terse root skill, progressive
reference disclosure, and OpenAI metadata in `agents/openai.yaml`.

## API

```ts
import {
  initializeWorkspaceStore,
  upsertSessionAgent,
  upsertSessionSkill
} from '@utk/core';
```

Use `upsertSessionAgentsFromChat` and `upsertSessionSkillsFromChat` when the
caller has recent chat messages plus reusable profiles. Use `upsertSessionAgent`
or `upsertSessionSkill` when the user explicitly asks for a specific reusable
agent or skill.

## Boundaries

- Generated session artifacts are project-local and reviewable.
- They do not replace canonical repo skills under `skills/`.
- They do not create a public CLI, VS Code extension, or mediation MCP server.
- They should be created only for patterns that are likely to recur.
