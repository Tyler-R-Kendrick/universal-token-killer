# Compresr Parity Benchmark Results

Generated from `packages/evals/fixtures/compresrParityFixtures.ts`.

## Installation

- Installed package: `compresr@2.5.1`
- Install command: `python -m pip install --user compresr==2.5.1`
- API key env var: `COMPRESR_API_KEY`
- Live API mode: `disabled-without-api-key`
- Baseline mode: `deterministic-installed-sdk-model-baselines`

## Summary

- Scenarios: 39
- Passed Compresr/UTK thresholds: 39/39
- Average UTK/Compresr token ratio: 0.452
- Total estimated token savings vs Compresr baselines: 527
- Autoevals fact retention: 1.000 all scenarios
- Recoverability: 1.000 all scenarios

## Findings

- Compresr is strongest at remote query-aware compression, batch/streaming SDK calls, Context Gateway tool-output compression, history compaction, tool discovery, shadow refs, cost/format gating, and provider request adapters.
- UTK wins these fixtures by avoiding lossy remote rewrites in the model-visible response: it stores raw output, emits compact schema artifacts, and keeps project-local recovery handles.
- Live hosted compression requires `COMPRESR_API_KEY`; this suite verifies installed SDK/config metadata and uses deterministic baselines so CI does not send tool output to a remote service.

## Results

