# Reference: agentevals.io Artifact Spec

Canonical wire shapes UTK emits and consumes, sourced from [github.com/agentevals-dev/agentevals](https://github.com/agentevals-dev/agentevals) (Apache 2.0, Solo.io governance). UTK pins to the Jaeger-JSON trace + Google ADK EvalSet pairing documented in `docs/eval-set-format.md` of the spec repo.

## 1. Jaeger Trace (`<run-id>.jaeger.json`)

```json
{
  "data": [{
    "traceID": "<run-id>",
    "spans": [ /* JaegerSpan[] */ ],
    "processes": { "<processId>": { "serviceName": "utk", "tags": [] } }
  }]
}
```

### JaegerSpan

| Field | Type | Notes |
| --- | --- | --- |
| `traceID` | string | Equal to `<run-id>`. |
| `spanID` | string | 16 hex chars (`randomUUID()` flattened and truncated). |
| `operationName` | string | `utk.mediate`, `tool.<normalized-tool-id>`, `pack/<rule>`, etc. |
| `startTime` | int64 | **microseconds** since the Unix epoch (`Date.now() * 1000`). |
| `duration` | int64 | microseconds. |
| `tags` | `JaegerTag[]` | Key/value pairs (see tag vocabulary below). |
| `logs` | `JaegerLog[]` | Exception events with OTel exception conventions. |
| `references` | `JaegerReference[]` | `{ refType: 'CHILD_OF' \| 'FOLLOWS_FROM', traceID, spanID }`. |
| `processID` | string | Joins back to `processes[processID]`. |

### Tag Vocabulary

UTK uses OpenTelemetry GenAI semantic conventions plus a small `utk.*` namespace.

| Key | Value | Source helper |
| --- | --- | --- |
| `gen_ai.system` | `"utk"` | `TAGS.system` |
| `gen_ai.request.model` | model id | `TAGS.model` |
| `gen_ai.request.openai.tool_calls` | canonical-JSON `{name,id,arguments}[]` | `TAGS.toolCalls` |
| `gen_ai.response.message.tool_result` | canonical-JSON result | `TAGS.toolResult` |
| `span.kind` | `internal` \| `client` \| `server` | `TAGS.spanKind` |
| `utk.run_type` | `tool` \| `parser` \| `chain` \| `llm` | `TAGS.utkRunType` |
| `utk.inputs` | raw string (passthrough) or canonical-JSON | `TAGS.utkInputs` |
| `utk.outputs` | raw string (passthrough) or canonical-JSON | `TAGS.utkOutputs` |
| `utk.failure.code` | stable failure id | `TAGS.utkFailureCode` |

Strings are stored as-is; non-strings are passed through `stableStringify` so canonical-JSON diffs stay byte-stable.

### Exception Log Shape

```json
{
  "timestamp": 1747700000124000,
  "fields": [
    { "key": "event",                "value": "exception" },
    { "key": "utk.failure.code",     "value": "guidance.unavailable" },
    { "key": "exception.type",       "value": "Error" },
    { "key": "exception.message",    "value": "guidance session is not configured" },
    { "key": "exception.stacktrace", "value": "Error: ...\n    at ..." },
    { "key": "utk.failure.extra",    "value": "{\"slot\":\"path\"}" }
  ]
}
```

`exception.stacktrace` is omitted when the error has no `.stack`. `utk.failure.extra` is omitted when no extras were passed.

## 2. EvalSet (`<run-id>.eval_set.json`)

Google ADK EvalSet shape, derived from spans by `toEvalSet(spans, runId)`.

```json
{
  "eval_set_id": "<run-id>",
  "name": "utk-run-<run-id>",
  "eval_cases": [{
    "eval_id": "<run-id>",
    "conversation": [{
      "invocation_id": "<root-span-id-or-run-id>",
      "user_content":   { "role": "user",  "parts": [{ "text": "..." }] },
      "final_response": { "role": "model", "parts": [{ "text": "..." }] },
      "intermediate_data": {
        "tool_uses":      [{ "name": "<operationName>", "id": "<spanID>", "args": {} }],
        "tool_responses": [{ "name": "<operationName>", "id": "<spanID>", "response": "" }]
      }
    }]
  }]
}
```

Derivation rules:

- Root span (no `references`) is the conversation source. Its `utk.inputs` tag becomes `user_content.parts[0].text`; `utk.outputs` becomes `final_response.parts[0].text`.
- Every span with `utk.run_type = tool` becomes one `tool_uses` + `tool_responses` row in order of span emission.
- `args` is `JSON.parse(utk.inputs)` when parseable, else the raw string, else `{}`.
- `response` is the raw `utk.outputs` string (empty when absent).

## 3. Evaluator JSON Protocol

Language-agnostic stdin/stdout protocol (UTK implements it natively in TS; `agentevals-cli` from PyPI implements it in Python — they speak the same shape).

```ts
type EvaluatorInput = {
  protocol_version: '1.0';
  metric_name: string;
  threshold: number;
  config: Record<string, unknown>;
  invocations: Invocation[];
};
type EvaluatorOutput = {
  score: number;
  status: 'PASSED' | 'FAILED';
  per_invocation_scores: number[];
  details: { reason: string; [k: string]: unknown };
};
```

Per-evaluator `config` keys are documented in [evaluator-config.md](evaluator-config.md).

## 4. Scorecard

The output of running all evaluators for one eval set.

```json
{
  "eval_set_id": "<id>",
  "results": [{
    "eval_id": "<id>",
    "overall_score": 0.92,
    "metrics": { "tool_trajectory_avg_score": 1, "response_match_score": 0.85 },
    "status": "PASSED"
  }]
}
```

Baselines are scorecards stored under `packages/evals/baselines/<eval-set-id>.json`. The first successful run is the baseline; subsequent runs diff against it (see [baseline-store.md](baseline-store.md)).

## 5. Versioning

The agentevals.io spec is implementation-defined (`agentevals-cli` v0.7.1 at time of writing). UTK pins to the Jaeger JSON + Google-ADK EvalSet shape documented in the spec repo's `docs/eval-set-format.md`; re-verify on each spec bump. The on-the-wire artifacts are forward-compatible with `agentevals run` from PyPI (`pip install agentevals-cli`).
