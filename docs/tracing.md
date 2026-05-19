# Tracing

UTK can emit per-run traces in the [agentevals.io](https://agentevals.io) open standard so failures, parse errors, and soft fail-open paths can be evaluated as tool-usage rubrics. Tracing is **off by default** — opt in via `.utk/config.toml`.

## Enable

```toml
[tracing]
enabled = true
capture_inputs = true
capture_outputs = true
emit_eval_set = true
storage_root = ".utk/events"
process_id = "utk"
```

When enabled, every traced run writes two artifacts under `<storage_root>/`:

- `<run-id>.jaeger.json` — Jaeger JSON span document (Tempo export shape) with OpenTelemetry GenAI semantic-convention tags. This is the canonical trace.
- `<run-id>.eval_set.json` — Google ADK `EvalSet` derived from the spans, ready to feed to `agentevals run`.

When `emit_eval_set = false` only the Jaeger JSON is written.

## Span Shape

Each span follows the Jaeger Tempo export schema. The most relevant fields:

```json
{
  "traceID": "<run-id>",
  "spanID": "<16-hex>",
  "operationName": "tool.git.status",
  "startTime": 1747700000123000,
  "duration": 50000,
  "tags": [
    { "key": "gen_ai.system", "value": "utk" },
    { "key": "span.kind", "value": "internal" },
    { "key": "utk.run_type", "value": "tool" },
    { "key": "utk.inputs", "value": "{\"subcommand\":\"status\"}" },
    { "key": "utk.outputs", "value": "{\"files\":[\"a.ts\"]}" }
  ],
  "logs": [],
  "references": [{ "refType": "CHILD_OF", "traceID": "<run-id>", "spanID": "<parent>" }],
  "processID": "utk"
}
```

Failures appear as `logs[]` entries on the targeted span using OpenTelemetry exception conventions:

```json
{
  "timestamp": 1747700000124000,
  "fields": [
    { "key": "event", "value": "exception" },
    { "key": "utk.failure.code", "value": "guidance.unavailable" },
    { "key": "exception.type", "value": "Error" },
    { "key": "exception.message", "value": "guidance session is not configured" }
  ]
}
```

## Failure Codes

Stable identifiers attached as `utk.failure.code` on both span tags (for orphan failure spans) and on log entries. Current vocabulary:

| Code | Source | Type |
| --- | --- | --- |
| `cache.write` | `memoizeTool` cache fail-open | soft |
| `guidance.unavailable` | constrained decoder / structured tooling | soft |
| `planner.missing-required` | bash-like / structured planner missing required field | parse |
| `detok.unavailable` | LLMLingua-2 detok failure | soft |
| `router.fallback` | router fallback to `unknown` schema | soft |
| `template.load` | template runtime load failure | parse |
| `pack/<rule>` | every `lintPack` finding (one span per finding) | parse |

## Wiring

Tracing is plumbed via an explicit `RunContext`. Call sites accept an optional `tracer?: RunContext` parameter and call `recordFailure(tracer, { name, runType, error, extra })`. When `tracer === undefined` or `tracer.enabled === false`, `recordFailure` is a zero-cost no-op, so existing callers stay bit-for-bit identical.

```ts
import { createRunContext, flushTrace, loadUtkConfig, recordFailure } from '@utk/core';

const config = await loadUtkConfig(workspaceRoot);
const tracer = createRunContext(config, workspaceRoot);

await completeStructuredToolInvocation({ workspaceRoot, request, tools, tracer });
await lintPack(packDir, { tracer });
await flushTrace(tracer);
```

`@utk/constrained-decoder` cannot depend on `@utk/core`; instead it exposes a `tracer?` parameter shaped as `{ recordFailure(opts): void }` that core fulfils with a thin adapter, matching the existing runtime-DI seam at `completeWithGrammar.ts`.

## Reading Traces

The matching reader lives in `@utk/evals`:

```ts
import { ALL_EVALUATORS, loadUtkTrace } from '@utk/evals';

const { invocations, trace } = await loadUtkTrace(workspaceRoot, runId);
for (const evaluator of ALL_EVALUATORS) {
  const out = await evaluator.evaluate({
    protocol_version: '1.0',
    metric_name: evaluator.metricName,
    threshold: 1,
    config: { trace, expected: { 'inv-1': [{ name: 'git.status' }] } },
    invocations
  });
  console.log(evaluator.metricName, out.status, out.score);
}
```

The evaluator JSON shape follows the agentevals.io stdin/stdout protocol; `agentevals run` from the Python CLI can consume the same `.jaeger.json` and `.eval_set.json` artifacts directly.
