import { mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  buildRouterPrompt,
  cleanupObservations,
  compactSchemaHistory,
  initializeWorkspaceStore,
  inferSchema,
  inferTextPseudoSchema,
  mergeSchema,
  mediateToolExecution,
  quarantineInvalidArtifacts,
  rebuildRouteIndex,
  deterministicRoute,
  extractRules,
  validateArtifacts,
  validateCanonicalToonPair,
  validateRules
} from '../src/index.js';

describe('workspace initialization', () => {
  it('creates .utk config and gitignore', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-init-'));
    const result = await initializeWorkspaceStore(root);

    const gitignore = await readFile(path.join(result.storageRoot, '.gitignore'), 'utf8');
    const config = JSON.parse(await readFile(path.join(result.storageRoot, 'config.json'), 'utf8'));

    expect(gitignore).toContain('/tools/*/observations/');
    expect(config).toEqual(DEFAULT_CONFIG);
  });
});

describe('schema inference', () => {
  it('infers primitive and object schemas', () => {
    expect(inferSchema(1)).toEqual({ type: 'integer' });
    expect(inferSchema({ ok: true })).toMatchObject({ type: 'object' });
  });

  it('infers array and text pseudo schema', () => {
    expect(inferSchema([{ a: 1 }])).toMatchObject({ type: 'array' });
    expect(inferTextPseudoSchema('prefix-one\nprefix-two')).toMatchObject({
      type: 'text-pseudo-schema-envelope',
      stablePrefix: 'prefix-'
    });
  });
});

describe('tool mediation', () => {
  it('persists raw output and returns compact response without payload leakage', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-mediate-'));
    await initializeWorkspaceStore(root);

    const result = await mediateToolExecution({
      workspaceRoot: root,
      toolId: 'tool.echo',
      input: { id: 1 },
      execute: async () => ({ secret: 'sensitive-value', ok: true })
    });

    const raw = await readFile(result.rawPath, 'utf8');
    const obsDir = path.dirname(result.rawPath);
    const files = await readdir(obsDir);

    expect(raw).toContain('sensitive-value');
    expect(result.response).toContain('Tool result stored at:');
    expect(result.response).not.toContain('sensitive-value');
    expect(files).toContain('output.envelope.json');
    expect(files).toContain('output.summary.json');
    expect(files).toContain('output.schema.json');
    expect(await readFile(path.join(path.dirname(path.dirname(obsDir)), 'manifest.json'), 'utf8')).toContain('tool.echo');
    expect(await readFile(path.join(path.dirname(path.dirname(obsDir)), 'input.schema.json'), 'utf8')).toContain('id');
  });

  it('handles binary outputs via binary envelope', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-bin-'));
    await initializeWorkspaceStore(root);

    const result = await mediateToolExecution({
      workspaceRoot: root,
      toolId: 'tool.binary',
      input: {},
      execute: async () => Buffer.from([1, 2, 3])
    });

    const info = await stat(result.rawPath);
    expect(result.rawPath.endsWith('.raw.bin')).toBe(true);
    expect(info.size).toBe(3);
  });

  it('persists streamed chunks incrementally with chunk metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-stream-'));
    await initializeWorkspaceStore(root);

    const result = await mediateToolExecution({
      workspaceRoot: root,
      toolId: 'tool.stream',
      input: {},
      execute: async () => Readable.from([Buffer.from('a'), Buffer.from('bc')])
    });

    const envelope = JSON.parse(await readFile(path.join(path.dirname(result.rawPath), 'output.envelope.json'), 'utf8'));
    expect(envelope.detectedType).toBe('stream');
    expect(envelope.chunkMetadata).toHaveLength(2);
  });

  it('falls back to text persistence for non-JSON outputs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-non-json-'));
    await initializeWorkspaceStore(root);
    const circular: { self?: unknown; value: bigint } = { value: 1n };
    circular.self = circular;

    const circularResult = await mediateToolExecution({ workspaceRoot: root, toolId: 'tool.circular', input: {}, execute: async () => circular });
    const undefinedResult = await mediateToolExecution({ workspaceRoot: root, toolId: 'tool.undefined', input: {}, execute: async () => undefined });

    expect(circularResult.rawPath.endsWith('.raw.txt')).toBe(true);
    expect(await readFile(circularResult.rawPath, 'utf8')).toContain('Circular');
    expect(undefinedResult.rawPath.endsWith('.raw.txt')).toBe(true);
    expect(await readFile(undefinedResult.rawPath, 'utf8')).toBe('undefined\n');
  });
});

