import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadUtkConfig, resolveSerializerProviderId } from '../src/config/config.js';
import { getSerializationProvider, serializedExtension } from '../src/serialization/providers.js';

describe('UTK TOML config', () => {
  it('creates and uses TOON defaults when config is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-default-'));
    const config = await loadUtkConfig(root);

    expect(config.serialization.default).toBe('toon');
    expect(resolveSerializerProviderId(config, 'tool.any')).toBe('toon');
    expect(await readFile(path.join(root, '.utk', 'config.toml'), 'utf8')).toContain('[serialization]');
  });

  it('supports compressed-json default and per-tool provider overrides', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-override-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
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
        '[[serialization.overrides]]',
        'tool = "tool.toon"',
        'provider = "toon"',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(resolveSerializerProviderId(config, 'tool.any')).toBe('compressed-json');
    expect(resolveSerializerProviderId(config, 'tool.toon')).toBe('toon');
  });

  it('supports wildcard overrides and explicit disabled-provider errors', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-wildcard-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[serialization.providers.toon]',
        'enabled = true',
        '',
        '[serialization.providers.compressed-json]',
        'enabled = true',
        '',
        '[[serialization.overrides]]',
        'tool = "shell.git.*"',
        'provider = "compressed-json"',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(resolveSerializerProviderId(config, 'shell.git.status')).toBe('compressed-json');

    const disabled = await mkdtemp(path.join(os.tmpdir(), 'utk-config-disabled-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(disabled, '.utk'), { recursive: true }));
    await writeFile(path.join(disabled, '.utk', 'config.toml'), '[serialization]\ndefault = "compressed-json"\n[serialization.providers.compressed-json]\nenabled = false\n', 'utf8');
    const disabledConfig = await loadUtkConfig(disabled);
    expect(() => resolveSerializerProviderId(disabledConfig, 'tool.any')).toThrow('Serialization provider is disabled: compressed-json');
  });

  it('fails explicitly for invalid providers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-invalid-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
    await writeFile(path.join(root, '.utk', 'config.toml'), '[serialization]\ndefault = "yaml"\n', 'utf8');

    await expect(loadUtkConfig(root)).rejects.toThrow('Unsupported serialization provider: yaml');
  });

  it('fails explicitly for malformed serialization tables and overrides', async () => {
    const badSerialization = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-serialization-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badSerialization, '.utk'), { recursive: true }));
    await writeFile(path.join(badSerialization, '.utk', 'config.toml'), 'serialization = "bad"\n', 'utf8');

    await expect(loadUtkConfig(badSerialization)).rejects.toThrow('serialization must be a TOML table');

    const badOverrides = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-overrides-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badOverrides, '.utk'), { recursive: true }));
    await writeFile(path.join(badOverrides, '.utk', 'config.toml'), '[serialization]\ndefault = "toon"\noverrides = "bad"\n', 'utf8');

    await expect(loadUtkConfig(badOverrides)).rejects.toThrow('serialization.overrides must be an array');
  });

  it('uses fallback defaults for omitted optional settings', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-fallbacks-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
    await writeFile(path.join(root, '.utk', 'config.toml'), '[serialization]\n', 'utf8');

    const config = await loadUtkConfig(root);

    expect(config.serialization.default).toBe('toon');
    expect(config.routing.deterministic_confidence_threshold).toBe(0.95);
    expect(config.persistence.storage_root).toBe('.utk');
  });
});

describe('serialization providers', () => {
  it('uses official TOON encode/decode for round trips', () => {
    const provider = getSerializationProvider('toon');
    const value = { users: [{ id: 2, name: 'Bob' }, { id: 1, name: 'Ada' }] };
    const serialized = provider.serialize(value, { toolId: 'tool.users' });

    expect(serialized).toContain('users[2]');
    expect(serialized).not.toContain('schema{');
    expect(provider.deserialize(serialized, { toolId: 'tool.users' })).toEqual(value);
    expect(provider.validate(value, serialized).valid).toBe(true);
    expect(provider.validate(value, 'route:\n  [').valid).toBe(false);
    expect(provider.validate(value, provider.serialize({ users: [] }, { toolId: 'tool.users' })).errors).toContain('TOON artifact drifted from canonical value');
    expect(provider.estimateTokens('abcd')).toBe(1);
  });

  it('uses deterministic compressed JSON with stable keys', () => {
    const provider = getSerializationProvider('compressed-json');
    const value = { b: 2, a: { d: 4, c: 3 } };
    const serialized = provider.serialize(value, { toolId: 'tool.json' });

    expect(serialized).toBe('{"a":{"c":3,"d":4},"b":2}');
    expect(JSON.parse(serialized)).toEqual({ a: { c: 3, d: 4 }, b: 2 });
    expect(provider.deserialize(serialized, { toolId: 'tool.json' })).toEqual({ a: { c: 3, d: 4 }, b: 2 });
    expect(provider.validate(value, serialized).valid).toBe(true);
    expect(provider.validate(value, '{"b":2,"a":{"d":4,"c":3}}').valid).toBe(false);
    expect(provider.validate(value, '{"b":2,"a":{"d":4,"c":3}}').regenerated).toBe(serialized);
    expect(serializedExtension('compressed-json')).toBe('json');
  });
});
