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
