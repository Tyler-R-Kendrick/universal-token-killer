# Artifacts And Recovery

UTK writes all project-local state under `.utk/`.

## Observation Artifacts

Each mediated run writes:

```text
.utk/tools/<tool-id>/observations/<run-id>/input.json
.utk/tools/<tool-id>/observations/<run-id>/input.detok.json
.utk/tools/<tool-id>/observations/<run-id>/output.raw.json
.utk/tools/<tool-id>/observations/<run-id>/output.raw.txt
.utk/tools/<tool-id>/observations/<run-id>/output.raw.bin
.utk/tools/<tool-id>/observations/<run-id>/output.compact.toon
.utk/tools/<tool-id>/observations/<run-id>/output.compact.json
.utk/tools/<tool-id>/observations/<run-id>/output.compact.validation.json
.utk/tools/<tool-id>/observations/<run-id>/output.detok.txt
.utk/tools/<tool-id>/observations/<run-id>/output.detok.json
.utk/tools/<tool-id>/observations/<run-id>/output.envelope.json
.utk/tools/<tool-id>/observations/<run-id>/output.summary.json
.utk/tools/<tool-id>/observations/<run-id>/output.schema.json
.utk/tools/<tool-id>/observations/<run-id>/output.schema.toon
.utk/tools/<tool-id>/observations/<run-id>/metadata.json
```

Only one raw extension and one compact extension are written per run, based on the observed output and configured serializer. Detok files are written only when LLMLingua-2 compression applies.

## Tool Artifacts

Each tool also maintains current schema and route state:

```text
.utk/tools/<tool-id>/manifest.json
.utk/tools/<tool-id>/input.schema.json
.utk/tools/<tool-id>/output.current.schema.json
.utk/tools/<tool-id>/output.current.toon
.utk/tools/<tool-id>/rules.json
.utk/tools/<tool-id>/rules.toon
.utk/tools/<tool-id>/schema.id
.utk/tools/<tool-id>/route.json
.utk/tools/<tool-id>/route.toon
```

## Route Indexes

Global route indexes live at:

```text
.utk/routes/index.json
.utk/routes/index.toon
.utk/routes/index.min.toon
```

## Template Artifacts

Bash-like invocation helpers write compact templates and serialized guidance grammar sidecars:

```text
.utk/tools/<tool-id>/templates/cli-template.compact.toon
.utk/tools/<tool-id>/templates/cli-template.compact.json
.utk/tools/<tool-id>/templates/cli-template.guidance.json
```

Only one compact template extension is written per tool based on serializer configuration.

## Session Reuse Artifacts

`utk-init` and the session generation helpers prepare:

```text
.utk/session-agents/
.utk/session-agents/grammars/
.utk/session-agents/tools/
.utk/session-skills/<skill-name>/SKILL.md
.utk/session-skills/<skill-name>/references/
```

When the destination paths are not already concrete directories, `.github/agents` links to `.utk/session-agents` and `.agents/skills` links to `.utk/session-skills`.

## Recovery Workflow

1. Read the compact response in chat.
2. Open `output.compact.*` for the model-safe summary.
3. Open `output.raw.*` only when full fidelity is needed.
4. Use `metadata.json`, `output.schema.json`, and route artifacts to diagnose routing behavior.
5. Use `output.envelope.json` for binary or stream metadata when no textual raw output exists.

## Example Compact Response To Artifact Map

```text
Tool result stored at: .utk/tools/shell-git-diff/observations/abc/output.raw.txt
Schema: shell-git-diff.v1.1234abcd
Serializer: toon
Compact artifact: .utk/tools/shell-git-diff/observations/abc/output.compact.toon
Route confidence: 1.00
Full payload was written to disk and omitted from chat context.
```

This maps to:

- `output.raw.txt`: full command output;
- `output.compact.toon`: model-safe compact summary;
- `output.schema.json`: inferred output schema for that run;
- `metadata.json`: run id, schema id, and schema merge reason;
- `.utk/tools/shell-git-diff/route.json`: current route decision.
