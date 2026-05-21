import { estimateTokens } from '../assertions/tokenBudgets.js';
import { COMPRESR_INSTALL_CONFIG } from '../config/compresrConfig.js';

export type CompresrRequiredFact =
  | { kind: 'literal'; value: string }
  | { kind: 'jsonPath'; path: string; expected: unknown };

export type CompresrParityFixture = {
  name: string;
  category: string;
  useCase: string;
  testStrategy: string;
  compresrStrength: string;
  utkApproach: string;
  toolId: string;
  input: unknown;
  rawOutput: unknown;
  requiredFacts: CompresrRequiredFact[];
  compresrBaselineText: string;
  compresrBaselineTokens: number;
  minFactScore: number;
};

function fixture(params: Omit<CompresrParityFixture, 'compresrBaselineTokens' | 'minFactScore'> & Partial<Pick<CompresrParityFixture, 'minFactScore'>>): CompresrParityFixture {
  return {
    minFactScore: 1,
    ...params,
    compresrBaselineTokens: estimateTokens(params.compresrBaselineText)
  };
}

const repeatedHistory = Array.from({ length: 30 }, (_, index) => `turn=${index} user asked about artifact ${index % 5}; assistant answered with route=shell.git.diff.v1 confidence=0.95`).join('\n');
const toolCatalog = Array.from({ length: 22 }, (_, index) => ({
  name: index === 7 ? 'github.pull_request.review_comments' : `tool.generated.${index}`,
  description: index === 7 ? 'List unresolved pull request review comments with path, line, body, and author.' : `Generated helper tool ${index}`,
  input_schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, limit: { type: 'integer' } } }
}));

