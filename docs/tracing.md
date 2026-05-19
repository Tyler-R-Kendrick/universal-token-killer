# Tracing

UTK emits per-run traces in the [agentevals.io](https://agentevals.io) open standard so failures, parse errors, and soft fail-open paths can be evaluated as tool-usage rubrics. Tracing is **off by default** — opt in from `.utk/config.toml`.

## Enable

```toml
[tracing]
enabled = true              # default: false
capture_inputs = true
capture_outputs = true
emit_eval_set = true        # also derive <run>.eval_set.json
storage_root = ".utk/events"
process_id = "utk"
```

When enabled, every traced run writes two artifacts under `<storage_root>/`:

- `<run-id>.jaeger.json` — Jaeger Tempo-export spans tagged with OpenTelemetry GenAI semantic conventions.
- `<run-id>.eval_set.json` — Google ADK EvalSet derived from the spans; consumable by `agentevals run` from PyPI.

## Wiring Pattern

Every traced call site accepts an optional `tracer?: RunContext`. When `tracer === undefined` or `tracer.enabled === false`, the call site is bit-for-bit identical to the untraced path (`recordFailure` is a zero-cost no-op).

```ts
import { createRunContext, loadUtkConfig, mediateToolExecution } from '@utk/core';

const config = await loadUtkConfig(workspaceRoot);
const tracer = createRunContext(config, workspaceRoot);
await mediateToolExecution({ workspaceRoot, toolId, input, execute, tracer });
// Jaeger + EvalSet artifacts written to .utk/events/<runId>.*
```

The mediator emits a root `utk.mediate` span and a child `tool.<id>` span around `execute(input)`. Other call sites that take `tracer?` and record their own failures: `completeStructuredToolInvocation`, `lintPack`, `loadPack` / `loadPackManifest`, `readTemplateDescriptorCache`, `compressTextWithLlmlingua2` / `rewriteInputForLlm`, `routeFromCandidates`. The constrained-decoder gets a separate `tracer?: { recordFailure(opts) }` DI seam to avoid a `@utk/core` cycle.

## Where The Failures Come From

| Code | Type | Source |
| --- | --- | --- |
| `cache.write` | soft | `memoizeTool` cache write fail-open |
| `guidance.unavailable` | soft | constrained decoder / structured tooling |
| `planner.missing-required` | parse | structured / bash-like planner |
| `detok.unavailable` | soft | LLMLingua-2 subprocess error |
| `router.fallback` | soft | `routeFromCandidates` reached the empty-candidate fallback |
| `template.load` | parse | cached template descriptor missing/malformed |
| `pack.manifest.parse`, `pack.seed.parse`, `pack/<rule>` | parse | `loadPack` / `lintPack` |

Full vocabulary, extras, and the source-of-truth file/line each code is emitted from: [refs/tracing-failure-codes.md](refs/tracing-failure-codes.md).

## Lifecycle

One `RunContext` represents **one trace**: its `runId` is the Jaeger `traceID`, and `flushTrace` writes `<runId>.jaeger.json` (overwriting any previous flush for the same id). Reusing a single tracer across multiple `mediateToolExecution` calls produces a single trace whose `spans` array keeps growing, and the on-disk file is repeatedly overwritten with the cumulative state. Create a **fresh tracer per request** when the traces should not be joined.

`capture_inputs` and `capture_outputs` gate the `utk.inputs` / `utk.outputs` tags on both the root and child tool span. Disable them when inputs/outputs may contain credentials or PII that should never reach the on-disk trace.

## See Also

- [Evals-Driven Iteration](evals-driven-iteration.md) — turn traces into TDD baselines.
- [refs/agentevals-spec.md](refs/agentevals-spec.md) — exact Jaeger / EvalSet / evaluator / scorecard wire shapes.
- [refs/tracing-failure-codes.md](refs/tracing-failure-codes.md) — every failure code with extras, source, and trigger condition.
- [refs/evaluator-config.md](refs/evaluator-config.md) — per-evaluator `config` key reference.
- [Configuration](configuration.md#tracing) — the `[tracing]` config block.
