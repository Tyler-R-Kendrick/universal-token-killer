# Schema Generation

Generate schema artifacts through UTK's mediation path whenever possible. The goal is to create recoverable `.utk/` state, not a standalone schema document.

## Evidence Priority

1. Observed execution from a safe representative tool call.
2. User-provided `sampleOutput`.
3. Existing fixtures or test outputs.
4. Description-derived tentative schema.

Never run unsafe or side-effecting tools just to get a schema. For unsafe tools, ask for a sample output or create a tentative schema from the description and mark it clearly.

## Preferred Artifact Path

Use `mediateToolExecution({ workspaceRoot, toolId, input, execute })` for observed and sample-backed seeds. For samples, `execute` should return the sample output without invoking the real tool.

```ts
await mediateToolExecution({
  workspaceRoot,
  toolId: record.id,
  input: record.sampleInput ?? { utkInit: true, source: record.source },
  execute: async () => record.sampleOutput
});
```

This writes:

- `.utk/tools/<tool-id>/manifest.json`
- `.utk/tools/<tool-id>/input.schema.json`
- `.utk/tools/<tool-id>/output.current.schema.json`
- `.utk/tools/<tool-id>/output.current.toon`
- `.utk/tools/<tool-id>/history/*.schema.json`
- `.utk/tools/<tool-id>/route.json`
- `.utk/tools/<tool-id>/observations/<run-id>/*`
- `.utk/routes/index.json`
- `.utk/routes/index.toon`
- `.utk/routes/index.min.toon`

## Description-Derived Schemas

When only a description exists:

1. Generate the smallest structural JSON Schema that follows the description.
2. Use generic structural rules only: fields, types, arrays, nullable fields, enums, ranges, formats.
3. Avoid command-specific summaries and use-case rules.
4. Persist the schema under the matching tool directory and record `state: "candidate"` with a `tentative: true` marker in init metadata.
5. Include a validation gap in the report: "needs observed output".

Do not pretend a description-derived schema was observed.

## Serializer Selection

Default to `.utk/config.toml` settings. If no config exists, use UTK defaults:

```toml
[serialization]
default = "toon"

[serialization.providers.toon]
enabled = true

[serialization.providers.compressed-json]
enabled = true

[serialization.providers.tron]
enabled = true
```

Only add per-tool overrides when the user requests them or when an existing config already contains one.