export const COMPRESR_PARITY_FIXTURES: CompresrParityFixture[] = [
  fixture({
    name: 'tool-output-large-json-gemfilter',
    category: 'Tool output compression',
    useCase: 'Compress large JSON tool output while retaining route and failed event.',
    testStrategy: 'Compresr tool-output gemfilter baseline vs UTK raw-artifact JSONPath recovery.',
    compresrStrength: 'Compresr agentic tool-output models target large provider tool results.',
    utkApproach: 'Persist full JSON under .utk and expose compact object-key artifact.',
    toolId: 'compresr.tool.large-json',
    input: { model: 'agentic_tool_output_gemfilter' },
    rawOutput: {
      route: 'tool-output',
      events: Array.from({ length: 24 }, (_, index) => ({ id: `evt-${index}`, status: index === 23 ? 'failed' : 'ok', artifactId: `art-${index}` })),
      queryIntent: 'find failed event'
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.route', expected: 'tool-output' },
      { kind: 'jsonPath', path: '$.events[23].status', expected: 'failed' }
    ],
    compresrBaselineText: 'Compresr gemfilter keeps query-relevant failed event, route=tool-output, event evt-23 failed, shadow ref for full JSON.'
  }),
  fixture({
    name: 'query-specific-markdown-latte',
    category: 'Query-specific compression',
    useCase: 'Compress Markdown context for a question while preserving answer paragraph.',
    testStrategy: 'Latte query-specific Markdown retention against UTK compact text artifact.',
    compresrStrength: 'Compresr latte_v1 keeps content relevant to supplied query.',
    utkApproach: 'Store full Markdown locally and keep model-visible artifact handle.',
    toolId: 'compresr.query.markdown',
    input: { query: 'What migration is irreversible?', model: 'latte_v1' },
    rawOutput: [
      '# Migration Runbook',
      'Backup first.',
      'Dropping legacy_events.payload is irreversible after deploy 2026.05.20.4.',
      'Rollback requires restoring the snapshot.'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'Dropping legacy_events.payload is irreversible' },
      { kind: 'literal', value: 'deploy 2026.05.20.4' }
    ],
    compresrBaselineText: 'Compresr latte keeps irreversible migration paragraph for query, with shadow ref to full Markdown.'
  }),
  fixture({
    name: 'agnostic-doc-espresso',
    category: 'Question-agnostic compression',
    useCase: 'Compress documentation without query while retaining headline and warning.',
    testStrategy: 'Espresso agnostic compression baseline vs UTK durable text artifact.',
    compresrStrength: 'Compresr espresso_v1 compresses without needing a query.',
    utkApproach: 'No semantic drop in chat; raw doc stays recoverable from artifact.',
    toolId: 'compresr.agnostic.doc',
    input: { model: 'espresso_v1' },
    rawOutput: '## Production Signing Key\nWarning: rotating the key invalidates all active sessions. Confirm rollback plan before applying.',
    requiredFacts: [
      { kind: 'literal', value: 'Production Signing Key' },
      { kind: 'literal', value: 'invalidates all active sessions' }
    ],
    compresrBaselineText: 'Compresr espresso keeps heading and warning, strips explanatory filler, returns compressed doc text.'
  }),
  fixture({
    name: 'batch-mixed-contexts',
    category: 'Batch compression',
    useCase: 'Compress multiple contexts in one batch while preserving per-item facts.',
    testStrategy: 'Batch result aggregate retention with per-item JSONPath facts.',
    compresrStrength: 'Compresr SDK supports batch compression with shared model settings.',
    utkApproach: 'Mediate batch-like result as structured object with raw recovery.',
    toolId: 'compresr.batch.contexts',
    input: { endpoint: '/api/compress/question-specific/batch' },
    rawOutput: {
      results: [
        { id: 'doc-a', compressed: 'route summary', tokens_saved: 1200 },
        { id: 'doc-b', compressed: 'tool output summary', tokens_saved: 2400 }
      ],
      average_compression_ratio: 0.31
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.results[1].id', expected: 'doc-b' },
      { kind: 'jsonPath', path: '$.average_compression_ratio', expected: 0.31 }
    ],
    compresrBaselineText: 'Compresr batch response preserves doc-b result, average ratio 0.31, total token savings across contexts.'
  }),
  fixture({
    name: 'streaming-compression-chunks',
    category: 'Streaming compression',
    useCase: 'Compress streaming chunks while retaining done marker and final content.',
    testStrategy: 'Streaming chunk completion retention against UTK raw stream text.',
    compresrStrength: 'Compresr SDK exposes streaming compression chunks.',
    utkApproach: 'Persist observed stream output and compact the stream envelope.',
    toolId: 'compresr.stream.chunks',
    input: { stream: true },
    rawOutput: [
      'chunk: route summary',
      'chunk: failed shard windows-node20',
      'chunk: done=true'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'failed shard windows-node20' },
      { kind: 'literal', value: 'done=true' }
    ],
    compresrBaselineText: 'Compresr stream emits compressed chunks, including failed shard windows-node20 and final done marker.'
  }),
  fixture({
    name: 'history-compaction-threshold',
    category: 'History compaction',
    useCase: 'Compact long history only near threshold while preserving reserve budget.',
    testStrategy: 'History threshold/reserve literal retention versus UTK session-block artifact.',
    compresrStrength: 'Context Gateway precomputes summaries near context-limit thresholds.',
    utkApproach: 'Represent old history as durable local block with artifact id and budget facts.',
    toolId: 'compresr.history.threshold',
    input: { threshold: 0.75 },
    rawOutput: `${repeatedHistory}\nthreshold=75%; reserve_output_tokens=4096; summary_id=hist-20260520`,
    requiredFacts: [
      { kind: 'literal', value: 'threshold=75%' },
      { kind: 'literal', value: 'reserve_output_tokens=4096' }
    ],
    compresrBaselineText: 'Compresr history compaction triggers at 75 percent context, keeps 4096 output-token reserve, stores history summary reference.'
  }),
  fixture({
    name: 'tool-discovery-required-tool',
    category: 'Tool discovery',
    useCase: 'Filter large tool catalog while keeping required PR review tool.',
    testStrategy: 'Tool-discovery JSONPath retention for selected required tool.',
    compresrStrength: 'Compresr Context Gateway can filter/defer large tool catalogs.',
    utkApproach: 'Persist catalog and expose deterministic required-tool recovery handles.',
    toolId: 'compresr.tool.discovery',
    input: { query: 'review comments' },
    rawOutput: { tools: toolCatalog, selected: ['github.pull_request.review_comments'] },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.tools[7].name', expected: 'github.pull_request.review_comments' },
      { kind: 'jsonPath', path: '$.selected[0]', expected: 'github.pull_request.review_comments' }
    ],
    compresrBaselineText: 'Compresr tool discovery keeps github.pull_request.review_comments and defers unrelated tool schemas behind search.'
  }),
  fixture({
    name: 'tool-schema-compression-required-params',
    category: 'Tool schema compression',
    useCase: 'Compress verbose tool schema while preserving required params.',
    testStrategy: 'Schema required-param JSONPath retention against compact object artifact.',
    compresrStrength: 'Compresr compresses requested tool schemas after discovery.',
    utkApproach: 'Use schema-aware serialization and raw catalog recovery.',
    toolId: 'compresr.tool.schema',
    input: { tool: 'github.pull_request.review_comments' },
    rawOutput: {
      name: 'github.pull_request.review_comments',
      input_schema: {
        type: 'object',
        required: ['owner', 'repo', 'pull_number'],
        properties: { owner: { type: 'string' }, repo: { type: 'string' }, pull_number: { type: 'integer' } }
      }
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.input_schema.required[2]', expected: 'pull_number' },
      { kind: 'jsonPath', path: '$.name', expected: 'github.pull_request.review_comments' }
    ],
    compresrBaselineText: 'Compresr schema compression keeps tool name and required owner, repo, pull_number parameters.'
  }),
  fixture({
    name: 'expand-context-shadow-ref',
    category: 'Expansion recovery',
    useCase: 'Recover full compressed content through an expand-context reference.',
    testStrategy: 'Shadow-ref and expansion id retention with durable UTK artifact handles.',
    compresrStrength: 'Compresr injects expand_context to recover shadow-ref originals.',
    utkApproach: 'Use project-local raw artifact path instead of TTL-only shadow store.',
    toolId: 'compresr.expand.context',
    input: { ref: 'ctx_9ab3' },
    rawOutput: 'Compressed block [REF:ctx_9ab3] maps to original tool output artifact raw-output-77 and query "failed tests".',
    requiredFacts: [
      { kind: 'literal', value: '[REF:ctx_9ab3]' },
      { kind: 'literal', value: 'raw-output-77' }
    ],
    compresrBaselineText: 'Compresr compressed block uses [REF:ctx_9ab3] and expand_context to recover raw-output-77.'
  }),
  fixture({
    name: 'cost-aware-skip-cheap-model',
    category: 'Cost-aware gating',
    useCase: 'Skip expensive compression when target model is cheap.',
    testStrategy: 'Cost-tier bypass reason retention with local artifact preservation.',
    compresrStrength: 'Compresr checks model cost tier before compressing tool output.',
    utkApproach: 'Record skip reason and preserve raw output without remote call.',
    toolId: 'compresr.cost.skip',
    input: { targetModel: 'cheap-mini' },
    rawOutput: { decision: 'skip', reason: 'cheap-model', bypass_cost_check: false, rawArtifact: 'output.raw.json' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.decision', expected: 'skip' },
      { kind: 'jsonPath', path: '$.reason', expected: 'cheap-model' }
    ],
    compresrBaselineText: 'Compresr skips compression for cheap-model target unless bypass_cost_check is enabled, with skip metrics logged.'
  }),
  fixture({
    name: 'format-gate-unsupported-binary',
    category: 'Format gating',
    useCase: 'Avoid semantic compression for unsupported binary output.',
    testStrategy: 'Unsupported-format skip retention with binary envelope recovery.',
    compresrStrength: 'Compresr gates compression by allowed content formats.',
    utkApproach: 'Persist binary envelope locally and avoid model-visible bytes.',
    toolId: 'compresr.format.binary',
    input: { format: 'binary' },
    rawOutput: 'format=binary; magic=89504e47; compression=skipped; raw_artifact=output.raw.bin',
    requiredFacts: [
      { kind: 'literal', value: 'format=binary' },
      { kind: 'literal', value: 'compression=skipped' }
    ],
    compresrBaselineText: 'Compresr skips unsupported binary formats and records format=binary skip reason.'
  }),
  fixture({
    name: 'skip-tool-policy',
    category: 'Skip-tool policy',
    useCase: 'Respect configured skip_tools for security-sensitive tool output.',
    testStrategy: 'Skip-tool mapping retention with protected raw artifact.',
    compresrStrength: 'Context Gateway supports per-tool skip policies.',
    utkApproach: 'Use per-tool serializer/config policy and raw local recovery.',
    toolId: 'compresr.skip.tool',
    input: { skip_tools: ['secrets.dump'] },
    rawOutput: { tool: 'secrets.dump', mapping_status: 'skipped_by_policy', rawArtifact: 'output.raw.json' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.tool', expected: 'secrets.dump' },
      { kind: 'jsonPath', path: '$.mapping_status', expected: 'skipped_by_policy' }
    ],
    compresrBaselineText: 'Compresr skip_tools marks secrets.dump skipped_by_policy and avoids compression.'
  }),
  fixture({
    name: 'already-compressed-ref-bypass',
    category: 'Reference stability',
    useCase: 'Avoid recompressing content that already contains a shadow reference.',
    testStrategy: 'Already-compressed REF bypass retention with stable compact artifact.',
    compresrStrength: 'Compresr skips outputs already prefixed with shadow refs.',
    utkApproach: 'Keep deterministic compact artifact fingerprint and no duplicate block.',
    toolId: 'compresr.ref.bypass',
    input: { content: '[REF:abc123]' },
    rawOutput: 'already_compressed=true; content=[REF:abc123]; cache_status=skip',
    requiredFacts: [
      { kind: 'literal', value: 'already_compressed=true' },
      { kind: 'literal', value: '[REF:abc123]' }
    ],
    compresrBaselineText: 'Compresr detects [REF:abc123] as already compressed and skips duplicate compression.'
  }),
  fixture({
    name: 'structured-prefix-json',
    category: 'Structured prefix',
    useCase: 'Preserve JSON prefix while compressing trailing explanatory text.',
    testStrategy: 'Structured-prefix JSON literal retention with local raw artifact.',
    compresrStrength: 'Compresr structured prefix detector preserves initial JSON/YAML/XML boundaries.',
    utkApproach: 'Prefer schema serialization over prefix-only preservation.',
    toolId: 'compresr.prefix.json',
    input: { detector: 'json' },
    rawOutput: '{"status":"failed","runId":"run-77"}\nLong explanation: retry window expired after cache refresh and route fallback.',
    requiredFacts: [
      { kind: 'literal', value: '"status":"failed"' },
      { kind: 'literal', value: '"runId":"run-77"' }
    ],
    compresrBaselineText: 'Compresr preserves JSON prefix with status failed and runId run-77, compresses trailing explanation.'
  }),
  fixture({
    name: 'structured-prefix-yaml',
    category: 'Structured prefix',
    useCase: 'Preserve YAML prefix with tool route metadata.',
    testStrategy: 'Structured-prefix YAML literal retention with schema-backed UTK artifact.',
    compresrStrength: 'Compresr prefix detector recognizes YAML before compressing prose.',
    utkApproach: 'Store YAML raw and expose text envelope plus schema route.',
    toolId: 'compresr.prefix.yaml',
    input: { detector: 'yaml' },
    rawOutput: 'route: shell.git.diff\nconfidence: 0.95\nartifact: output.raw.txt\nnotes: repeated explanation follows here',
    requiredFacts: [
      { kind: 'literal', value: 'route: shell.git.diff' },
      { kind: 'literal', value: 'confidence: 0.95' }
    ],
    compresrBaselineText: 'Compresr preserves YAML route shell.git.diff and confidence 0.95 before compressing notes.'
  }),
  fixture({
    name: 'placeholder-control-disabled',
    category: 'Placeholder policy',
    useCase: 'Disable placeholders so required terms remain explicit.',
    testStrategy: 'Placeholder suppression retention with literal protected terms.',
    compresrStrength: 'Compresr supports disable_placeholders for query-specific compression.',
    utkApproach: 'Use protected spans and raw artifact recovery instead of placeholders.',
    toolId: 'compresr.placeholders.disabled',
    input: { disable_placeholders: true },
    rawOutput: 'disable_placeholders=true; keep OPENAI_API_KEY=[REDACTED] and C:\\src\\utk\\.env.local explicit.',
    requiredFacts: [
      { kind: 'literal', value: 'disable_placeholders=true' },
      { kind: 'literal', value: 'OPENAI_API_KEY=[REDACTED]' }
    ],
    compresrBaselineText: 'Compresr disable_placeholders keeps redacted API key and env path explicit.'
  }),
  fixture({
    name: 'heuristic-chunking-boundary',
    category: 'Chunking',
    useCase: 'Chunk long text without splitting exact error string.',
    testStrategy: 'Heuristic chunk boundary retention around exact error.',
    compresrStrength: 'Compresr latte_v1 can use heuristic chunking.',
    utkApproach: 'Avoid semantic chunk damage by keeping raw artifact and protected exact error.',
    toolId: 'compresr.chunking.heuristic',
    input: { heuristic_chunking: true },
    rawOutput: Array.from({ length: 12 }, (_, index) => index === 6 ? 'paragraph 6: ERROR Cannot read directory "../../../../..": Access is denied.' : `paragraph ${index}: background detail`).join('\n\n'),
    requiredFacts: [
      { kind: 'literal', value: 'Cannot read directory "../../../../..": Access is denied.' },
      { kind: 'literal', value: 'paragraph 6' }
    ],
    compresrBaselineText: 'Compresr heuristic chunking keeps exact Access is denied error and relevant paragraph boundary.'
  }),
  fixture({
    name: 'coarse-paragraph-mode',
    category: 'Coarse compression',
    useCase: 'Coarse paragraph mode keeps whole selected paragraph.',
    testStrategy: 'Coarse-mode paragraph retention for selected policy block.',
    compresrStrength: 'Compresr supports coarse mode for paragraph-level retention.',
    utkApproach: 'Keep full source in artifact and compact the document shape.',
    toolId: 'compresr.coarse.paragraph',
    input: { coarse: true },
    rawOutput: [
      'Paragraph A: setup.',
      'Paragraph B: privacy rule allows PII for at most 30 days in EU regions, then delete records.',
      'Paragraph C: unrelated migration notes.'
    ].join('\n\n'),
    requiredFacts: [
      { kind: 'literal', value: 'PII for at most 30 days' },
      { kind: 'literal', value: 'EU regions' }
    ],
    compresrBaselineText: 'Compresr coarse mode retains whole privacy paragraph with 30-day EU PII retention.'
  }),
  fixture({
    name: 'tool-output-cache-hit',
    category: 'Cache reuse',
    useCase: 'Reuse compressed output for identical content hash.',
    testStrategy: 'Cache-hit hash retention with deterministic UTK compact fingerprint.',
    compresrStrength: 'Compresr caches compressed tool outputs by content hash.',
    utkApproach: 'Use stable content hash and project-local artifact path.',
    toolId: 'compresr.cache.hit',
    input: { content_hash: 'sha256:abc123' },
    rawOutput: { content_hash: 'sha256:abc123', cache_status: 'hit', compressed_ref: 'cmp-cache-77' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.cache_status', expected: 'hit' },
      { kind: 'jsonPath', path: '$.compressed_ref', expected: 'cmp-cache-77' }
    ],
    compresrBaselineText: 'Compresr cache hit for sha256 abc123 reuses compressed ref cmp-cache-77.'
  }),
  fixture({
    name: 'shadow-ttl-expiry',
    category: 'Recovery TTL',
    useCase: 'Handle expired shadow reference while preserving durable artifact path.',
    testStrategy: 'TTL expiry retention against UTK durable recovery path.',
    compresrStrength: 'Compresr originals live in TTL shadow store.',
    utkApproach: 'Prefer durable .utk raw artifact path over TTL-only recovery.',
    toolId: 'compresr.shadow.ttl',
    input: { ref: 'ctx_expired' },
    rawOutput: { ref: 'ctx_expired', ttl_state: 'expired', fallback: '.utk/tools/shell.rg/observations/run-1/output.raw.txt' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.ttl_state', expected: 'expired' },
      { kind: 'jsonPath', path: '$.fallback', expected: '.utk/tools/shell.rg/observations/run-1/output.raw.txt' }
    ],
    compresrBaselineText: 'Compresr shadow ref ctx_expired can expire; UTK fallback artifact path remains durable.'
  }),
  fixture({
    name: 'telemetry-jsonl-savings',
    category: 'Telemetry',
    useCase: 'Record compression savings in JSONL telemetry.',
    testStrategy: 'Telemetry token-savings JSONPath retention.',
    compresrStrength: 'Context Gateway writes compression telemetry JSONL.',
    utkApproach: 'Report raw/compact tokens in deterministic eval report and artifacts.',
    toolId: 'compresr.telemetry',
    input: { log: 'tool_output_compression.jsonl' },
    rawOutput: { timestamp: '2026-05-20T22:30:00Z', original_tokens: 8200, compressed_tokens: 1100, tokens_saved: 7100, tool: 'shell.rg' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.tokens_saved', expected: 7100 },
      { kind: 'jsonPath', path: '$.tool', expected: 'shell.rg' }
    ],
    compresrBaselineText: 'Compresr telemetry logs original 8200 tokens, compressed 1100 tokens, 7100 saved for shell.rg.'
  }),
  fixture({
    name: 'prompt-history-store',
    category: 'Prompt history',
    useCase: 'Compress prompt history index while preserving session and model filters.',
    testStrategy: 'Prompt-history FTS metadata retention.',
    compresrStrength: 'Compresr Context Gateway stores prompt history in SQLite with filters.',
    utkApproach: 'Avoid global prompt capture by default; use project-local session artifacts.',
    toolId: 'compresr.prompt.history',
    input: { store: 'prompt_history.db' },
    rawOutput: { db: '~/.config/context-gateway/prompt_history.db', fts: true, filters: ['session', 'model', 'provider'], session: 'sess-123' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.fts', expected: true },
      { kind: 'jsonPath', path: '$.session', expected: 'sess-123' }
    ],
    compresrBaselineText: 'Compresr prompt history store supports FTS and filters by session, model, provider.'
  }),
  fixture({
    name: 'provider-adapter-openai-tool-call',
    category: 'Provider adapters',
    useCase: 'Extract OpenAI tool call output from provider request shape.',
    testStrategy: 'OpenAI adapter tool_call_id JSONPath retention.',
    compresrStrength: 'Context Gateway has provider adapters for OpenAI request formats.',
    utkApproach: 'Mediate Copilot tool events directly instead of proxy request patching.',
    toolId: 'compresr.adapter.openai',
    input: { provider: 'openai' },
    rawOutput: { messages: [{ role: 'tool', tool_call_id: 'call_123', content: '{"status":"failed","shard":"win"}' }] },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.messages[0].tool_call_id', expected: 'call_123' },
      { kind: 'jsonPath', path: '$.messages[0].role', expected: 'tool' }
    ],
    compresrBaselineText: 'Compresr OpenAI adapter extracts tool_call_id call_123 and compresses tool-role content.'
  }),
  fixture({
    name: 'provider-adapter-anthropic-blocks',
    category: 'Provider adapters',
    useCase: 'Extract Anthropic tool_result blocks while preserving tool_use_id.',
    testStrategy: 'Anthropic block tool_use_id JSONPath retention.',
    compresrStrength: 'Context Gateway supports Anthropic native content blocks.',
    utkApproach: 'Keep provider-independent tool event artifact contract.',
    toolId: 'compresr.adapter.anthropic',
    input: { provider: 'anthropic' },
    rawOutput: { content: [{ type: 'tool_result', tool_use_id: 'toolu_456', content: 'pytest failed on windows-node20' }] },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.content[0].type', expected: 'tool_result' },
      { kind: 'jsonPath', path: '$.content[0].tool_use_id', expected: 'toolu_456' }
    ],
    compresrBaselineText: 'Compresr Anthropic adapter extracts tool_result block with tool_use_id toolu_456.'
  }),
  fixture({
    name: 'task-subagent-output',
    category: 'Agent outputs',
    useCase: 'Compress subagent task output while retaining task id and final blocker.',
    testStrategy: 'Subagent output task/blocker retention.',
    compresrStrength: 'Context Gateway handles task and subagent output compression.',
    utkApproach: 'Store subagent output as local artifact with compact handle.',
    toolId: 'compresr.task.output',
    input: { task: 'worker-1' },
    rawOutput: 'task_id=worker-1\nstatus=blocked\nblocker=missing COMPRESR_API_KEY\nchanged_files=packages/evals/fixtures/compresrParityFixtures.ts',
    requiredFacts: [
      { kind: 'literal', value: 'task_id=worker-1' },
      { kind: 'literal', value: 'missing COMPRESR_API_KEY' }
    ],
    compresrBaselineText: 'Compresr task output compression keeps worker-1 task id and missing COMPRESR_API_KEY blocker.'
  }),
  fixture({
    name: 'remote-api-key-missing-fail-open',
    category: 'Remote dependency',
    useCase: 'Fail open when Compresr API key is missing.',
    testStrategy: 'Missing API key fail-open retention with no remote data send.',
    compresrStrength: 'Compresr SDK requires API key for hosted compression.',
    utkApproach: 'Default to deterministic local artifacts; never require remote key for core path.',
    toolId: 'compresr.api-key.missing',
    input: { apiKeyEnvVar: COMPRESR_INSTALL_CONFIG.apiKeyEnvVar },
    rawOutput: { apiKeyEnvVar: 'COMPRESR_API_KEY', liveApiConfigured: false, behavior: 'fail-open-local' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.apiKeyEnvVar', expected: 'COMPRESR_API_KEY' },
      { kind: 'jsonPath', path: '$.behavior', expected: 'fail-open-local' }
    ],
    compresrBaselineText: 'Compresr hosted API requires COMPRESR_API_KEY; UTK records fail-open-local behavior when missing.'
  }),
  fixture({
    name: 'sdk-model-config',
    category: 'Installed SDK',
    useCase: 'Verify installed Compresr SDK models used by benchmark configuration.',
    testStrategy: 'Installed SDK model-id retention from local config.',
    compresrStrength: 'Compresr SDK exposes named model ids and endpoint routing.',
    utkApproach: 'Pin installed model metadata into deterministic benchmark config.',
    toolId: 'compresr.sdk.config',
    input: { installedVersion: COMPRESR_INSTALL_CONFIG.installedVersion },
    rawOutput: {
      installedVersion: COMPRESR_INSTALL_CONFIG.installedVersion,
      models: COMPRESR_INSTALL_CONFIG.models,
      apiKeyEnvVar: COMPRESR_INSTALL_CONFIG.apiKeyEnvVar
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.installedVersion', expected: '2.5.1' },
      { kind: 'jsonPath', path: '$.models[1]', expected: 'latte_v1' }
    ],
    compresrBaselineText: 'Compresr SDK 2.5.1 exposes espresso_v1, latte_v1, and agentic model identifiers.'
  }),
  fixture({
    name: 'on-prem-endpoint-config',
    category: 'Deployment config',
    useCase: 'Configure alternate base URL for on-prem Compresr without changing artifact policy.',
    testStrategy: 'Base URL and local-artifact policy retention.',
    compresrStrength: 'Compresr supports custom base URLs for private/on-prem deployments.',
    utkApproach: 'Treat remote endpoint as optional provider; core artifacts remain local.',
    toolId: 'compresr.onprem.config',
    input: { base_url: 'https://compresr.internal.example' },
    rawOutput: { base_url: 'https://compresr.internal.example', artifact_policy: 'project-local', remote_optional: true },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.base_url', expected: 'https://compresr.internal.example' },
      { kind: 'jsonPath', path: '$.artifact_policy', expected: 'project-local' }
    ],
    compresrBaselineText: 'Compresr can use on-prem base_url https://compresr.internal.example while UTK keeps project-local artifacts.'
  }),
  fixture({
    name: 'vscode-markdown-backup',
    category: 'VS Code extension',
    useCase: 'Compress Markdown file with backup and preview workflow.',
    testStrategy: 'Backup/preview retention from VS Code extension behavior.',
    compresrStrength: 'Compresr VS Code extension previews Markdown compression and creates backups.',
    utkApproach: 'For repo work, prefer benchmark artifacts and no automatic file rewrite.',
    toolId: 'compresr.vscode.markdown',
    input: { command: 'compressCurrentFile' },
    rawOutput: { file: 'docs/evals.md', preview: 'side-by-side', backup: 'docs/evals.md.bak', remoteApi: 'api.compresr.ai' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.backup', expected: 'docs/evals.md.bak' },
      { kind: 'jsonPath', path: '$.preview', expected: 'side-by-side' }
    ],
    compresrBaselineText: 'Compresr VS Code extension compresses Markdown with side-by-side preview and docs/evals.md.bak backup.'
  }),
  fixture({
    name: 'tool-output-refusal-threshold',
    category: 'Savings threshold',
    useCase: 'Reject compression when savings do not clear refusal threshold.',
    testStrategy: 'Refusal-threshold rejection retention with artifact recovery.',
    compresrStrength: 'Context Gateway rejects compression if savings are insufficient.',
    utkApproach: 'Expose threshold failure and keep raw/compact artifacts recoverable.',
    toolId: 'compresr.refusal.threshold',
    input: { refusal_threshold: 0.15 },
    rawOutput: { original_tokens: 1000, compressed_tokens: 930, savings: 0.07, refusal_threshold: 0.15, accepted: false },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.savings', expected: 0.07 },
      { kind: 'jsonPath', path: '$.accepted', expected: false }
    ],
    compresrBaselineText: 'Compresr rejects compression when original 1000 tokens to compressed 930 tokens saves only 0.07, below refusal threshold 0.15, and records accepted=false mapping metadata.'
  }),
  fixture({
    name: 'tool-output-too-large-skip',
    category: 'Size gating',
    useCase: 'Skip too-large output while preserving reason and byte count.',
    testStrategy: 'Too-large skip metadata retention.',
    compresrStrength: 'Context Gateway skips outputs beyond configured maximum size.',
    utkApproach: 'Persist raw artifact and route to durable recovery path.',
    toolId: 'compresr.size.too-large',
    input: { max_tokens: 50000 },
    rawOutput: { output_tokens: 125000, max_tokens: 50000, mapping_status: 'skipped_too_large', rawArtifact: 'output.raw.txt' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.output_tokens', expected: 125000 },
      { kind: 'jsonPath', path: '$.mapping_status', expected: 'skipped_too_large' }
    ],
    compresrBaselineText: 'Compresr skips too-large output at 125000 tokens over max 50000 and records skipped_too_large.'
  }),
  fixture({
    name: 'tool-output-too-small-skip',
    category: 'Size gating',
    useCase: 'Skip too-small output where compression overhead is wasteful.',
    testStrategy: 'Too-small skip metadata retention.',
    compresrStrength: 'Context Gateway skips tiny outputs below compression threshold.',
    utkApproach: 'Still store raw artifact and produce compact response consistently.',
    toolId: 'compresr.size.too-small',
    input: { min_tokens: 100 },
    rawOutput: { output_tokens: 24, min_tokens: 100, mapping_status: 'skipped_too_small', rawArtifact: 'output.raw.txt' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.output_tokens', expected: 24 },
      { kind: 'jsonPath', path: '$.mapping_status', expected: 'skipped_too_small' }
    ],
    compresrBaselineText: 'Compresr skips too-small output at 24 tokens below minimum 100 and records skipped_too_small.'
  }),
  fixture({
    name: 'tool-discovery-search-result-compression',
    category: 'Tool discovery',
    useCase: 'Compress tool-search results while preserving selected tool names.',
    testStrategy: 'Tool-search selected names JSONPath retention.',
    compresrStrength: 'Compresr can compress tool-discovery search results.',
    utkApproach: 'Keep local catalog artifact and selected tool names deterministic.',
    toolId: 'compresr.tool.search-results',
    input: { pattern: 'pull request review comments' },
    rawOutput: { selected_names: ['github.pull_request.review_comments', 'github.pull_request.files'], top_k: 2 },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.selected_names[0]', expected: 'github.pull_request.review_comments' },
      { kind: 'jsonPath', path: '$.top_k', expected: 2 }
    ],
    compresrBaselineText: 'Compresr tool discovery search returns github.pull_request.review_comments and github.pull_request.files as top 2.'
  }),
  fixture({
    name: 'local-first-sensitive-code',
    category: 'Privacy',
    useCase: 'Avoid sending sensitive source code to hosted compressor.',
    testStrategy: 'Local-first privacy decision retention with exact path.',
    compresrStrength: 'Compresr hosted API can compress code only if user sends it remotely.',
    utkApproach: 'Keep sensitive code local and rely on artifacts/schema summaries.',
    toolId: 'compresr.privacy.code',
    input: { path: 'packages/core/src/security/pathSafety.ts' },
    rawOutput: { path: 'packages/core/src/security/pathSafety.ts', remote_send: false, reason: 'sensitive-code', local_artifact: true },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.remote_send', expected: false },
      { kind: 'jsonPath', path: '$.reason', expected: 'sensitive-code' }
    ],
    compresrBaselineText: 'Compresr hosted compression would require remote send; UTK marks sensitive-code remote_send=false.'
  }),
  fixture({
    name: 'kv-cache-preservation',
    category: 'Cache stability',
    useCase: 'Preserve stable compressed output across turns for KV-cache reuse.',
    testStrategy: 'Stable fingerprint and turn reuse retention.',
    compresrStrength: 'Compresr keeps compressed outputs stable for cache preservation.',
    utkApproach: 'Use deterministic artifact paths and content hashes for stable compact responses.',
    toolId: 'compresr.kv-cache',
    input: { turn: 2 },
    rawOutput: { compact_fingerprint: 'sha256:stable-777', reused_turns: [1, 2, 3], cache_preserved: true },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.compact_fingerprint', expected: 'sha256:stable-777' },
      { kind: 'jsonPath', path: '$.cache_preserved', expected: true }
    ],
    compresrBaselineText: 'Compresr preserves KV cache by reusing stable compressed output fingerprint sha256 stable-777 across turns.'
  }),
  fixture({
    name: 'allowed-forbidden-format-policy',
    category: 'Format policy',
    useCase: 'Apply allowed and forbidden format lists to tool output.',
    testStrategy: 'Allowed/forbidden format policy JSONPath retention.',
    compresrStrength: 'Context Gateway config supports allowed and forbidden content formats.',
    utkApproach: 'Expose equivalent per-tool content policy while keeping protected spans.',
    toolId: 'compresr.format.policy',
    input: { allowed_formats: ['json', 'markdown'], forbidden_formats: ['binary'] },
    rawOutput: { allowed_formats: ['json', 'markdown'], forbidden_formats: ['binary'], selected_format: 'json', compression_allowed: true },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.selected_format', expected: 'json' },
      { kind: 'jsonPath', path: '$.compression_allowed', expected: true }
    ],
    compresrBaselineText: 'Compresr format policy allows json/markdown, forbids binary, selected json compression_allowed true.'
  }),
  fixture({
    name: 'agentic-tool-output-lingua',
    category: 'Agentic models',
    useCase: 'Compare agentic_tool_output_lingua against UTK compact artifact.',
    testStrategy: 'Agentic model id and protected diagnostic retention.',
    compresrStrength: 'Compresr exposes agentic_tool_output_lingua model id for tool outputs.',
    utkApproach: 'Use deterministic serialization and protected diagnostics instead of remote model.',
    toolId: 'compresr.agentic.lingua',
    input: { model: 'agentic_tool_output_lingua' },
    rawOutput: { model: 'agentic_tool_output_lingua', diagnostic: 'TS2345 schemaId may be undefined', path: 'packages/core/src/router/router.ts:87' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.model', expected: 'agentic_tool_output_lingua' },
      { kind: 'jsonPath', path: '$.diagnostic', expected: 'TS2345 schemaId may be undefined' }
    ],
    compresrBaselineText: 'Compresr agentic_tool_output_lingua keeps TS2345 diagnostic and router.ts line 87 path.'
  }),
  fixture({
    name: 'agentic-history-lingua',
    category: 'Agentic models',
    useCase: 'Compare agentic_history_lingua history compression with UTK blocks.',
    testStrategy: 'Agentic history model and block id retention.',
    compresrStrength: 'Compresr exposes agentic_history_lingua for history summaries.',
    utkApproach: 'Replace old spans with recoverable local history blocks.',
    toolId: 'compresr.agentic.history',
    input: { model: 'agentic_history_lingua' },
    rawOutput: { model: 'agentic_history_lingua', block_id: 'hist-block-42', current_user_untouched: true },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.model', expected: 'agentic_history_lingua' },
      { kind: 'jsonPath', path: '$.current_user_untouched', expected: true }
    ],
    compresrBaselineText: 'Compresr agentic_history_lingua creates history block hist-block-42 and keeps current user untouched.'
  }),
  fixture({
    name: 'agentic-tool-discovery-sat',
    category: 'Agentic models',
    useCase: 'Compare agentic_tool_discovery_sat tool selection with UTK catalog.',
    testStrategy: 'Agentic discovery model and selected tool retention.',
    compresrStrength: 'Compresr exposes agentic_tool_discovery_sat for tool discovery.',
    utkApproach: 'Persist catalog and deterministic selection evidence.',
    toolId: 'compresr.agentic.discovery',
    input: { model: 'agentic_tool_discovery_sat' },
    rawOutput: { model: 'agentic_tool_discovery_sat', selected_tool: 'utk_expand_context', reason: 'artifact recovery' },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.model', expected: 'agentic_tool_discovery_sat' },
      { kind: 'jsonPath', path: '$.selected_tool', expected: 'utk_expand_context' }
    ],
    compresrBaselineText: 'Compresr agentic_tool_discovery_sat selects utk_expand_context for artifact recovery.'
  })
];

export const COMPRESR_PARITY_EVALS = COMPRESR_PARITY_FIXTURES.map((fixture) => fixture.name);

export function compresrParityExpectedPayload(fixture: CompresrParityFixture): string {
  return JSON.stringify({
    scenario: fixture.name,
    tool_id: fixture.toolId,
    required_facts: fixture.requiredFacts,
    compresr_baseline_text: fixture.compresrBaselineText,
    compresr_baseline_tokens: fixture.compresrBaselineTokens,
    min_fact_score: fixture.minFactScore,
    install_config: COMPRESR_INSTALL_CONFIG
  }, null, 2);
}
