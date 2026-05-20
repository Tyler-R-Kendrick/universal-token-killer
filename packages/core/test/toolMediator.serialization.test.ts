import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { initializeWorkspaceStore, mediateToolExecution } from '../src/index.js';

describe('tool mediation serialization', () => {
  it('returns serializer metadata and persists serialized TOON output', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-mediate-serializer-'));
    await initializeWorkspaceStore(root);

    const result = await mediateToolExecution({
      workspaceRoot: root,
      toolId: 'tool.structured',
      input: { id: 1 },
      execute: async () => ({ users: [{ id: 1, name: 'Ada' }] })
    });

    expect(result.serializerId).toBe('toon');
    expect(result.serializedPath.endsWith('output.compact.toon')).toBe(true);
    expect(await readFile(result.serializedPath, 'utf8')).toContain('keys[1]: users');
    expect(result.response).toContain('Serializer: toon');
  });

  it('returns serializer metadata and persists serialized TRON output', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-mediate-tron-'));
    await initializeWorkspaceStore(root);
    await mkdir(path.join(root, '.utk'), { recursive: true });
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "tron"',
        '',
        '[serialization.providers.toon]',
        'enabled = true',
        '',
        '[serialization.providers.compressed-json]',
        'enabled = true',
        '',
        '[serialization.providers.tron]',
        'enabled = true',
        ''
      ].join('\n'),
      'utf8'
    );

    const result = await mediateToolExecution({
      workspaceRoot: root,
      toolId: 'tool.structured',
      input: { id: 1 },
      execute: async () => ({ users: [{ id: 1, name: 'Ada' }] })
    });

    expect(result.serializerId).toBe('tron');
    expect(result.serializedPath.endsWith('output.compact.tron')).toBe(true);
    expect(await readFile(result.serializedPath, 'utf8')).toContain('keys');
    expect(result.response).toContain('Serializer: tron');
  });

  it('returns serializer metadata and persists serialized compressed JSON output', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-mediate-compressed-json-'));
    await initializeWorkspaceStore(root);
    await mkdir(path.join(root, '.utk'), { recursive: true });
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "compressed-json"',
        '',
        '[serialization.providers.toon]',
        'enabled = true',
        '',
        '[serialization.providers.compressed-json]',
        'enabled = true',
        '',
        '[serialization.providers.tron]',
        'enabled = true',
        ''
      ].join('\n'),
      'utf8'
    );

    const result = await mediateToolExecution({
      workspaceRoot: root,
      toolId: 'tool.structured',
      input: { id: 1 },
      execute: async () => ({ users: [{ id: 1, name: 'Ada' }] })
    });

    expect(result.serializerId).toBe('compressed-json');
    expect(result.serializedPath.endsWith('output.compact.json')).toBe(true);
    expect(await readFile(result.serializedPath, 'utf8')).toBe('{"k":"object","keys":["users"]}\n');
    expect(result.response).toContain('Serializer: compressed-json');
  });

  it('persists output through an auto-loaded plugin serializer', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-mediate-plugin-'));
    await initializeWorkspaceStore(root);
    await mkdir(path.join(root, '.utk'), { recursive: true });
    await mkdir(path.join(root, 'node_modules', 'utk-serializer-demo'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'utk-serializer-demo': '1.0.0' } }), 'utf8');
    await writeFile(
      path.join(root, 'node_modules', 'utk-serializer-demo', 'package.json'),
      JSON.stringify({ name: 'utk-serializer-demo', version: '1.0.0', type: 'module', main: './index.js' }),
      'utf8'
    );
    await writeFile(
      path.join(root, 'node_modules', 'utk-serializer-demo', 'index.js'),
      [
        'export function registerUtkSerializerPlugin(registry) {',
        '  registry.register({',
        '    id: "demo",',
        '    extension: "demo",',
        '    serialize(value) { return `demo:${JSON.stringify(value)}`; },',
        '    deserialize(text) { return JSON.parse(text.slice(5)); },',
        '    validate(value, text) { return text === `demo:${JSON.stringify(value)}` ? { valid: true, errors: [] } : { valid: false, errors: ["demo drift"] }; },',
        '    estimateTokens(text) { return Math.ceil(text.length / 4); }',
        '  });',
        '}'
      ].join('\n'),
      'utf8'
    );
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "demo"',
        '',
        '[serialization.providers.demo]',
        'enabled = true',
        ''
      ].join('\n'),
      'utf8'
    );

    const result = await mediateToolExecution({
      workspaceRoot: root,
      toolId: 'tool.plugin',
      input: { id: 1 },
      execute: async () => ({ users: [{ id: 1, name: 'Ada' }] })
    });

    expect(result.serializerId).toBe('demo');
    expect(result.serializedPath.endsWith('output.compact.demo')).toBe(true);
    expect(await readFile(result.serializedPath, 'utf8')).toBe('demo:{"k":"object","keys":["users"]}\n');
    expect(JSON.parse(await readFile(path.join(path.dirname(result.serializedPath), 'output.compact.validation.json'), 'utf8'))).toMatchObject({ valid: true });
    expect(result.response).toContain('Serializer: demo');
  });
});
