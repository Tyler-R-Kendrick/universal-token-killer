# Input Contract

Accept plain-language requests and optional structured hints. If the user provides none, initialize all discovered tools.

## Optional User Hints

The user may provide:

```yaml
workspaceRoot: .
tools:
  - id: shell.git.diff
    description: Returns unified git diff text for tracked file changes.
    sampleInput:
      command: git diff -- README.md
    sampleOutput: |
      diff --git a/README.md b/README.md
      ...
  - id: github.pull-request.list
    description: Returns JSON pull request summaries with number, title, author, branch, and status fields.
skills:
  - name: repo-review
    tools:
      - id: github.pull-request.diff
        description: Returns changed files and hunks for a pull request.
serializer: toon
```

Also accept equivalent prose:

- "Only initialize `shell.git.status` and `github.pull-request.list`."
- "For `linear.issue.search`, expect an array of issues with id, title, state, assignee, labels, and url."
- "Use these sample outputs as schema seeds."

## Scope Resolution

Normalize user scope in this order:

1. Explicit tool ids.
2. Tool ids nested under named agent skills.
3. Tool id patterns such as `shell.git.*`.
4. All registered tools when no narrower scope exists.

If a named skill maps to no tool registry entry, report it as unresolved instead of inventing tool ids.

## Hint Handling

- `description` is schema evidence only when no observed or sample output exists.
- `sampleOutput` is stronger than `description` and should produce a normal schema seed.
- `sampleInput` should be written as the input shape for the tool when available.
- Serializer hints should update `.utk/config.toml` only when the user explicitly asks for a default or per-tool override.
