import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  assertNoRawLeakage,
  buildCompactResponse,
  buildRouterPrompt,
  canonicalJson,
  cleanupObservations,
  compactSchemaHistory,
  containsForbiddenSpecialCase,
  contentHash,
  deterministicRoute,
  estimateTokens,
  extractRules,
  initializeWorkspaceStore,
  inferSchema,
  inferTextPseudoSchema,
  isCompatible,
  markSchemaValidated,
  mediateToolExecution,
  mergeSchema,
  normalizeToolId,
  persistStream,
  quarantineInvalidArtifacts,
  readSchemaHistory,
  registerUtkCopilotToolHook,
  rebuildRouteIndex,
  refineSchemaWithCopilot,
  routeFromCandidates,
  routeToToon,
  routeWithCopilot,
  safeJoin,
  schemaIdFor,
  schemaToToon,
  sortValue,
  stableStringify,
  validateArtifacts,
  validateCanonicalToonPair,
  validateRules,
  writeInputSchema,
  writeManifest
} from '../src/index.js';

describe('coverage for artifact primitives', () => {
  it('canonicalizes, hashes, normalizes, and writes manifest artifacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-artifact-'));
    const sorted = sortValue({ b: 1, a: { d: 4, c: 3 }, z: [2, { b: 2, a: 1 }] });
    expect(stableStringify(sorted)).toContain('"a"');
    expect(canonicalJson({ b: 1, a: 2 }).endsWith('\n')).toBe(true);
    expect(contentHash({ a: 1 }, 8)).toHaveLength(8);
    expect(normalizeToolId('---My Tool!!!')).toBe('my-tool');
    expect(normalizeToolId('!!!')).toBe('tool');
    expect(normalizeToolId('a_b.c-1')).toBe('a_b-c-1');
    expect(normalizeToolId('..')).toBe('tool');
    expect(schemaIdFor('tool', 3, { type: 'object' }, [])).toMatch(/^tool\.v3\./);

    const manifest = await writeManifest(root, 'My Tool!!!');
    await writeInputSchema(root, { z: 1, a: true });
    expect(manifest.normalizedId).toBe('my-tool');
    expect(await readFile(path.join(root, 'input.schema.json'), 'utf8')).toContain('additionalProperties');
    await writeInputSchema(root, null);
    expect(await readFile(path.join(root, 'input.schema.json'), 'utf8')).toContain('{}');
  });

  it('blocks path traversal and allows base path joins', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-safe-'));
    expect(safeJoin(root)).toBe(path.resolve(root));
    expect(safeJoin(root, 'child')).toBe(path.join(root, 'child'));
    expect(() => safeJoin(root, '..', 'escape')).toThrow('Path traversal blocked');
  });
});