describe('rules and routing', () => {
  it('rejects forbidden special-case details', () => {
    const rules = validateRules([
      { path: '$.x', kind: 'format', confidence: 1, evidenceCount: 1, details: { format: 'cli-command' } },
      { path: '$.y', kind: 'required-field', confidence: 1, evidenceCount: 1 }
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.path).toBe('$.y');
  });

  it('creates deterministic route decisions', () => {
    const route = deterministicRoute(['tool.v1.aaaaaaaaaa'], 'aaaaaaaaaabbbbb');
    expect(route.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('extracts only allowed generic rules', () => {
    const rules = extractRules({ type: 'object', required: ['a'], properties: { a: { type: 'string', format: 'email' } } });
    expect(rules.every((rule) => ['required-field', 'format'].includes(rule.kind))).toBe(true);
  });

  it('builds constrained router prompts within budget', () => {
    const prompt = buildRouterPrompt('tool', ['b', 'a'], 'shape', 'fields', [{ schema: 'schema', toolId: 'tool' }]);
    expect(prompt.promptTokens).toBeLessThanOrEqual(700);
    expect(prompt.prompt).toContain('Return route only.');
  });
});

describe('artifact operations', () => {
  it('rebuilds route indexes and cleans observations', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-artifacts-'));
    const { storageRoot } = await initializeWorkspaceStore(root);
    await mediateToolExecution({ workspaceRoot: root, toolId: 'tool.route', input: {}, execute: async () => ({ ok: true }) });

    const routes = await rebuildRouteIndex(storageRoot);
    expect(routes).toHaveLength(1);
    expect(await readFile(path.join(storageRoot, 'routes', 'index.toon'), 'utf8')).toContain('routes[\nroute{');
    expect(await cleanupObservations(storageRoot)).toBe(1);
  });

  it('validates and quarantines invalid JSON artifacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-quarantine-'));
    const { storageRoot } = await initializeWorkspaceStore(root);
    const invalid = path.join(storageRoot, 'routes', 'bad.json');
    await writeFile(invalid, '{', 'utf8');
    const raw = path.join(storageRoot, 'tools', 'tool', 'observations', 'run');
    await import('node:fs/promises').then((fs) => fs.mkdir(raw, { recursive: true }));
    await writeFile(path.join(raw, 'output.raw.json'), '{', 'utf8');

    expect(await validateArtifacts(storageRoot)).toHaveLength(1);
    expect(await quarantineInvalidArtifacts(storageRoot)).toHaveLength(1);
    expect(await readFile(path.join(raw, 'output.raw.json'), 'utf8')).toBe('{');
  });

  it('compacts schema history and validates TOON pairs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-history-'));
    const { storageRoot } = await initializeWorkspaceStore(root);
    await mediateToolExecution({ workspaceRoot: root, toolId: 'tool.history', input: {}, execute: async () => ({ a: true }) });
    await mediateToolExecution({ workspaceRoot: root, toolId: 'tool.history', input: {}, execute: async () => ({ a: true, b: 1 }) });

    expect(await compactSchemaHistory(storageRoot)).toBeGreaterThanOrEqual(1);
    const summary = JSON.parse(await readFile(path.join(storageRoot, 'tools', 'tool-history', 'history', 'compacted-summary.json'), 'utf8'));
    expect(summary.removed).toBe(1);
    expect(validateCanonicalToonPair({ type: 'object' }, 'drift').valid).toBe(false);
  });
});

describe('schema merging', () => {
  it('updates compatible schema and versions material changes', () => {
    const first = mergeSchema('tool', undefined, { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] }, []);
    const second = mergeSchema('tool', first.schema, { type: 'object', properties: { a: { type: 'string' }, b: { type: 'integer' } }, required: ['a', 'b'] }, []);
    const third = mergeSchema('tool', second.schema, { type: 'array', items: { type: 'string' } }, []);

    expect(second.action).toBe('update-current');
    expect(third.action).toBe('new-version');
    expect(third.schema.version).toBe(2);
  });
});
