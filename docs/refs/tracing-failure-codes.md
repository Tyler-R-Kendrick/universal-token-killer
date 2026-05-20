# Reference: Tracing Failure Codes

Stable identifiers attached as `utk.failure.code` on Jaeger log entries (and on orphan-span tags when no parent span exists). The vocabulary is intentionally small and additive — new codes need a row here.

## Categories

- **soft** — fail-open paths. The mediator returns a successful result; the trace records that something silently degraded.
- **parse** — manifest, template, schema, or grammar errors. The producing call typically throws or returns `undefined`.
- **policy** — denial paths (none today; reserved).

## Vocabulary

| Code | Category | Emitted from | Trigger | Extras |
| --- | --- | --- | --- | --- |
| `cache.write` | soft | `packages/core/src/tools/structuredTooling.ts` (`memoizeTool`) | `writeCachedValue` threw (disk full, readonly FS, permission). Tool result is still returned. | `cachePath` |
| `guidance.unavailable` | soft | `packages/constrained-decoder/src/completeWithGrammar.ts` | Either `sessionConfig` or `runtime` is missing — guidance grammar cannot be executed honestly. The decoder no longer ships a default runtime, so callers must inject a runtime that compiles their lark; otherwise this failure is emitted with `extra.missing` set to `'sessionConfig'` or `'runtime'`. | `slot`, `missing` |
| `planner.missing-required` | parse | `packages/core/src/tools/structuredTooling.ts` (also reached by bash-like via the shared planner) | One or more required fields could not be filled from `completions[]`. | `toolId`, `fields` |
| `detok.unavailable` | soft | `packages/core/src/detok/llmlingua2.ts` (`runLlmlingua2`) | The Python LLMLingua-2 subprocess reported `error` (binary missing, model load failure, etc). Original text is returned unchanged. Emitted **per failing leaf** — `rewriteInputForLlm` walks objects/arrays recursively, so a large input may produce multiple events on the parent span. | `model` |
| `router.fallback` | soft | `packages/core/src/router/router.ts` (`routeFromCandidates`) | No candidate matched and the candidate list was empty. Returned schema is `unknown`. | `toolId`, `candidateCount` |
| `template.load` | parse | `packages/core/src/templates/templateRuntime.ts` (`readTemplateDescriptorCache`) | Cache file present but malformed JSON. ENOENT (file simply absent) is treated as a normal cache miss and emits **nothing**. | `cachePath` |
| `pack.manifest.parse` | parse | `packages/core/src/pack/loadPack.ts` (`loadPackManifest`) | TOML parse error or schema-validation error on `utk.pack.toml`. Rethrown after recording. | `manifestPath` |
| `pack.seed.parse` | **retired** | — | `.grammar.json` sidecars are no longer supported (UTK persists field grammars as `.lark` only). This code is retained in the `noParseFailures` default prefix list (`pack.*`) so older traces still classify correctly, but no current code path emits it. | — |
| `pack/<rule>` | parse | `packages/core/src/pack/lintPack.ts` | One span per `lintPack` finding. Rule codes come straight from the finding catalog (see lintPack source). | `severity`, `packDir`, `file?`, `hint?` |

## How They Show Up In The Trace

For an in-flight span (parent provided), the failure becomes a `JaegerLog` on that span:

```json
{
  "logs": [{
    "timestamp": 1747700000124000,
    "fields": [
      { "key": "event",             "value": "exception" },
      { "key": "utk.failure.code",  "value": "cache.write" },
      { "key": "exception.type",    "value": "Error" },
      { "key": "exception.message", "value": "EROFS: read-only file system" },
      { "key": "utk.failure.extra", "value": "{\"cachePath\":\"...\"}" }
    ]
  }]
}
```

When no parent span is available (e.g. lint findings called from a script), `recordFailure` creates an **orphan span** carrying the failure code as a tag _and_ a log:

```json
{
  "operationName": "pack/manifest/missing-license",
  "tags": [
    { "key": "utk.run_type", "value": "parser" },
    { "key": "utk.failure.code", "value": "pack/manifest/missing-license" }
  ],
  "logs": [{ /* OTel exception fields, as above */ }]
}
```

## Adding A New Code

1. Pick a dot-or-slash-separated namespace (`<area>.<thing>` or `<area>/<rule>`).
2. Call `recordFailure(tracer, { name: '<code>', runType: 'tool'|'parser'|'chain'|'llm', error, extra })` at the site.
3. Add a row to the table above.
4. If it's a parse-class code that should fail evaluators by default, ensure `noParseFailures.evaluate` covers its prefix (see [evaluator-config.md](evaluator-config.md)).
5. Cover both `tracer === undefined` (no-op) and `tracer.enabled === true` (recording) branches in tests.