describe('coverage for schema inference and rules', () => {
  it('covers primitive, string format, mixed array, object, and fallback schemas', () => {
    expect(inferSchema(null)).toEqual({ type: 'null' });
    expect(inferSchema(false)).toEqual({ type: 'boolean' });
    expect(inferSchema(1.5)).toEqual({ type: 'number' });
    expect(inferSchema('https://example.com')).toEqual({ type: 'string', format: 'uri' });
    expect(inferSchema('2026-05-19')).toEqual({ type: 'string', format: 'date' });
    expect(inferSchema('2026-05-19T00:00:00Z')).toEqual({ type: 'string', format: 'date-time' });
    expect(inferSchema('a@example.com')).toEqual({ type: 'string', format: 'email' });
    expect(inferSchema('a@b@c')).toEqual({ type: 'string', minLength: 5, maxLength: 5 });
    expect(inferSchema('@example.com')).toEqual({ type: 'string', minLength: 12, maxLength: 12 });
    expect(inferSchema('a@.com')).toEqual({ type: 'string', minLength: 6, maxLength: 6 });
    expect(inferSchema('a@example.')).toEqual({ type: 'string', minLength: 10, maxLength: 10 });
    expect(inferSchema('not email')).toEqual({ type: 'string', minLength: 9, maxLength: 9 });
    expect(inferSchema(['x', 1])).toMatchObject({ type: 'array', items: { anyOf: [{ type: 'string', minLength: 1, maxLength: 1 }, { type: 'integer' }] } });
    expect(inferSchema(undefined)).toEqual({ type: 'string' });
  });

  it('covers text prefixes, suffixes, opacity, and empty text', () => {
    expect(inferTextPseudoSchema('abc-1-z\nabc-2-z')).toMatchObject({ stablePrefix: 'abc-', stableSuffix: '-z', opaque: false });
    expect(inferTextPseudoSchema('')).toMatchObject({ lineCount: 1, opaque: true });
    expect(inferTextPseudoSchema('\n')).toMatchObject({ lineCount: 2, stablePrefix: '', stableSuffix: '' });
  });

  it('extracts nested object, array, string format rules and filters forbidden details', () => {
    const schema = {
      type: 'object',
      required: ['items'],
      properties: {
        items: { type: 'array', minItems: 1, maxItems: 2 },
        contact: { type: 'string', format: 'email' }
      }
    };
    const rules = extractRules(schema);
    expect(rules.map((rule) => rule.kind)).toContain('cardinality');
    expect(rules.map((rule) => rule.kind)).toContain('format');
    expect(validateRules([{ path: '$', kind: 'format', confidence: 1, evidenceCount: 1, details: { format: 'docker-command' } }])).toEqual([]);
    expect(extractRules({ type: 'object', required: [1], properties: null })).toEqual([]);
    expect(extractRules({ type: 'object' })).toEqual([]);
  });
});

describe('coverage for routing, responses, and Copilot structural prompts', () => {
  it('covers deterministic route outcomes and candidate routing reasons', () => {
    expect(deterministicRoute([], 'abc')).toEqual({ schema: 'unknown', confidence: 0, reason: 'unknown' });
    expect(deterministicRoute(['schema.abcdef12'], 'abcdef12ffff')).toEqual({ schema: 'schema.abcdef12', confidence: 1, reason: 'input_match' });
    const candidates = [
      { schema: 'input', toolId: 'tool', inputFingerprint: contentHash({ id: 1 }, 8) },
      { schema: 'shape', toolId: 'tool', shapeFingerprint: contentHash({ shape: true }, 8) },
      { schema: 'other', toolId: 'other', priorCount: 10 }
    ];
    expect(routeFromCandidates('tool', { id: 1 }, {}, candidates).reason).toBe('input_match');
    expect(routeFromCandidates('tool', { id: 2 }, { shape: true }, candidates).reason).toBe('shape_match');
    expect(routeFromCandidates('tool', { id: 2 }, {}, candidates).reason).toBe('tool_match');
    expect(routeFromCandidates('missing', {}, {}, candidates).reason).toBe('prior_match');
    expect(routeFromCandidates('missing', {}, {}, []).reason).toBe('unknown');
  });

  it('covers route prompt, response truncation, and TOON helpers', () => {
    expect(estimateTokens('abcd')).toBe(1);
    const prompt = buildRouterPrompt('tool', ['z', 'a'], 'shape', 'fields', Array.from({ length: 10 }, (_, index) => ({ schema: `s${index}`, toolId: 'tool' })));
    expect(prompt.candidates).toHaveLength(8);
    expect(prompt.prompt).toContain('input_keys: a,z');
    expect(routeToToon('schema', 0.955, 'tool_match')).toBe('route{schema:"schema",confidence:0.95,reason:tool_match}');
    expect(schemaToToon({ type: 'object' })).toBe('schema{"type":"object"}');
    expect(validateCanonicalToonPair({ type: 'object' }, `${schemaToToon({ type: 'object' })}\n`)).toEqual({ valid: true, errors: [] });
    expect(buildCompactResponse('x'.repeat(390), 'schema', 1)).toHaveLength(400);
  });

  it('enforces structural-only Copilot refinement and routing', async () => {
    const prompts: unknown[] = [];
    const provider = { completeStructural: async (prompt: unknown) => { prompts.push(prompt); return '{"type":"object"}'; } };
    await expect(refineSchemaWithCopilot(provider, { type: 'object' }, [])).resolves.toEqual({ type: 'object' });
    await expect(routeWithCopilot({ completeStructural: async () => 'route' }, { schema: 'x' })).resolves.toBe('route');
    await expect(refineSchemaWithCopilot(provider, { description: 'docker command' }, [])).rejects.toThrow('Forbidden special-case');
    await expect(refineSchemaWithCopilot(provider, { text: 'x'.repeat(20_001) }, [])).rejects.toThrow('too large');
    expect(prompts).toHaveLength(1);
  });

  it('registers the Copilot tool hook and returns mediated responses', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-hook-'));
    let callback: ((toolId: string, input: unknown, executeOriginal: (input: unknown) => Promise<unknown>) => Promise<string>) | undefined;
    registerUtkCopilotToolHook({ registerToolHook: (handler) => { callback = handler; } }, root);
    await expect(callback?.('tool.hook', {}, async () => ({ ok: true }))).resolves.toContain('Tool result stored at:');
  });
});