| Scenario | Category | Compresr Tokens | UTK Compact Tokens | Delta | Ratio | Facts | Autoevals | Recoverable |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| tool-output-large-json-gemfilter | Tool output compression | 30 | 11 | 19 | 0.367 | 1.000 | 1.000 | 1.000 |
| query-specific-markdown-latte | Query-specific compression | 25 | 5 | 20 | 0.200 | 1.000 | 1.000 | 1.000 |
| agnostic-doc-espresso | Question-agnostic compression | 25 | 5 | 20 | 0.200 | 1.000 | 1.000 | 1.000 |
| batch-mixed-contexts | Batch compression | 26 | 14 | 12 | 0.538 | 1.000 | 1.000 | 1.000 |
| streaming-compression-chunks | Streaming compression | 26 | 5 | 21 | 0.192 | 1.000 | 1.000 | 1.000 |
| history-compaction-threshold | History compaction | 32 | 6 | 26 | 0.188 | 1.000 | 1.000 | 1.000 |
| tool-discovery-required-tool | Tool discovery | 29 | 9 | 20 | 0.310 | 1.000 | 1.000 | 1.000 |
| tool-schema-compression-required-params | Tool schema compression | 24 | 10 | 14 | 0.417 | 1.000 | 1.000 | 1.000 |
| expand-context-shadow-ref | Expansion recovery | 23 | 5 | 18 | 0.217 | 1.000 | 1.000 | 1.000 |
| cost-aware-skip-cheap-model | Cost-aware gating | 28 | 17 | 11 | 0.607 | 1.000 | 1.000 | 1.000 |
| format-gate-unsupported-binary | Format gating | 20 | 5 | 15 | 0.250 | 1.000 | 1.000 | 1.000 |
| skip-tool-policy | Skip-tool policy | 20 | 13 | 7 | 0.650 | 1.000 | 1.000 | 1.000 |
| already-compressed-ref-bypass | Reference stability | 21 | 5 | 16 | 0.238 | 1.000 | 1.000 | 1.000 |
| structured-prefix-json | Structured prefix | 25 | 5 | 20 | 0.200 | 1.000 | 1.000 | 1.000 |
| structured-prefix-yaml | Structured prefix | 23 | 5 | 18 | 0.217 | 1.000 | 1.000 | 1.000 |
| placeholder-control-disabled | Placeholder policy | 19 | 5 | 14 | 0.263 | 1.000 | 1.000 | 1.000 |
| heuristic-chunking-boundary | Chunking | 24 | 6 | 18 | 0.250 | 1.000 | 1.000 | 1.000 |
| coarse-paragraph-mode | Coarse compression | 21 | 5 | 16 | 0.238 | 1.000 | 1.000 | 1.000 |
| tool-output-cache-hit | Cache reuse | 18 | 15 | 3 | 0.833 | 1.000 | 1.000 | 1.000 |
| shadow-ttl-expiry | Recovery TTL | 22 | 11 | 11 | 0.500 | 1.000 | 1.000 | 1.000 |
| telemetry-jsonl-savings | Telemetry | 24 | 21 | 3 | 0.875 | 1.000 | 1.000 | 1.000 |
| prompt-history-store | Prompt history | 21 | 11 | 10 | 0.524 | 1.000 | 1.000 | 1.000 |
| provider-adapter-openai-tool-call | Provider adapters | 22 | 7 | 15 | 0.318 | 1.000 | 1.000 | 1.000 |
| provider-adapter-anthropic-blocks | Provider adapters | 21 | 7 | 14 | 0.333 | 1.000 | 1.000 | 1.000 |
| task-subagent-output | Agent outputs | 24 | 5 | 19 | 0.208 | 1.000 | 1.000 | 1.000 |
| remote-api-key-missing-fail-open | Remote dependency | 25 | 15 | 10 | 0.600 | 1.000 | 1.000 | 1.000 |
| sdk-model-config | Installed SDK | 20 | 14 | 6 | 0.700 | 1.000 | 1.000 | 1.000 |
| on-prem-endpoint-config | Deployment config | 27 | 15 | 12 | 0.556 | 1.000 | 1.000 | 1.000 |
| vscode-markdown-backup | VS Code extension | 26 | 13 | 13 | 0.500 | 1.000 | 1.000 | 1.000 |
| tool-output-refusal-threshold | Savings threshold | 43 | 22 | 21 | 0.512 | 1.000 | 1.000 | 1.000 |
| tool-output-too-large-skip | Size gating | 24 | 18 | 6 | 0.750 | 1.000 | 1.000 | 1.000 |
| tool-output-too-small-skip | Size gating | 24 | 18 | 6 | 0.750 | 1.000 | 1.000 | 1.000 |
| tool-discovery-search-result-compression | Tool discovery | 29 | 10 | 19 | 0.345 | 1.000 | 1.000 | 1.000 |
| local-first-sensitive-code | Privacy | 25 | 15 | 10 | 0.600 | 1.000 | 1.000 | 1.000 |
| kv-cache-preservation | Cache stability | 27 | 17 | 10 | 0.630 | 1.000 | 1.000 | 1.000 |
| allowed-forbidden-format-policy | Format policy | 25 | 23 | 2 | 0.920 | 1.000 | 1.000 | 1.000 |
| agentic-tool-output-lingua | Agentic models | 22 | 11 | 11 | 0.500 | 1.000 | 1.000 | 1.000 |
| agentic-history-lingua | Agentic models | 26 | 15 | 11 | 0.577 | 1.000 | 1.000 | 1.000 |
| agentic-tool-discovery-sat | Agentic models | 22 | 12 | 10 | 0.545 | 1.000 | 1.000 | 1.000 |

## Scenario Notes

### tool-output-large-json-gemfilter

- Use case: Compress large JSON tool output while retaining route and failed event.
- Test strategy: Compresr tool-output gemfilter baseline vs UTK raw-artifact JSONPath recovery.
- Compresr good at: Compresr agentic tool-output models target large provider tool results.
- UTK attempt: Persist full JSON under .utk and expose compact object-key artifact.
- Result: pass

### query-specific-markdown-latte

- Use case: Compress Markdown context for a question while preserving answer paragraph.
- Test strategy: Latte query-specific Markdown retention against UTK compact text artifact.
- Compresr good at: Compresr latte_v1 keeps content relevant to supplied query.
- UTK attempt: Store full Markdown locally and keep model-visible artifact handle.
- Result: pass

### agnostic-doc-espresso

- Use case: Compress documentation without query while retaining headline and warning.
- Test strategy: Espresso agnostic compression baseline vs UTK durable text artifact.
- Compresr good at: Compresr espresso_v1 compresses without needing a query.
- UTK attempt: No semantic drop in chat; raw doc stays recoverable from artifact.
- Result: pass

