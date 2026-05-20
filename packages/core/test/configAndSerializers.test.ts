import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadUtkConfig, resolveRegisteredTool, resolveSerializerProviderId } from '../src/config/config.js';
import {
  createSerializationRegistry,
  getSerializationProvider,
  getSerializerGrammar,
  loadSerializationRegistry,
  listSerializationProviders,
  registerBuiltInSerializerPlugins,
  registerSerializationProvider,
  serializedExtension
} from '../src/serialization/providers.js';
import { registerUtkSerializerPlugin as registerCompressedJsonPlugin } from '../src/serialization/plugins/compressedJson.js';
import { registerUtkSerializerPlugin as registerToonPlugin } from '../src/serialization/plugins/toon.js';
import { registerUtkSerializerPlugin as registerTronPlugin } from '../src/serialization/plugins/tron.js';

describe('UTK TOML config', () => {
  it('creates and uses TOON defaults when config is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-default-'));
    const config = await loadUtkConfig(root);

    expect(config.serialization.default).toBe('toon');
    expect(resolveSerializerProviderId(config, 'tool.any')).toBe('toon');
    expect(await readFile(path.join(root, '.utk', 'config.toml'), 'utf8')).toContain('[serialization]');
    expect(config.serialization.providers.tron.enabled).toBe(true);
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

  it('supports tron default and per-tool provider overrides', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-tron-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
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
        '',
        '[[serialization.overrides]]',
        'tool = "tool.json"',
        'provider = "compressed-json"',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(resolveSerializerProviderId(config, 'tool.any')).toBe('tron');
    expect(resolveSerializerProviderId(config, 'tool.json')).toBe('compressed-json');
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

  it('uses exact serializer overrides before wildcard overrides regardless of config order', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-exact-before-wildcard-'));
    await mkdir(path.join(root, '.utk'), { recursive: true });
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[[serialization.overrides]]',
        'tool = "shell.*"',
        'provider = "compressed-json"',
        '',
        '[[serialization.overrides]]',
        'tool = "shell.git.diff"',
        'provider = "tron"',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(resolveSerializerProviderId(config, 'shell.git.diff')).toBe('tron');
    expect(resolveSerializerProviderId(config, 'shell.git.status')).toBe('compressed-json');
  });

  it('fails explicitly for invalid providers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-invalid-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
    await writeFile(path.join(root, '.utk', 'config.toml'), '[serialization]\ndefault = "yaml"\n', 'utf8');

    const config = await loadUtkConfig(root);
    expect(() => resolveSerializerProviderId(config, 'tool.any')).toThrow('Unsupported serialization provider: yaml. Loaded providers: compressed-json, toon, tron');

    const malformed = await mkdtemp(path.join(os.tmpdir(), 'utk-config-invalid-provider-value-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(malformed, '.utk'), { recursive: true }));
    await writeFile(path.join(malformed, '.utk', 'config.toml'), '[serialization]\ndefault = 1\n', 'utf8');

    await expect(loadUtkConfig(malformed)).rejects.toThrow('Unsupported serialization provider: 1');
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

  it('supports registered tool field and cache annotations with wildcard fallback', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-tools-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[[tools.registry]]',
        'tool = "tool.alpha"',
        'description = "alpha tool"',
        'output_cache = true',
        'bypass_on_cache = true',
        'curry_fields = ["query"]',
        '',
        '[[tools.registry.structured_fields]]',
        'name = "query"',
        'completions = ["alpha:one alpha:two"]',
        'required = true',
        'description = "alpha query"',
        '',
        '[[tools.registry]]',
        'tool = "tool.beta.*"',
        'output_cache = false',
        '[[tools.registry.structured_fields]]',
        'name = "expr"',
        'completions = ["beta one two"]',
        '',
        '[[tools.registry]]',
        'tool = "tool.gamma"',
        'output_cache = false',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(config.tools.registry).toHaveLength(3);
    expect(config.tools.registry[0]).toMatchObject({
      tool: 'tool.alpha',
      output_cache: true,
      bypass_on_cache: true,
      curry_fields: ['query']
    });
    expect(config.tools.registry[0]?.structured_fields[0]).toMatchObject({
      name: 'query',
      completions: ['alpha:one alpha:two'],
      required: true
    });
    expect(resolveRegisteredTool(config, 'tool.alpha')?.tool).toBe('tool.alpha');
    expect(resolveRegisteredTool(config, 'tool.beta.analytics')?.tool).toBe('tool.beta.*');
    expect(resolveRegisteredTool(config, 'tool.gamma')?.structured_fields).toEqual([]);
    expect(resolveRegisteredTool(config, 'tool.unknown')).toBeUndefined();
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

  it('fails explicitly for malformed tool registry shapes', async () => {
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
    expect(provider.estimateTokens('abcd')).toBe(1);
    expect(serializedExtension('compressed-json')).toBe('json');
  });

  it('uses official TRON parse/stringify for round trips and exposes grammar', () => {
    const provider = getSerializationProvider('tron');
    const value = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
    const serialized = provider.serialize(value, { toolId: 'tool.tron' });

    expect(serialized).toContain('class');
    expect(provider.deserialize(serialized, { toolId: 'tool.tron' })).toEqual(value);
    expect(provider.validate(value, serialized).valid).toBe(true);
    expect(provider.validate(value, 'not tron').valid).toBe(false);
    expect(provider.validate(value, provider.serialize([{ a: 1, b: 9 }], { toolId: 'tool.tron' })).errors).toContain('TRON artifact drifted from canonical value');
    expect(provider.estimateTokens('abcd')).toBe(1);
    expect(serializedExtension('tron')).toBe('tron');
    expect(getSerializerGrammar('tron')?.format).toBe('lark');
    expect(getSerializerGrammar('tron')?.source).toContain('start:');
  });

  it('validates registry providers and rejects duplicates', () => {
    const registry = createSerializationRegistry();
    expect(registry.list().map((provider) => provider.id)).toEqual(['toon', 'compressed-json', 'tron']);
    expect(() => registry.register(getSerializationProvider('tron'))).toThrow('Serialization provider already registered: tron');
    expect(() => registry.register(null as never)).toThrow('Serialization provider must be an object');
    expect(() => registry.register({ id: 'Bad', extension: 'bad' } as never)).toThrow('Serialization provider has invalid id: Bad');
    expect(() => registry.register({ id: 'bad', extension: 'bad' } as never)).toThrow('Serialization provider bad is missing serialize');
    expect(() => registry.register({ ...getSerializationProvider('compressed-json'), id: 'bad-ext', extension: '../json' })).toThrow('Serialization provider bad-ext has invalid extension');
    expect(() => registry.register({ ...getSerializationProvider('compressed-json'), id: 'bad-grammar', grammar: { format: 'peg' as 'lark', source: 'start: value' } })).toThrow('Serialization provider bad-grammar has unsupported grammar format');
    expect(() => registry.register({ ...getSerializationProvider('compressed-json'), id: 'empty-grammar', grammar: { format: 'lark', source: ' ' } })).toThrow('Serialization provider empty-grammar has empty grammar source');
    expect(() => registry.require('missing')).toThrow('Unsupported serialization provider: missing. Loaded providers: compressed-json, toon, tron');
  });

  it('dogfoods built-in serializers through the plugin registrar contract', () => {
    expect(typeof registerToonPlugin).toBe('function');
    expect(typeof registerCompressedJsonPlugin).toBe('function');
    expect(typeof registerTronPlugin).toBe('function');

    const registry = createSerializationRegistry({ includeBuiltIns: false });
    expect(registry.list()).toEqual([]);

    registerBuiltInSerializerPlugins(registry);

    expect(registry.list().map((provider) => provider.id)).toEqual(['toon', 'compressed-json', 'tron']);
    expect(() => registerBuiltInSerializerPlugins(registry)).toThrow('Serialization provider already registered: toon');
  });

  it('keeps serializer implementations in plugin modules instead of registry core', async () => {
    const providersSource = await readFile(path.resolve(import.meta.dirname, '../src/serialization/providers.ts'), 'utf8');
    const toonSource = await readFile(path.resolve(import.meta.dirname, '../src/serialization/plugins/toon.ts'), 'utf8');
    const tronSource = await readFile(path.resolve(import.meta.dirname, '../src/serialization/plugins/tron.ts'), 'utf8');
    const compressedJsonSource = await readFile(path.resolve(import.meta.dirname, '../src/serialization/plugins/compressedJson.ts'), 'utf8');

    expect(providersSource).not.toContain('@toon-format/toon');
    expect(providersSource).not.toContain('@tron-format/tron');
    expect(providersSource).not.toContain('const builtInProviders');
    expect(toonSource).toContain('@toon-format/toon');
    expect(tronSource).toContain('@tron-format/tron');
    expect(compressedJsonSource).toContain('sortValue');
  });

  it('supports process-level serializer registration for embedders', () => {
    registerSerializationProvider({
      id: 'process-demo',
      extension: 'pdemo',
      serialize(value) {
        return JSON.stringify(value);
      },
      deserialize(text) {
        return JSON.parse(text) as unknown;
      },
      validate() {
        return { valid: true, errors: [] };
      },
      estimateTokens(text) {
        return Math.ceil(text.length / 4);
      }
    });

    expect(listSerializationProviders().map((provider) => provider.id)).toContain('process-demo');
    expect(getSerializationProvider('process-demo').extension).toBe('pdemo');
  });

  it('auto-loads installed serializer plugin packages from package manifests', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-registry-'));
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { 'utk-serializer-demo': '1.0.0' } }),
      'utf8'
    );
    await writeSerializerPluginPackage(root, 'utk-serializer-demo', 'demo');

    const registry = await loadSerializationRegistry(root);

    expect(registry.require('demo').serialize({ ok: true }, { toolId: 'tool.demo' })).toBe('{"ok":true}');
  });

  it('resolves auto-loaded plugin providers as defaults and enforces disabled plugin providers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-config-default-'));
    await mkdir(path.join(root, '.utk'), { recursive: true });
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'utk-serializer-demo': '1.0.0' } }), 'utf8');
    await writeSerializerPluginPackage(root, 'utk-serializer-demo', 'demo');
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

    const registry = await loadSerializationRegistry(root);
    const config = await loadUtkConfig(root);

    expect(resolveSerializerProviderId(config, 'tool.any', registry)).toBe('demo');

    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "demo"',
        '',
        '[serialization.providers.demo]',
        'enabled = false',
        ''
      ].join('\n'),
      'utf8'
    );
    const disabledConfig = await loadUtkConfig(root);

    expect(() => resolveSerializerProviderId(disabledConfig, 'tool.any', registry)).toThrow('Serialization provider is disabled: demo');
  });

  it('rejects auto-loaded plugins that collide with built-in provider ids', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-collision-'));
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'utk-serializer-toon': '1.0.0' } }), 'utf8');
    await writeSerializerPluginPackage(root, 'utk-serializer-toon', 'toon');

    await expect(loadSerializationRegistry(root)).rejects.toThrow('Serialization provider already registered: toon');
  });

  it('ignores non-serializer dependency names during plugin auto-load', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-ignore-'));
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { leftpad: '1.0.0' } }), 'utf8');

    const registry = await loadSerializationRegistry(root);

    expect(registry.list().map((provider) => provider.id)).toEqual(['toon', 'compressed-json', 'tron']);
  });

  it('fails clearly when serializer plugin package lacks registrar export', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-bad-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, 'node_modules', '@utk', 'serializer-bad'), { recursive: true }));
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ devDependencies: { '@utk/serializer-bad': '1.0.0' } }), 'utf8');
    await writeFile(
      path.join(root, 'node_modules', '@utk', 'serializer-bad', 'package.json'),
      JSON.stringify({ name: '@utk/serializer-bad', version: '1.0.0', type: 'module', main: './index.js' }),
      'utf8'
    );
    await writeFile(path.join(root, 'node_modules', '@utk', 'serializer-bad', 'index.js'), 'export const nope = true;\n', 'utf8');

    await expect(loadSerializationRegistry(root)).rejects.toThrow('Serializer plugin @utk/serializer-bad must export registerUtkSerializerPlugin');
  });

  it('fails clearly when declared serializer plugin package is not installed', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-missing-'));
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'utk-serializer-missing': '1.0.0' } }), 'utf8');

    await expect(loadSerializationRegistry(root)).rejects.toThrow('Serializer plugin utk-serializer-missing could not be resolved');
  });
});

async function writeSerializerPluginPackage(root: string, packageName: string, providerId: string): Promise<void> {
  const packageRoot = packageName.startsWith('@')
    ? path.join(root, 'node_modules', ...packageName.split('/'))
    : path.join(root, 'node_modules', packageName);
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({ name: packageName, version: '1.0.0', type: 'module', main: './index.js' }),
    'utf8'
  );
  await writeFile(
    path.join(packageRoot, 'index.js'),
    [
      'export function registerUtkSerializerPlugin(registry) {',
      '  registry.register({',
      `    id: ${JSON.stringify(providerId)},`,
      '    extension: "demo",',
      '    serialize(value) { return JSON.stringify(value); },',
      '    deserialize(text) { return JSON.parse(text); },',
      '    validate() { return { valid: true, errors: [] }; },',
      '    estimateTokens(text) { return Math.ceil(text.length / 4); }',
      '  });',
      '}'
    ].join('\n'),
    'utf8'
  );
}
