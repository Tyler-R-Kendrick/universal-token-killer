import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadUtkConfig, resolveRegisteredTool, resolveSerializerProviderId } from '../src/config/config.js';
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
    expect(config.detok.enabled).toBe(true);
    expect(config.detok.copilot_pre_tool_use.enabled).toBe(true);
    expect(config.detok.copilot_pre_tool_use.rewrite_fields).toContain('prompt');
    expect(config.detok.copilot_pre_tool_use.protected_fields).toContain('command');
    expect(config.tools.registry).toEqual([]);
  });

  it('supports registered tool grammar and cache annotations with wildcard fallback', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-tools-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[[tools.registry]]',
        'tool = "github.search.issues"',
        'description = "Search issue index"',
        'output_cache = true',
        'bypass_on_cache = true',
        'curry_fields = ["query"]',
        '',
        '[[tools.registry.structured_fields]]',
        'name = "query"',
        'grammar = "lucene"',
        'completions = ["is:issue is:open"]',
        'required = true',
        'description = "lucene issue query"',
        '',
        '[[tools.registry]]',
        'tool = "db.query.*"',
        'output_cache = false',
        '[[tools.registry.structured_fields]]',
        'name = "sql"',
        'grammar = "sql"',
        'completions = ["select * from issues"]',
        '',
        '[[tools.registry]]',
        'tool = "regex.find"',
        'output_cache = false',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(config.tools.registry).toHaveLength(3);
    expect(config.tools.registry[0]).toMatchObject({
      tool: 'github.search.issues',
      output_cache: true,
      bypass_on_cache: true,
      curry_fields: ['query']
    });
    expect(config.tools.registry[0]?.structured_fields[0]).toMatchObject({
      name: 'query',
      grammar: 'lucene',
      completions: ['is:issue is:open'],
      required: true
    });
    expect(resolveRegisteredTool(config, 'github.search.issues')?.tool).toBe('github.search.issues');
    expect(resolveRegisteredTool(config, 'db.query.analytics')?.tool).toBe('db.query.*');
    expect(resolveRegisteredTool(config, 'regex.find')?.structured_fields).toEqual([]);
    expect(resolveRegisteredTool(config, 'db.other')).toBeUndefined();
  });

  it('supports detok preToolUse configuration and per-tool overrides', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-detok-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[detok]',
        'enabled = false',
        '',
        '[detok.copilot_pre_tool_use]',
        'enabled = true',
        'rate = 0.25',
        'min_chars = 42',
        'deny_tools = ["bash"]',
        'rewrite_fields = ["task"]',
        'protected_fields = ["command"]',
        '',
        '[[detok.copilot_pre_tool_use.overrides]]',
        'tool = "agent.special"',
        'enabled = true',
        'rewrite_fields = ["customPrompt"]',
        'protected_fields = ["path"]',
        '',
        '[[detok.copilot_pre_tool_use.overrides]]',
        'tool = "agent.default"',
        'rewrite_fields = ["message"]',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(config.detok.enabled).toBe(false);
    expect(config.detok.copilot_pre_tool_use.rate).toBe(0.25);
    expect(config.detok.copilot_pre_tool_use.min_chars).toBe(42);
    expect(config.detok.copilot_pre_tool_use.deny_tools).toEqual(['bash']);
    expect(config.detok.copilot_pre_tool_use.rewrite_fields).toEqual(['task']);
    expect(config.detok.copilot_pre_tool_use.overrides).toEqual([
      {
        tool: 'agent.special',
        enabled: true,
        rewrite_fields: ['customPrompt'],
        protected_fields: ['path']
      },
      {
        tool: 'agent.default',
        rewrite_fields: ['message']
      }
    ]);
  });

  it('fails explicitly for malformed detok tables and arrays', async () => {
    const badDetok = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-detok-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badDetok, '.utk'), { recursive: true }));
    await writeFile(path.join(badDetok, '.utk', 'config.toml'), 'detok = "bad"\n[serialization]\n', 'utf8');

    await expect(loadUtkConfig(badDetok)).rejects.toThrow('detok must be a TOML table');

    const badFields = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-fields-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badFields, '.utk'), { recursive: true }));
    await writeFile(path.join(badFields, '.utk', 'config.toml'), '[serialization]\n[detok.copilot_pre_tool_use]\nrewrite_fields = "prompt"\n', 'utf8');

    await expect(loadUtkConfig(badFields)).rejects.toThrow('detok.copilot_pre_tool_use.rewrite_fields must be an array of strings');

    const badOverrides = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-detok-overrides-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badOverrides, '.utk'), { recursive: true }));
    await writeFile(path.join(badOverrides, '.utk', 'config.toml'), '[serialization]\n[detok.copilot_pre_tool_use]\noverrides = "bad"\n', 'utf8');

    await expect(loadUtkConfig(badOverrides)).rejects.toThrow('detok.copilot_pre_tool_use.overrides must be an array');
  });

  it('fails explicitly for malformed tool registry and unsupported grammars', async () => {
    const badRegistry = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-tools-registry-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badRegistry, '.utk'), { recursive: true }));
    await writeFile(path.join(badRegistry, '.utk', 'config.toml'), '[serialization]\n[tools]\nregistry = "bad"\n', 'utf8');
    await expect(loadUtkConfig(badRegistry)).rejects.toThrow('tools.registry must be an array');

    const badFields = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-tools-fields-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badFields, '.utk'), { recursive: true }));
    await writeFile(
      path.join(badFields, '.utk', 'config.toml'),
      '[serialization]\n[[tools.registry]]\ntool = "x"\nstructured_fields = "bad"\n',
      'utf8'
    );
    await expect(loadUtkConfig(badFields)).rejects.toThrow('tools.registry[].structured_fields must be an array');

    const badGrammar = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-tools-grammar-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badGrammar, '.utk'), { recursive: true }));
    await writeFile(
      path.join(badGrammar, '.utk', 'config.toml'),
      [
        '[serialization]',
        '[[tools.registry]]',
        'tool = "x"',
        '',
        '[[tools.registry.structured_fields]]',
        'name = "query"',
        'grammar = "jsonpath"',
        ''
      ].join('\n'),
      'utf8'
    );
    await expect(loadUtkConfig(badGrammar)).rejects.toThrow('Unsupported structured grammar: jsonpath');
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