### batch-mixed-contexts

- Use case: Compress multiple contexts in one batch while preserving per-item facts.
- Test strategy: Batch result aggregate retention with per-item JSONPath facts.
- Compresr good at: Compresr SDK supports batch compression with shared model settings.
- UTK attempt: Mediate batch-like result as structured object with raw recovery.
- Result: pass

### streaming-compression-chunks

- Use case: Compress streaming chunks while retaining done marker and final content.
- Test strategy: Streaming chunk completion retention against UTK raw stream text.
- Compresr good at: Compresr SDK exposes streaming compression chunks.
- UTK attempt: Persist observed stream output and compact the stream envelope.
- Result: pass

### history-compaction-threshold

- Use case: Compact long history only near threshold while preserving reserve budget.
- Test strategy: History threshold/reserve literal retention versus UTK session-block artifact.
- Compresr good at: Context Gateway precomputes summaries near context-limit thresholds.
- UTK attempt: Represent old history as durable local block with artifact id and budget facts.
- Result: pass

### tool-discovery-required-tool

- Use case: Filter large tool catalog while keeping required PR review tool.
- Test strategy: Tool-discovery JSONPath retention for selected required tool.
- Compresr good at: Compresr Context Gateway can filter/defer large tool catalogs.
- UTK attempt: Persist catalog and expose deterministic required-tool recovery handles.
- Result: pass

### tool-schema-compression-required-params

- Use case: Compress verbose tool schema while preserving required params.
- Test strategy: Schema required-param JSONPath retention against compact object artifact.
- Compresr good at: Compresr compresses requested tool schemas after discovery.
- UTK attempt: Use schema-aware serialization and raw catalog recovery.
- Result: pass

### expand-context-shadow-ref

- Use case: Recover full compressed content through an expand-context reference.
- Test strategy: Shadow-ref and expansion id retention with durable UTK artifact handles.
- Compresr good at: Compresr injects expand_context to recover shadow-ref originals.
- UTK attempt: Use project-local raw artifact path instead of TTL-only shadow store.
- Result: pass

### cost-aware-skip-cheap-model

- Use case: Skip expensive compression when target model is cheap.
- Test strategy: Cost-tier bypass reason retention with local artifact preservation.
- Compresr good at: Compresr checks model cost tier before compressing tool output.
- UTK attempt: Record skip reason and preserve raw output without remote call.
- Result: pass

### format-gate-unsupported-binary

- Use case: Avoid semantic compression for unsupported binary output.
- Test strategy: Unsupported-format skip retention with binary envelope recovery.
- Compresr good at: Compresr gates compression by allowed content formats.
- UTK attempt: Persist binary envelope locally and avoid model-visible bytes.
- Result: pass

### skip-tool-policy

- Use case: Respect configured skip_tools for security-sensitive tool output.
- Test strategy: Skip-tool mapping retention with protected raw artifact.
- Compresr good at: Context Gateway supports per-tool skip policies.
- UTK attempt: Use per-tool serializer/config policy and raw local recovery.
- Result: pass

### already-compressed-ref-bypass

- Use case: Avoid recompressing content that already contains a shadow reference.
- Test strategy: Already-compressed REF bypass retention with stable compact artifact.
- Compresr good at: Compresr skips outputs already prefixed with shadow refs.
- UTK attempt: Keep deterministic compact artifact fingerprint and no duplicate block.
- Result: pass

### structured-prefix-json

- Use case: Preserve JSON prefix while compressing trailing explanatory text.
- Test strategy: Structured-prefix JSON literal retention with local raw artifact.
- Compresr good at: Compresr structured prefix detector preserves initial JSON/YAML/XML boundaries.
- UTK attempt: Prefer schema serialization over prefix-only preservation.
- Result: pass

### structured-prefix-yaml

- Use case: Preserve YAML prefix with tool route metadata.
- Test strategy: Structured-prefix YAML literal retention with schema-backed UTK artifact.
- Compresr good at: Compresr prefix detector recognizes YAML before compressing prose.
- UTK attempt: Store YAML raw and expose text envelope plus schema route.
- Result: pass