describe('coverage for mediation and artifact stores', () => {
  it('persists text output and compatible schema history', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-mediate-'));
    const { storageRoot } = await initializeWorkspaceStore(root);
    const first = await mediateToolExecution({ workspaceRoot: root, toolId: 'Tool Text', input: { b: 2 }, execute: async () => 'alpha\nbeta' });
    const second = await mediateToolExecution({ workspaceRoot: root, toolId: 'Tool Text', input: { a: 1 }, execute: async () => 'alpha\ngamma' });
    expect(second.schemaId).toContain('.v1.');
    expect(await readSchemaHistory(path.join(storageRoot, 'tools', 'tool-text'))).not.toHaveLength(0);
    await markSchemaValidated(path.join(storageRoot, 'tools', 'tool-text'), second.schemaId);
    expect(await readFile(path.join(storageRoot, 'tools', 'tool-text', 'history', `${second.schemaId}.schema.json`), 'utf8')).toContain('validated');
    expect(await readFile(first.rawPath, 'utf8')).toContain('alpha');

    const historyDir = path.join(storageRoot, 'tools', 'tool-text', 'history');
    await writeFile(path.join(historyDir, 'ignored.txt'), 'x', 'utf8');
    const history = await readSchemaHistory(path.join(storageRoot, 'tools', 'tool-text'));
    expect(history.at(0)?.version).toBeLessThanOrEqual(history.at(-1)?.version ?? 99);
  });

  it('sorts explicit schema history files by version and id', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-history-sort-'));
    const toolBase = path.join(root, 'tool');
    const historyDir = path.join(toolBase, 'history');
    await import('node:fs/promises').then((fs) => fs.mkdir(historyDir, { recursive: true }));
    await writeFile(path.join(historyDir, 'b.schema.json'), JSON.stringify({ id: 'b', version: 2, state: 'current', schema: {}, rules: [] }), 'utf8');
    await writeFile(path.join(historyDir, 'a.schema.json'), JSON.stringify({ id: 'a', version: 1, state: 'current', schema: {}, rules: [] }), 'utf8');
    await writeFile(path.join(historyDir, 'aa.schema.json'), JSON.stringify({ id: 'aa', version: 1, state: 'current', schema: {}, rules: [] }), 'utf8');
    await writeFile(path.join(historyDir, 'z.txt'), 'ignored', 'utf8');
    expect((await readSchemaHistory(toolBase)).map((item) => item.id)).toEqual(['a', 'aa', 'b']);
  });

  it('persists array and primitive outputs with summaries and detected types', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-detect-'));
    await initializeWorkspaceStore(root);
    const arrayResult = await mediateToolExecution({ workspaceRoot: root, toolId: 'tool.array', input: {}, execute: async () => [1, 2] });
    const primitiveResult = await mediateToolExecution({ workspaceRoot: root, toolId: 'tool.primitive', input: {}, execute: async () => 42 });
    expect(await readFile(path.join(path.dirname(arrayResult.rawPath), 'output.summary.json'), 'utf8')).toContain('array');
    expect(await readFile(path.join(path.dirname(primitiveResult.rawPath), 'output.envelope.json'), 'utf8')).toContain('number');
  });

  it('handles current schema ids without version matches and missing rules arrays', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-current-'));
    const { storageRoot } = await initializeWorkspaceStore(root);
    const toolBase = path.join(storageRoot, 'tools', 'tool-current');
    await import('node:fs/promises').then((fs) => fs.mkdir(toolBase, { recursive: true }));
    await writeFile(path.join(toolBase, 'schema.id'), 'unversioned', 'utf8');
    await writeFile(path.join(toolBase, 'output.current.schema.json'), '{\"type\":\"string\"}', 'utf8');
    await writeFile(path.join(toolBase, 'rules.json'), '{}', 'utf8');
    const result = await mediateToolExecution({ workspaceRoot: root, toolId: 'tool-current', input: {}, execute: async () => 'next' });
    expect(result.schemaId).toContain('.v2.');
  });

  it('covers route indexes, validation, quarantine, cleanup, and compaction empty paths', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-store-'));
    const { storageRoot } = await initializeWorkspaceStore(root);
    expect(await rebuildRouteIndex(storageRoot)).toEqual([]);
    expect(await readFile(path.join(storageRoot, 'routes', 'index.toon'), 'utf8')).toBe('routes[]\n');
    expect(await validateArtifacts(path.join(storageRoot, 'missing'))).toEqual([]);
    expect(await quarantineInvalidArtifacts(path.join(storageRoot, 'missing'))).toEqual([]);
    expect(await cleanupObservations(storageRoot, ['missing'])).toBe(0);
    expect(await compactSchemaHistory(storageRoot)).toBe(0);
    expect(await readSchemaHistory(path.join(storageRoot, 'tools', 'missing'))).toEqual([]);
  });

  it('skips selected tools, non-json files, valid json, and validated history during artifact maintenance', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-artifact-store-'));
    const { storageRoot } = await initializeWorkspaceStore(root);
    const obs = path.join(storageRoot, 'tools', 'keep', 'observations', 'run');
    await import('node:fs/promises').then((fs) => fs.mkdir(obs, { recursive: true }));
    await writeFile(path.join(obs, 'output.raw.txt'), 'x', 'utf8');
    await writeFile(path.join(storageRoot, 'routes', 'ok.json'), '{}', 'utf8');
    await writeFile(path.join(storageRoot, 'routes', 'note.txt'), 'not json', 'utf8');
    expect(await validateArtifacts(storageRoot)).toEqual([]);
    expect(await cleanupObservations(storageRoot, ['other'])).toBe(0);

    const history = path.join(storageRoot, 'tools', 'keep', 'history');
    await import('node:fs/promises').then((fs) => fs.mkdir(history, { recursive: true }));
    await writeFile(path.join(history, 'keep.v1.validated.schema.json'), '{}', 'utf8');
    await writeFile(path.join(history, 'keep.v2.current.schema.json'), '{}', 'utf8');
    expect(await compactSchemaHistory(storageRoot)).toBe(0);
    const emptyHistory = path.join(storageRoot, 'tools', 'empty', 'history');
    await import('node:fs/promises').then((fs) => fs.mkdir(emptyHistory, { recursive: true }));
    const oneHistory = path.join(storageRoot, 'tools', 'one', 'history');
    await import('node:fs/promises').then((fs) => fs.mkdir(oneHistory, { recursive: true }));
    await writeFile(path.join(oneHistory, 'one.v1.current.schema.json'), '{}', 'utf8');
    const currentHistory = path.join(storageRoot, 'tools', 'current', 'history');
    await import('node:fs/promises').then((fs) => fs.mkdir(currentHistory, { recursive: true }));
    await writeFile(path.join(storageRoot, 'tools', 'current', 'schema.id'), 'current.v1.current', 'utf8');
    await writeFile(path.join(currentHistory, 'current.v1.current.schema.json'), '{}', 'utf8');
    await writeFile(path.join(currentHistory, 'current.v9.old.schema.json'), '{}', 'utf8');
    const routes = await rebuildRouteIndex(storageRoot);
    expect(routes).toHaveLength(3);
    expect(routes.every((route) => route.reason === 'tool_match')).toBe(true);
    expect(routes.map((route) => route.schema)).toContain('current.v1.current');
    expect(await compactSchemaHistory(storageRoot)).toBe(1);
    expect(JSON.parse(await readFile(path.join(currentHistory, 'compacted-summary.json'), 'utf8')).removed).toBe(1);
  });

  it('persists streams directly and detects leakage', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-stream-'));
    const out = path.join(root, 'stream.bin');
    const persisted = await persistStream(Readable.from(['a', Buffer.from('bc')]), out);
    expect(persisted.byteCount).toBe(3);
    expect(await readFile(out, 'utf8')).toBe('abc');
    await expect(persistStream(Readable.from(async function* () {
      yield 'partial';
      throw new Error('stream failed');
    }()), path.join(root, 'failed.bin'))).rejects.toThrow('stream failed');
    await expect(access(path.join(root, 'failed.bin'))).rejects.toThrow();
    expect(() => assertNoRawLeakage('secret', 'secret')).toThrow('Raw output leakage detected');
    expect(() => assertNoRawLeakage('safe', Buffer.from('secret'))).not.toThrow();
    expect(containsForbiddenSpecialCase('plain schema')).toBe(false);
    expect(containsForbiddenSpecialCase('aws command')).toBe(true);
  });

  it('covers schema merge variants', () => {
    const object = mergeSchema('tool', undefined, { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } }, required: ['a', 'b'] }, []);
    const narrowed = mergeSchema('tool', object.schema, { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }, []);
    const array = mergeSchema('tool', undefined, { type: 'array', items: { type: 'string' } }, []);
    const arrayAgain = mergeSchema('tool', array.schema, { type: 'array', items: { type: 'number' } }, []);
    const primitive = mergeSchema('tool', { ...object.schema, schema: { type: 'string' } }, { type: 'string', minLength: 1 }, []);
    expect(narrowed.action).toBe('update-current');
    expect(arrayAgain.action).toBe('update-current');
    expect(primitive.action).toBe('update-current');
    expect(mergeSchema('tool', object.schema, { type: 'object', properties: { c: { type: 'string' } }, required: ['c'] }, []).action).toBe('new-version');
    expect(isCompatible({ type: 'object', properties: { a: {}, b: {} } }, { type: 'object', properties: { a: {} } })).toBe(true);
    expect(isCompatible({ type: 'object' }, { type: 'object' })).toBe(true);
    expect(mergeSchema('tool', { ...object.schema, schema: { type: 'object', properties: { a: {} } } }, { type: 'object', properties: { a: {}, b: {} } }, []).schema.schema).toMatchObject({ required: [] });
    expect(mergeSchema('tool', { id: 'x', version: 1, state: 'current', schema: { type: 'object' }, rules: [] }, { type: 'object' }, []).schema.schema).toMatchObject({ properties: {}, required: [] });
  });

  it('preserves existing workspace files on reinitialization', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-cover-init-'));
    const init = await initializeWorkspaceStore(root);
    await writeFile(init.configPath, '{"custom":true}\n', 'utf8');
    await initializeWorkspaceStore(root);
    expect(await readFile(init.configPath, 'utf8')).toContain('custom');
    await rm(root, { recursive: true, force: true });
  });
});
