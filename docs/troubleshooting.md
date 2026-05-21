# Troubleshooting

## Hook Returns `undefined`

This is expected for pass-through cases. Check that the payload includes:

- `tool_name` or `toolName`;
- an observable output field: `tool_output`, `toolOutput`, or `result`.

Malformed JSON and output-less events are not mediated.

## Unsupported Serializer

If config contains an unknown provider, UTK throws:

```text
Unsupported serialization provider: <value>. Loaded providers: json-compact, toon, tron
```

Built-in values are `toon`, `json-compact`, and `tron`. Workspace serializers load from `.utk/plugins/serialization/<plugin-name>` or installed `.utk/packs/<pack-name>` when the folder is a pack with `utk.pack.toml`, a valid `.lark` grammar, and a registrar module.

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

## Tracing Did Not Write A Trace File

`mediateToolExecution` only writes `.utk/events/<runId>.jaeger.json` when:

- `[tracing] enabled = true` in `.utk/config.toml`, AND
- a `tracer` is passed via `createRunContext(...)` into the call.

Without both, every call site that takes `tracer?` is a no-op (preserves existing untraced behavior). Once enabled, the run id used for the trace is the `tracer.runId` (defaults to a fresh `randomUUID()`). See [Tracing](tracing.md).

## Trace Contains A Failure Code I Did Not Expect

Look up the code in [refs/tracing-failure-codes.md](refs/tracing-failure-codes.md) — every code lists the source file, runtime trigger, and which `extra` keys it sets. Soft codes (`cache.write`, `guidance.unavailable`, `detok.unavailable`, `router.fallback`) do not break mediation; parse codes (`pack.*`, `template.load`, `planner.missing-required`) usually mean a fixture or pack needs fixing.

## Baseline Refused To Write

`writeBaseline` requires either `UTK_BASELINE_UPDATE=1` in the environment or `{ force: true }` in the options. This prevents `npm test` from silently overwriting a checked-in baseline. See [refs/baseline-store.md](refs/baseline-store.md).

## `agentevals-cli` Spawn Returned `binary-missing`

The optional cross-check via `runAgentEvalsCli(...)` looks for the Python `agentevals` binary on PATH. Install with `pip install agentevals-cli` (Python 3.11+). UTK's TS evaluators do not depend on the CLI — `available: false` is expected in CI environments without Python.

## Session Agent Or Skill Link Missing

`initializeWorkspaceStore` only creates `.github/agents` and `.agents/skills`
links when those paths do not already exist as concrete directories. If a real
directory already exists, UTK leaves it untouched and still writes generated
artifacts under `.utk/session-agents` or `.utk/session-skills`.
