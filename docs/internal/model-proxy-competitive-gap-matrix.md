# Model Proxy Competitive Gap Matrix

Internal note. Keep public docs focused on shipped UTK behavior, not competitor positioning.

| Competitor area | UTK before v2 | v2 implementation | Eval fixture | Shipped reason |
|---|---|---|---|---|
| Compresr history compaction | Prompt/tool compaction only | `ContextBudgetManager` now drives recoverable `[utk-block:<id>]` replacement of eligible old history/tool spans | `gateway-session-block-compaction`, `gateway-v3-replace-history` | Needed for context-limit avoidance without duplicate context |
| Compresr tool discovery | Tool schemas minimized but not filtered | `filterToolDefinitionsForIntent` supports `off`, `static-filter`; deferred mode persists tool catalogs and retries one `utk_find_tool` call | `gateway-deferred-tool-discovery`, `gateway-v3-find-tool-loop` | Repeated tool schemas are high-cost |
| Compresr expand context | Full artifact expansion only | `{ id, range, query, blockId, handle }` recovery | `headroom-ccr-range-search`, `gateway-context-proof` | Stronger than TTL shadow refs |
| Headroom CacheAligner | None | `detectCacheVolatility` reports timestamps, UUIDs, JWT-like strings, hashes; observe-only | `headroom-cache-aligner` | Preserves provider cache without silent rewrites |
| Headroom ContentRouter | Coarse route reasons | Added route-specific compactors for JSON arrays, search output, logs, diagnostics, diffs, file envelopes, and edit loops | `headroom-structured-json-array`, `gateway-v3-route-specific-compactors` | Explains savings by content class and preserves exact diagnostics |
| Headroom/Token Company repeated tool output | No gateway ledger | `SessionContextLedger` records stable message/tool IDs and observes dedupe candidates | `gateway-dedupe-repeated-tools` | Cuts repeated `rg`, `git status`, and JSON tool-output cost without deleting raw artifacts |
| OpenCode DCP stale errors | None | Retention policy marks old failed tool inputs after `purge_error_after_turns`, excluding protected tools | `gateway-purge-stale-errors` | Prevents stale failures from crowding current context |
| lean-ctx archive recovery | Direct raw file refs | `.utk/model-proxy/index.jsonl` with route/schema/hash/line count plus search handles | `leanctx-artifact-proof-hash`, `gateway-context-proof` | Proof-friendly local recovery |
| lean-ctx shell patterns | RTK fixtures only | Competitive fixture names for build logs and exact diagnostics | `leanctx-shell-patterns` | Keeps diagnostic safety visible |
| LeanCTX Copilot context-runtime behavior | No Copilot-specific competitive suite | `leanCtxCopilotFixtures` plus `scripts/bench-leanctx-copilot.ts` measure prompt surfaces, post-tool outputs, schema discovery, relevance, correctness, groundedness, and token wins | `scripts/bench-leanctx-copilot.test.ts` | Ensures Copilot savings do not hide accuracy or grounding regressions |
| OpenSlimEdit tool overhead | Static description map | Policy-backed filter plus schema minimizer metrics | `prompt-verbose-tool-schema` | Measures custom schema cost |
| OpenSlimEdit line ranges | Edit expansion existed | Recovery index records raw artifacts; expand endpoint supports range | `openslimedit-file-read-edit-loop` | Compact edit loops need exact recovery |
| Kompress/CaveGemma providers | LLMLingua seam only | `CompressionProvider` registry defaults to local pass-through and classifies provider errors as `auth`, `rate-limit`, `timeout`, `request-too-large`, `unavailable`, `policy-denied` | `kompress-natural-language-field`, `cavegemma-protected-spans`, `gateway-provider-fail-open` | Future provider support without downloads |
| lean-ctx proof hashes | Hashes in artifact index only | `verifyContextProof` checks stored raw and compact artifacts, hashes, required facts, raw leakage, and recovery availability | `gateway-context-proof`, `gateway-v3-stored-proof` | Savings are not enough without retention and recovery proof |
| OpenCode DCP durable IDs | Request-local helper state | Session ids come from `x-utk-session-id`, metadata, or request hash; ledgers persist monotonic message/tool/block ids under `.utk/model-proxy/sessions` | `gateway-v3-durable-ledger` | Replacement/purge policies need stable handles |
| Serena progressive handles | Raw refs only | Compact handles carry artifact, route/schema, range, and snippet metadata; expand accepts `id`, `handle`, `range`, `query`, or `blockId` | `gateway-v3-progressive-handles` | Model-visible context can stay terse but recoverable |
| Prompt-compression tools | Naive prompt optimizer | `optimizePromptAsset` emits pipe-index, retrieval-led asset prompts | `prompt-compression-agent-context-index` | Shrinks AGENTS/Copilot/skill prompt surfaces |

Not shipped in v2:

- remote compressor calls by default;
- global prompt-history database;
- MCP server/tool explosion;
- editor extension or shell startup mutation;
- automatic mutation of canonical prompt files.