### placeholder-control-disabled

- Use case: Disable placeholders so required terms remain explicit.
- Test strategy: Placeholder suppression retention with literal protected terms.
- Compresr good at: Compresr supports disable_placeholders for query-specific compression.
- UTK attempt: Use protected spans and raw artifact recovery instead of placeholders.
- Result: pass

### heuristic-chunking-boundary

- Use case: Chunk long text without splitting exact error string.
- Test strategy: Heuristic chunk boundary retention around exact error.
- Compresr good at: Compresr latte_v1 can use heuristic chunking.
- UTK attempt: Avoid semantic chunk damage by keeping raw artifact and protected exact error.
- Result: pass

### coarse-paragraph-mode

- Use case: Coarse paragraph mode keeps whole selected paragraph.
- Test strategy: Coarse-mode paragraph retention for selected policy block.
- Compresr good at: Compresr supports coarse mode for paragraph-level retention.
- UTK attempt: Keep full source in artifact and compact the document shape.
- Result: pass

### tool-output-cache-hit

- Use case: Reuse compressed output for identical content hash.
- Test strategy: Cache-hit hash retention with deterministic UTK compact fingerprint.
- Compresr good at: Compresr caches compressed tool outputs by content hash.
- UTK attempt: Use stable content hash and project-local artifact path.
- Result: pass

### shadow-ttl-expiry

- Use case: Handle expired shadow reference while preserving durable artifact path.
- Test strategy: TTL expiry retention against UTK durable recovery path.
- Compresr good at: Compresr originals live in TTL shadow store.
- UTK attempt: Prefer durable .utk raw artifact path over TTL-only recovery.
- Result: pass

### telemetry-jsonl-savings

- Use case: Record compression savings in JSONL telemetry.
- Test strategy: Telemetry token-savings JSONPath retention.
- Compresr good at: Context Gateway writes compression telemetry JSONL.
- UTK attempt: Report raw/compact tokens in deterministic eval report and artifacts.
- Result: pass

### prompt-history-store

- Use case: Compress prompt history index while preserving session and model filters.
- Test strategy: Prompt-history FTS metadata retention.
- Compresr good at: Compresr Context Gateway stores prompt history in SQLite with filters.
- UTK attempt: Avoid global prompt capture by default; use project-local session artifacts.
- Result: pass

### provider-adapter-openai-tool-call

- Use case: Extract OpenAI tool call output from provider request shape.
- Test strategy: OpenAI adapter tool_call_id JSONPath retention.
- Compresr good at: Context Gateway has provider adapters for OpenAI request formats.
- UTK attempt: Mediate Copilot tool events directly instead of proxy request patching.
- Result: pass

### provider-adapter-anthropic-blocks

- Use case: Extract Anthropic tool_result blocks while preserving tool_use_id.
- Test strategy: Anthropic block tool_use_id JSONPath retention.
- Compresr good at: Context Gateway supports Anthropic native content blocks.
- UTK attempt: Keep provider-independent tool event artifact contract.
- Result: pass

### task-subagent-output

- Use case: Compress subagent task output while retaining task id and final blocker.
- Test strategy: Subagent output task/blocker retention.
- Compresr good at: Context Gateway handles task and subagent output compression.
- UTK attempt: Store subagent output as local artifact with compact handle.
- Result: pass

### remote-api-key-missing-fail-open

- Use case: Fail open when Compresr API key is missing.
- Test strategy: Missing API key fail-open retention with no remote data send.
- Compresr good at: Compresr SDK requires API key for hosted compression.
- UTK attempt: Default to deterministic local artifacts; never require remote key for core path.
- Result: pass

### sdk-model-config

- Use case: Verify installed Compresr SDK models used by benchmark configuration.
- Test strategy: Installed SDK model-id retention from local config.
- Compresr good at: Compresr SDK exposes named model ids and endpoint routing.
- UTK attempt: Pin installed model metadata into deterministic benchmark config.
- Result: pass

