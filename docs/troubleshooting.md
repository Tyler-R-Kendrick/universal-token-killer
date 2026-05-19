# Troubleshooting

## Hook Returns `undefined`

This is expected for pass-through cases. Check that the payload includes:

- `tool_name` or `toolName`;
- an observable output field: `tool_output`, `toolOutput`, or `result`.

Malformed JSON and output-less events are not mediated.

## Unsupported Serializer

If config contains an unknown provider, UTK throws:

```text
Unsupported serialization provider: <value>
```

Supported values are `toon` and `compressed-json`.

## Disabled Serializer

If a provider is selected but disabled, UTK throws:

```text
Serialization provider is disabled: <provider>
```

Enable the provider or change the default/override in `.utk/config.toml`.

## Guidance Is Unavailable

Constrained routing requires a Guidance session configuration. Without one, UTK reports unavailable instead of faking a successful constrained route. Deterministic routing remains available.

The bash-like invocation helper behaves the same way: it serializes a
`guidance-ts` grammar sidecar but reports `guidance.available === false` when
no guidance session is wired, then uses deterministic known completions.

## Detok Hook Returns `{}`

`{}` means the automatic `preToolUse` hook failed open. Common causes:

- LLMLingua-2 or Python is unavailable;
- the payload is malformed;
- the selected tool is denied;
- every candidate field is protected;
- compression returned an error.

Tool execution should continue unchanged.

## Detok Hook Returns No Output

No output means there was nothing safe and useful to rewrite. Common causes:

- text is shorter than `min_chars`;
- no allowlisted prose field is present;
- compression did not change the text;
- `detok.enabled` or `detok.copilot_pre_tool_use.enabled` is false.

## RTK Parity Failure

Read the failure message. Parity failures include the scenario and metric:

```text
shell-git-diff: utkCompactTokens=23 must be strictly less than rtkTokens=23
```

Common causes:

- compact summaries became too verbose;
- required facts are no longer recoverable from artifacts;
- raw or compact artifact paths are missing from the response.

Run the focused parity suite:

```bash
npm test --workspace @utk/evals -- --run evals/rtk-parity-metrics.test.ts
```

## Bash Rewrite Metrics Failure

Bash rewrite failures name the scenario and metric. Common causes:

- a new command family does not have enough known completions;
- a required parameter is missing;
- the generated template became too verbose;
- `argv` differs from the expected fixture.

Run the focused suite:

```bash
npm test --workspace @utk/evals -- --run evals/bash-rewrite-metrics.test.ts
```

## Session Agent Or Skill Link Missing

`initializeWorkspaceStore` only creates `.github/agents` and `.agents/skills`
links when those paths do not already exist as concrete directories. If a real
directory already exists, UTK leaves it untouched and still writes generated
artifacts under `.utk/session-agents` or `.utk/session-skills`.
