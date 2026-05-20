import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ArtifactRecoveryIndex,
  ContextBudgetManager,
  createContextOptimizationPipeline,
  createArtifactSearchIndex,
  createCompressionProviderRegistry,
  createContextProof,
  createSessionContextLedger,
  compactHistoryForRequest,
  classifyProviderError,
  compressSessionBlocks,
  createToolCatalog,
  detectCacheVolatility,
  expandArtifactReference,
  findToolDefinition,
  filterToolDefinitionsForIntent,
  optimizePromptAsset,
  resolveModelProxyPolicy,
  verifyContextProof
} from '../src/index.js';

describe('context optimization engine', () => {
  it('triggers history compaction at pressure threshold while preserving output reserve and cheap-model bypass', () => {
    const manager = new ContextBudgetManager({
      maxContextTokens: 1000,
      reserveOutputTokens: 200,
      historyCompactionThreshold: 0.75,
      cheapModelPatterns: ['cheap*']
    });

    expect(manager.evaluate({ inputTokens: 560, model: 'gpt-premium' })).toMatchObject({
      shouldCompactHistory: true,
      routeReason: 'history-summary',
      reservedOutputTokens: 200
    });
    expect(manager.evaluate({ inputTokens: 560, model: 'cheap-mini' })).toMatchObject({
      shouldCompactHistory: false,
      routeReason: 'cheap-model-bypass'
    });
  });

  it('filters irrelevant tools while preserving required and recovery tools', () => {
    const tools = [
      tool('read_file', 'Read files from workspace path.'),
      tool('send_email', 'Send outbound email to a customer.'),
      tool('run_tests', 'Run test command.'),
      tool('utk_expand_context', 'Recover full UTK context by artifact id.')
    ];

    const result = filterToolDefinitionsForIntent(tools, {
      intent: 'Read failing vitest output and inspect file path',
      mode: 'static-filter',
      requiredToolNames: ['utk_expand_context']
    });

    expect(result.tools.map((item) => item.function?.name)).toEqual(['read_file', 'run_tests', 'utk_expand_context']);
    expect(result.beforeTokens).toBeGreaterThan(result.afterTokens);
    expect(result.removedToolNames).toEqual(['send_email']);
    expect(result.routeReason).toBe('tool-discovery');
  });

  it('compacts prompt assets into pipe-index form while retaining protected contracts', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-prompt-'));
    const text = [
      '---',
      'name: utk-mediator',
      'description: Use when UTK artifacts, schema routing, and recovery need analysis.',
      'tools: ["reason-with-lexicon"]',
      '---',
      'Security warning: never expose secrets.',
      'Priority: system > developer > user.',
      'Use when compact artifacts require recovery.',
      'default_prompt: "Use $utk to recover .utk artifacts."',
      'Grammar hash `abc123ef`; grammar stored at `.utk/session-agents/grammars/schema.abc123ef.guidance.json`.',
      'Output contract: sketch-of-thought.',
      'Long narrative guidance repeats. Long narrative guidance repeats. Long narrative guidance repeats.'
    ].join('\n');

    const result = await optimizePromptAsset({
      workspaceRoot,
      text,
      surface: 'ghcp-agent',
      persistOriginal: true
    });

    expect(result.optimizedText).toContain('---');
    expect(result.optimizedText).toContain('description: Use when UTK artifacts');
    expect(result.optimizedText).toContain('|IMPORTANT: retrieval-led; read refs before relying on stale memory');
    expect(result.optimizedText).toContain('reason-with-lexicon');
    expect(result.optimizedText).toContain('abc123ef');
    expect(result.optimizedText).toContain('Output contract: sketch-of-thought.');
    expect(result.optimizedText).toContain('[utk-prompt-ref:');
    expect(result.metrics.rawTokens).toBeGreaterThan(result.metrics.optimizedTokens);
    await expect(readFile(result.artifactPath!, 'utf8')).resolves.toBe(text);
  });

  it('detects cache-hostile volatility without rewriting prompts', () => {
    const prompt = 'Build 2026-05-20T12:34:56Z request 550e8400-e29b-41d4-a716-446655440000 token eyJhbGciOi.fake.payload hash abcdef1234567890abcdef1234567890';
    const report = detectCacheVolatility(prompt);

    expect(report.rewrittenText).toBe(prompt);
    expect(report.findings.map((item) => item.kind)).toEqual(['timestamp', 'uuid', 'jwt', 'hash']);
    expect(report.mode).toBe('observe');
  });

  it('indexes artifacts and expands full, range, and query snippets', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-artifact-'));
    const artifactPath = path.join(workspaceRoot, '.utk', 'model-proxy', 'artifacts', 'utk_0123456789abcdef.txt');
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, ['alpha first', 'beta second', 'gamma third', 'beta fourth'].join('\n'), 'utf8');
    const index = new ArtifactRecoveryIndex(workspaceRoot);
    await index.record({
      id: 'utk_0123456789abcdef',
      path: artifactPath,
      kind: 'tool-output',
      route: 'tool-output',
      schema: 'tool.output',
      hash: '0123456789abcdef',
      tokenCount: 12
    });

    await expect(expandArtifactReference(workspaceRoot, { id: 'utk_0123456789abcdef' })).resolves.toMatchObject({ content: expect.stringContaining('gamma third') });
    await expect(expandArtifactReference(workspaceRoot, { id: 'utk_0123456789abcdef', range: '2-3' })).resolves.toMatchObject({ content: 'beta second\ngamma third' });
    await expect(expandArtifactReference(workspaceRoot, { id: 'utk_0123456789abcdef', query: 'beta' })).resolves.toMatchObject({ content: 'beta second\nbeta fourth' });
    await expect(expandArtifactReference(workspaceRoot, { id: '../bad' })).rejects.toThrow('Invalid context artifact id');
  });

  it('creates a decision pipeline for budget, tool discovery, prompt assets, and volatility', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-pipeline-'));
    const pipeline = createContextOptimizationPipeline({
      workspaceRoot,
      maxContextTokens: 1000,
      reserveOutputTokens: 250,
      historyCompactionThreshold: 0.75
    });

    const result = await pipeline.optimize({
      model: 'gpt-premium',
      inputTokens: 520,
      intent: 'run tests',
      promptAssets: ['Security warning: never expose secrets. Repeated guidance. Repeated guidance.'],
      tools: [tool('run_tests', 'Run test command.'), tool('send_email', 'Send email.')]
    });

    expect(result.budget.shouldCompactHistory).toBe(true);
    expect(result.toolDiscovery.tools.map((item) => item.function?.name)).toEqual(['run_tests']);
    expect(result.promptAssets[0]?.optimizedText).toContain('[utk-prompt-ref:');
    expect(result.cacheVolatility.mode).toBe('observe');
  });

  it('creates a session ledger and recoverable summary blocks under history pressure', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-ledger-'));
    const ledger = createSessionContextLedger({ workspaceRoot, sessionId: 'session_a' });
    const rawPath = path.join(workspaceRoot, '.utk', 'model-proxy', 'artifacts', 'utk_aaaaaaaaaaaaaaaa.txt');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, 'line one\nline two exact fact\nline three', 'utf8');

    const event = await ledger.recordToolEvent({
      toolName: 'rg',
      input: { pattern: 'exact fact' },
      artifactId: 'utk_aaaaaaaaaaaaaaaa',
      artifactPath: rawPath,
      routeId: 'search-results',
      schemaId: 'tool.search',
      rawTokens: 120,
      compactTokens: 20,
      decision: 'tool-output'
    });
    const blocks = await compressSessionBlocks({
      workspaceRoot,
      sessionId: 'session_a',
      events: [event],
      budget: { shouldCompactHistory: true, reservedOutputTokens: 512 }
    });

    expect(event.messageId).toBe('m0001');
    expect(event.toolCallId).toBe('t0001');
    expect(blocks[0]).toMatchObject({
      blockId: 'b0001',
      sourceMessageIds: ['m0001'],
      artifactIds: ['utk_aaaaaaaaaaaaaaaa'],
      routeIds: ['search-results'],
      schemaIds: ['tool.search'],
      reservedOutputTokens: 512
    });
    await expect(readFile(blocks[0]!.path, 'utf8')).resolves.toContain('line two exact fact');
    await expect(expandArtifactReference(workspaceRoot, { id: 'utk_aaaaaaaaaaaaaaaa', blockId: 'b0001' })).resolves.toMatchObject({ content: expect.stringContaining('line two exact fact') });
  });

  it('supports deferred tool discovery with find-tool injection plus protected tool policies', () => {
    const tools = [
      tool('read_file', 'Read files from workspace path.'),
      tool('send_email', 'Send outbound email.'),
      tool('write_file', 'Write files to workspace path.'),
      tool('utk_expand_context', 'Recover full context.')
    ];

    const result = filterToolDefinitionsForIntent(tools, {
      intent: 'Need read file output',
      mode: 'deferred-search',
      requiredToolNames: ['utk_expand_context'],
      protectedToolNames: ['write_file']
    });

    expect(result.tools.map((item) => item.function?.name)).toEqual(['read_file', 'write_file', 'utk_expand_context', 'utk_find_tool']);
    expect(result.removedToolNames).toEqual(['send_email']);
    expect(result.routeReason).toBe('tool-discovery');
  });

  it('dedupes repeated outputs and purges stale errors without touching protected tools', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-dedupe-'));
    const ledger = createSessionContextLedger({ workspaceRoot, sessionId: 'session_b' });
    const first = await ledger.recordToolEvent({ toolName: 'git status', input: { cmd: 'git status' }, artifactId: 'utk_bbbbbbbbbbbbbbbb', artifactPath: path.join(workspaceRoot, 'a.txt'), routeId: 'tool-output', schemaId: 'tool.output', rawTokens: 100, compactTokens: 10, decision: 'tool-output', status: 'ok' });
    const second = await ledger.recordToolEvent({ toolName: 'git status', input: { cmd: 'git status' }, artifactId: 'utk_cccccccccccccccc', artifactPath: path.join(workspaceRoot, 'b.txt'), routeId: 'tool-output', schemaId: 'tool.output', rawTokens: 100, compactTokens: 10, decision: 'tool-output', status: 'ok' });
    const stale = await ledger.recordToolEvent({ toolName: 'rg', input: { pattern: 'missing' }, artifactId: 'utk_dddddddddddddddd', artifactPath: path.join(workspaceRoot, 'c.txt'), routeId: 'search-results', schemaId: 'tool.search', rawTokens: 80, compactTokens: 10, decision: 'tool-output', status: 'error', turn: 1 });
    const protectedEdit = await ledger.recordToolEvent({ toolName: 'edit', input: { path: 'src/app.ts' }, artifactId: 'utk_eeeeeeeeeeeeeeee', artifactPath: path.join(workspaceRoot, 'd.txt'), routeId: 'edit-loop', schemaId: 'tool.edit', rawTokens: 80, compactTokens: 10, decision: 'tool-output', status: 'error', turn: 1 });

    const policy = ledger.applyRetentionPolicy([first, second, stale, protectedEdit], {
      currentTurn: 6,
      dedupePolicy: 'observe',
      purgeErrorAfterTurns: 4,
      protectedToolNames: ['edit']
    });

    expect(policy.deduped.map((item) => item.messageId)).toEqual(['m0001']);
    expect(policy.purgedErrors.map((item) => item.messageId)).toEqual(['m0003']);
    expect(policy.purgedErrors.map((item) => item.messageId)).not.toContain('m0004');
  });

  it('builds artifact search handles and context proofs', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-proof-'));
    const artifactPath = path.join(workspaceRoot, '.utk', 'model-proxy', 'artifacts', 'utk_ffffffffffffffff.txt');
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, 'src/app.ts:10: exact error TS2322\nsrc/app.ts:11: retained fact', 'utf8');
    const index = createArtifactSearchIndex(workspaceRoot);
    await index.record({
      id: 'utk_ffffffffffffffff',
      path: artifactPath,
      kind: 'test-error',
      route: 'test-error',
      schema: 'tool.error',
      hash: 'ffffffffffffffff',
      tokenCount: 20,
      relativePath: 'src/app.ts'
    });
    const handles = await index.search('TS2322');

    expect(handles[0]).toMatchObject({
      artifactId: 'utk_ffffffffffffffff',
      relativePath: 'src/app.ts',
      range: '1-1',
      routeId: 'test-error',
      schemaId: 'tool.error',
      snippet: expect.stringContaining('TS2322')
    });
    await expect(expandArtifactReference(workspaceRoot, { id: 'utk_ffffffffffffffff', handle: handles[0] })).resolves.toMatchObject({ content: expect.stringContaining('TS2322') });

    const proof = await createContextProof({
      workspaceRoot,
      artifactId: 'utk_ffffffffffffffff',
      compactText: '[utk-ref:utk_ffffffffffffffff] exact error TS2322 retained fact',
      requiredFacts: ['TS2322', 'retained fact']
    });
    expect(proof.ok).toBe(true);
    expect(proof.rawHash).toMatch(/[a-f0-9]{16}/);
    expect(proof.checks).toEqual(expect.arrayContaining([
      { name: 'raw-artifact', passed: true },
      { name: 'required-facts', passed: true },
      { name: 'no-raw-leakage', passed: true },
      { name: 'recovery', passed: true }
    ]));

    const failed = await createContextProof({ workspaceRoot, artifactId: 'utk_ffffffffffffffff', compactText: 'raw dump src/app.ts:10: exact error TS2322', requiredFacts: ['missing fact'] });
    expect(failed.ok).toBe(false);
    expect(failed.checks).toEqual(expect.arrayContaining([{ name: 'required-facts', passed: false }, { name: 'no-raw-leakage', passed: false }]));
  });

  it('classifies provider errors and keeps local providers default', async () => {
    expect(classifyProviderError({ status: 401 })).toBe('auth');
    expect(classifyProviderError({ status: 429 })).toBe('rate-limit');
    expect(classifyProviderError({ name: 'AbortError' })).toBe('timeout');
    expect(classifyProviderError(new Error('payload too large'))).toBe('request-too-large');
    expect(classifyProviderError(new Error('policy denied remote compressor'))).toBe('policy-denied');
    expect(classifyProviderError(new Error('offline'))).toBe('unavailable');

    const registry = createCompressionProviderRegistry();
    expect(registry.remoteEnabled).toBe(false);
    expect(registry.providers.default.localOnly).toBe(true);
    const compressed = await registry.providers.default.compress('alpha beta gamma delta', { kind: 'natural-language' });
    expect(compressed.applied).toBe(false);
  });

  it('resolves model proxy policy from config, env, and explicit overrides', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-policy-'));
    await mkdir(path.join(workspaceRoot, '.utk'), { recursive: true });
    await writeFile(
      path.join(workspaceRoot, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[model_proxy]',
        'tool_discovery_mode = "deferred-search"',
        'history_compaction_mode = "replace-with-summary-block"',
        'dedupe_policy = "compact"',
        'stale_error_policy = "compact"',
        'session_id_header = "x-session"',
        'deferred_tool_search_enabled = true',
        'protected_tools = ["write", "deploy*"]',
        'protected_file_patterns = [".env*", "*.pem"]',
        'remote_compressors_enabled = true',
        'provider_strict_mode = true',
        ''
      ].join('\n'),
      'utf8'
    );

    const policy = await resolveModelProxyPolicy(workspaceRoot, { UTK_MODEL_PROXY_TOOL_DISCOVERY_MODE: 'static-filter' }, { provider_strict_mode: false });

    expect(policy).toMatchObject({
      tool_discovery_mode: 'static-filter',
      history_compaction_mode: 'replace-with-summary-block',
      dedupe_policy: 'compact',
      stale_error_policy: 'compact',
      session_id_header: 'x-session',
      deferred_tool_search_enabled: true,
      remote_compressors_enabled: true,
      provider_strict_mode: false
    });
    expect(policy.protected_tools).toEqual(['write', 'deploy*']);
    expect(policy.protected_file_patterns).toEqual(['.env*', '*.pem']);
  });

  it('persists monotonic session ids and replaces old history with summary blocks', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-history-replace-'));
    const rawPath = path.join(workspaceRoot, '.utk', 'model-proxy', 'artifacts', 'utk_1111111111111111.txt');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, 'old tool exact fact\nold tool noisy tail', 'utf8');

    const firstLedger = createSessionContextLedger({ workspaceRoot, sessionId: 'persisted' });
    const first = await firstLedger.recordToolEvent({
      turn: 1,
      role: 'tool',
      toolName: 'rg',
      input: { pattern: 'fact' },
      content: 'old tool exact fact',
      rawTokens: 80,
      compactTokens: 8,
      artifactId: 'utk_1111111111111111',
      artifactPath: rawPath,
      routeId: 'search-results',
      schemaId: 'tool.search',
      decision: 'tool-output',
      status: 'ok'
    });
    const secondLedger = createSessionContextLedger({ workspaceRoot, sessionId: 'persisted' });
    const second = await secondLedger.recordToolEvent({
      turn: 2,
      role: 'tool',
      toolName: 'rg',
      input: { pattern: 'new' },
      content: 'new exact fact',
      rawTokens: 60,
      compactTokens: 6,
      artifactId: 'utk_1111111111111111',
      artifactPath: rawPath,
      routeId: 'search-results',
      schemaId: 'tool.search',
      decision: 'tool-output',
      status: 'ok'
    });

    const result = await compactHistoryForRequest({
      workspaceRoot,
      sessionId: 'persisted',
      messages: [
        { role: 'system', content: 'system rules stay' },
        { role: 'tool', name: 'rg', content: 'old tool exact fact' },
        { role: 'user', content: 'current user stays' }
      ],
      events: [first],
      budget: { shouldCompactHistory: true, reservedOutputTokens: 256 },
      protectedToolNames: []
    });

    expect(first.messageId).toBe('m0001');
    expect(second.messageId).toBe('m0002');
    expect(result.blocks[0]).toMatchObject({ blockId: 'b0001', sourceMessageIds: ['m0001'] });
    expect(result.messages.map((message) => message.role)).toEqual(['system', 'developer', 'user']);
    expect(result.messages[1].content).toContain('[utk-block:b0001]');
    expect(result.messages[1].content).toContain('history-summary');
    expect(result.messages[1].content).not.toContain('old tool exact fact');
    expect(result.messages[2].content).toBe('current user stays');
  });

  it('creates searchable tool catalogs for deferred discovery', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-tool-catalog-'));
    const catalog = await createToolCatalog({
      workspaceRoot,
      requestId: 'req_1',
      tools: [
        tool('read_file', 'Read file content from workspace.'),
        tool('run_tests', 'Run vitest or npm test command.'),
        tool('send_email', 'Send outbound email.')
      ]
    });

    expect(catalog.catalogId).toMatch(/^utkc_/);
    expect(catalog.toolCount).toBe(3);
    await expect(readFile(catalog.path, 'utf8')).resolves.toContain('run_tests');
    await expect(findToolDefinition(workspaceRoot, { catalogId: catalog.catalogId, query: 'vitest' })).resolves.toMatchObject({
      tool: { function: { name: 'run_tests' } },
      catalogId: catalog.catalogId
    });
    await expect(findToolDefinition(workspaceRoot, { catalogId: catalog.catalogId, query: 'missing' })).resolves.toMatchObject({
      tool: undefined,
      catalogId: catalog.catalogId
    });
  });

  it('verifies context proofs against stored compact artifacts and detects drift', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-context-opt-proof-verify-'));
    const rawPath = path.join(workspaceRoot, '.utk', 'model-proxy', 'artifacts', 'utk_2222222222222222.txt');
    const compactPath = path.join(workspaceRoot, '.utk', 'model-proxy', 'artifacts', 'utk_2222222222222222.compact.txt');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, 'src/app.ts:10: exact error TS2322\nretained fact', 'utf8');
    await writeFile(compactPath, '[utk-ref:utk_2222222222222222] exact error TS2322 retained fact', 'utf8');
    const index = createArtifactSearchIndex(workspaceRoot);
    await index.record({
      id: 'utk_2222222222222222',
      path: rawPath,
      compactPath,
      kind: 'test-error',
      route: 'test-error',
      schema: 'tool.error',
      hash: '2222222222222222',
      compactHash: 'bad-hash',
      tokenCount: 20
    });

    const proof = await verifyContextProof({ workspaceRoot, artifactId: 'utk_2222222222222222', requiredFacts: ['TS2322', 'retained fact'] });
    expect(proof.ok).toBe(true);
    expect(proof.checks).toEqual(expect.arrayContaining([{ name: 'compact-artifact', passed: true }, { name: 'hash-match', passed: true }]));

    await writeFile(compactPath, 'raw dump src/app.ts:10: exact error TS2322', 'utf8');
    const failed = await verifyContextProof({ workspaceRoot, artifactId: 'utk_2222222222222222', requiredFacts: ['retained fact'] });
    expect(failed.ok).toBe(false);
    expect(failed.checks).toEqual(expect.arrayContaining([{ name: 'required-facts', passed: false }, { name: 'no-raw-leakage', passed: false }]));
  });
});

function tool(name: string, description: string): Record<string, any> {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: { type: 'object', properties: { path: { type: 'string' } } }
    }
  };
}
