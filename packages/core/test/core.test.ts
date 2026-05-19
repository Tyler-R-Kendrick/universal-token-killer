import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  initializeWorkspaceStore,
  inferSchema,
  inferTextPseudoSchema,
  mediateToolExecution,
  deterministicRoute,
  extractRules,
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
});
