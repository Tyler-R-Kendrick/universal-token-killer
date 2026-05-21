# Session Agents

`utk-init` must create a project-local session-agent area for reusable GitHub
Copilot subagents:

- source directory: `.utk/session-agents/`
- Copilot exposure path: `.github/agents`
- link direction: `.github/agents` points at `.utk/session-agents`

Use `initializeWorkspaceStore(workspaceRoot)` before generating schemas or
agents. It creates the session-agent directory and the `.github/agents` link.

## When To Create A Dynamic Subagent

Create a dynamic session agent when the chat shows repeated work that is likely
to recur, especially:

- schema routing analysis;
- serializer or artifact recovery;
- domain-specific code review;
- repeated debugging of the same tool family;
- repeated planning in one product or infrastructure area.

Do not create one-off agents for a single transient question.

## Required Agent Contract

Generated agents must be GitHub Copilot custom agent profiles under
`.utk/session-agents/*.agent.md`. Each one must:

- include `tools: ["reason-with-lexicon"]` in frontmatter;
- require `sketch-of-thought` before final recommendations;
- reference a grammar hash and sidecar path;
- avoid inlining expert lexicon terms in the agent body when the sidecar can
  carry them;
- keep user-facing output concise and actionable.

## Reason With Lexicon

For each generated subagent, write a sidecar registration under
`.utk/session-agents/tools/` for the `reason-with-lexicon` tool. The registration
must point at a `guidance-ts` grammar JSON under `.utk/session-agents/grammars/`.

The grammar enforces sketch-of-thought shape and allowed expert lexicon terms.
The agent profile should reference the grammar by hash/path instead of spending
prompt tokens on the full lexicon.

## API Shape

Use `upsertSessionAgent` for explicit agent requests and
`upsertSessionAgentsFromChat` when selecting agents from repeated chat patterns:

```ts
await upsertSessionAgent({
  workspaceRoot,
  name: 'schema router analyst',
  description: 'Use when UTK schema routing needs route confidence analysis.',
  domain: 'schema-routing',
  expectedReuse: 'Repeated schema routing/debugging work appears in this chat.',
  lexicon: ['schema', 'route', 'confidence', 'serializer', 'artifact'],
  triggers: ['schema routing', 'route confidence']
});
```

Report every generated agent path, grammar path, tool registration path, and any
reason the agent was skipped.