### on-prem-endpoint-config

- Use case: Configure alternate base URL for on-prem Compresr without changing artifact policy.
- Test strategy: Base URL and local-artifact policy retention.
- Compresr good at: Compresr supports custom base URLs for private/on-prem deployments.
- UTK attempt: Treat remote endpoint as optional provider; core artifacts remain local.
- Result: pass

### vscode-markdown-backup

- Use case: Compress Markdown file with backup and preview workflow.
- Test strategy: Backup/preview retention from VS Code extension behavior.
- Compresr good at: Compresr VS Code extension previews Markdown compression and creates backups.
- UTK attempt: For repo work, prefer benchmark artifacts and no automatic file rewrite.
- Result: pass

### tool-output-refusal-threshold

- Use case: Reject compression when savings do not clear refusal threshold.
- Test strategy: Refusal-threshold rejection retention with artifact recovery.
- Compresr good at: Context Gateway rejects compression if savings are insufficient.
- UTK attempt: Expose threshold failure and keep raw/compact artifacts recoverable.
- Result: pass

### tool-output-too-large-skip

- Use case: Skip too-large output while preserving reason and byte count.
- Test strategy: Too-large skip metadata retention.
- Compresr good at: Context Gateway skips outputs beyond configured maximum size.
- UTK attempt: Persist raw artifact and route to durable recovery path.
- Result: pass

### tool-output-too-small-skip

- Use case: Skip too-small output where compression overhead is wasteful.
- Test strategy: Too-small skip metadata retention.
- Compresr good at: Context Gateway skips tiny outputs below compression threshold.
- UTK attempt: Still store raw artifact and produce compact response consistently.
- Result: pass

### tool-discovery-search-result-compression

- Use case: Compress tool-search results while preserving selected tool names.
- Test strategy: Tool-search selected names JSONPath retention.
- Compresr good at: Compresr can compress tool-discovery search results.
- UTK attempt: Keep local catalog artifact and selected tool names deterministic.
- Result: pass

### local-first-sensitive-code

- Use case: Avoid sending sensitive source code to hosted compressor.
- Test strategy: Local-first privacy decision retention with exact path.
- Compresr good at: Compresr hosted API can compress code only if user sends it remotely.
- UTK attempt: Keep sensitive code local and rely on artifacts/schema summaries.
- Result: pass

### kv-cache-preservation

- Use case: Preserve stable compressed output across turns for KV-cache reuse.
- Test strategy: Stable fingerprint and turn reuse retention.
- Compresr good at: Compresr keeps compressed outputs stable for cache preservation.
- UTK attempt: Use deterministic artifact paths and content hashes for stable compact responses.
- Result: pass

### allowed-forbidden-format-policy

- Use case: Apply allowed and forbidden format lists to tool output.
- Test strategy: Allowed/forbidden format policy JSONPath retention.
- Compresr good at: Context Gateway config supports allowed and forbidden content formats.
- UTK attempt: Expose equivalent per-tool content policy while keeping protected spans.
- Result: pass

### agentic-tool-output-lingua

- Use case: Compare agentic_tool_output_lingua against UTK compact artifact.
- Test strategy: Agentic model id and protected diagnostic retention.
- Compresr good at: Compresr exposes agentic_tool_output_lingua model id for tool outputs.
- UTK attempt: Use deterministic serialization and protected diagnostics instead of remote model.
- Result: pass

### agentic-history-lingua

- Use case: Compare agentic_history_lingua history compression with UTK blocks.
- Test strategy: Agentic history model and block id retention.
- Compresr good at: Compresr exposes agentic_history_lingua for history summaries.
- UTK attempt: Replace old spans with recoverable local history blocks.
- Result: pass

### agentic-tool-discovery-sat

- Use case: Compare agentic_tool_discovery_sat tool selection with UTK catalog.
- Test strategy: Agentic discovery model and selected tool retention.
- Compresr good at: Compresr exposes agentic_tool_discovery_sat for tool discovery.
- UTK attempt: Persist catalog and deterministic selection evidence.
- Result: pass

