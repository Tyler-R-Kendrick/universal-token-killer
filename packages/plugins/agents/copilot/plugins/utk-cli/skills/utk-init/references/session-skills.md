# Session Skills

`utk-init` must create a project-local session-skill area for reusable Agent
Skills that reduce repeated prompt instructions:

- source directory: `.utk/session-skills/`
- Agent Skills exposure path: `.agents/skills`
- link direction: `.agents/skills` points at `.utk/session-skills`

Use `initializeWorkspaceStore(workspaceRoot)` before generating schemas,
session agents, or session skills. It creates the session-skill directory and
the `.agents/skills` link when the target path is not already a concrete
directory.

## When To Create A Dynamic Skill

Create a dynamic session skill when the chat repeats a workflow that should be
reused without spending tokens restating the same instructions, especially:

- repeated triage or debugging checklists;
- repeated repo-specific validation steps;
- recurring schema or artifact review;
- recurring domain-specific planning;
- repeated user preferences that are operational rather than global.

Do not create one-off skills for a single transient request.

## Required Skill Contract

Generated skills must be Agent Skill bundles under
`.utk/session-skills/<skill-name>/`. Each bundle should include:

- `SKILL.md` with YAML frontmatter;
- a concise purpose statement explaining token-saving reuse;
- short trigger bullets;
- a compact procedure;
- `references/` files for details that would otherwise bloat the skill;
- `agents/openai.yaml` metadata so OpenAI-compatible skill loaders can discover
  the generated skill.

Keep the root `SKILL.md` compact. Move longer examples, checklists, and
domain-specific detail into `references/`.

## API Shape

Use `upsertSessionSkill` for explicit user-requested reusable workflows and
`upsertSessionSkillsFromChat` when selecting skills from repeated chat patterns:

```ts
await upsertSessionSkill({
  workspaceRoot,
  name: 'schema route triage',
  description: 'Use when repeated UTK schema routing triage is needed.',
  purpose: 'Reduce repeated schema routing instructions across future turns.',
  triggers: ['schema routing', 'route confidence'],
  procedure: [
    'Inspect route confidence and schema id.',
    'Compare serializer artifact and raw artifact references.',
    'Report the smallest actionable fix.'
  ],
  references: {
    'route-checklist.md': 'Check route confidence, schema id, serializer id, and artifact paths.'
  }
});
```

Report every generated skill path and any reason a skill was skipped.
