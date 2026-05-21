import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadUtkConfig, resolveRegisteredTool, resolveSerializerProviderId } from '../src/config/config.js';
import {
  createSerializationRegistry,
  getSerializationProvider,
  getSerializerGrammar,
  loadSerializationPluginManifest,
  loadSerializationRegistry,
  listSerializationProviders,
  registerBuiltInSerializerPlugins,
  registerSerializationProvider,
  serializedExtension
} from '../src/serialization/providers.js';
import { TOON_SERIALIZER } from '../../plugins/serialization/toon/index.js';
import { TRON_SERIALIZER } from '../../plugins/serialization/tron/index.js';

describe('UTK TOML config', () => {
  it('creates and uses TOON defaults when config is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-default-'));
    const config = await loadUtkConfig(root);

    expect(config.serialization.default).toBe('toon');
    expect(resolveSerializerProviderId(config, 'tool.any')).toBe('toon');
    expect(await readFile(path.join(root, '.utk', 'config.toml'), 'utf8')).toContain('[serialization]');
    expect(config.serialization.providers.tron.enabled).toBe(true);
    expect(config.plugins.serialization_paths).toContain('.utk/plugins/serialization');
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
        '[serialization.providers.json-compact]',
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

    expect(resolveSerializerProviderId(config, 'tool.any')).toBe('json-compact');
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
    expect(resolveSerializerProviderId(config, 'tool.json')).toBe('json-compact');
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

    expect(resolveSerializerProviderId(config, 'shell.git.status')).toBe('json-compact');

    const disabled = await mkdtemp(path.join(os.tmpdir(), 'utk-config-disabled-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(disabled, '.utk'), { recursive: true }));
    await writeFile(path.join(disabled, '.utk', 'config.toml'), '[serialization]\ndefault = "compressed-json"\n[serialization.providers.compressed-json]\nenabled = false\n', 'utf8');
    const disabledConfig = await loadUtkConfig(disabled);
    expect(() => resolveSerializerProviderId(disabledConfig, 'tool.any')).toThrow('Serialization provider is disabled: json-compact');
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
    expect(resolveSerializerProviderId(config, 'shell.git.status')).toBe('json-compact');
  });

  it('fails explicitly for invalid providers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-invalid-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
    await writeFile(path.join(root, '.utk', 'config.toml'), '[serialization]\ndefault = "yaml"\n', 'utf8');

    const config = await loadUtkConfig(root);
    expect(() => resolveSerializerProviderId(config, 'tool.any')).toThrow('Unsupported serialization provider: yaml. Loaded providers: json-compact, toon, tron');

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
    expect(config.model_proxy.enabled).toBe(true);
    expect(config.model_proxy.host).toBe('127.0.0.1');
    expect(config.model_proxy.port).toBe(8787);
    expect(config.model_proxy.upstream_provider).toBe('github-models');
    expect(config.model_proxy.upstream_base_url).toBe('https://models.github.ai/inference');
    expect(config.model_proxy.upstream_api_version).toBe('2026-03-10');
    expect(config.model_proxy.upstream_organization).toBe('');
    expect(config.model_proxy.compression_level).toBe('standard');
    expect(config.model_proxy.inject_expand_context).toBe(true);
    expect(config.model_proxy.minimize_tool_schemas).toBe(true);
    expect(config.model_proxy.expand_edit_ranges).toBe(true);
    expect(config.model_proxy.tool_discovery_mode).toBe('static-filter');
    expect(config.model_proxy.cache_volatility).toBe('observe');
    expect(config.model_proxy.session_id_header).toBe('x-utk-session-id');
    expect(config.model_proxy.history_compaction_enabled).toBe(true);
    expect(config.model_proxy.history_compaction_threshold).toBe(0.75);
    expect(config.model_proxy.session_blocks_enabled).toBe(true);
    expect(config.model_proxy.history_compaction_mode).toBe('replace-with-summary-block');
    expect(config.model_proxy.dedupe_policy).toBe('compact');
    expect(config.model_proxy.stale_error_policy).toBe('compact');
    expect(config.model_proxy.purge_error_after_turns).toBe(4);
    expect(config.model_proxy.artifact_search_enabled).toBe(true);
    expect(config.model_proxy.context_proofs_enabled).toBe(true);
    expect(config.model_proxy.deferred_tool_search_enabled).toBe(true);
    expect(config.model_proxy.provider_strict_mode).toBe(false);
    expect(config.model_proxy.prompt_asset_style).toBe('pipe-index');
    expect(config.model_proxy.remote_compressors_enabled).toBe(false);
    expect(config.model_proxy.prompt_compression_enabled).toBe(true);
    expect(config.model_proxy.prompt_compression_provider).toBe('github-models');
    expect(config.model_proxy.prompt_compression_model).toBe('openai/gpt-4.1');
    expect(config.model_proxy.prompt_compression_base_url).toBe('https://models.github.ai/inference');
    expect(config.model_proxy.prompt_compression_api_version).toBe('2026-03-10');
    expect(config.model_proxy.prompt_compression_min_tokens).toBe(64);
    expect(config.model_proxy.prompt_compression_timeout_ms).toBe(2500);
    expect(config.model_proxy.protected_fields).toContain('command');
    expect(config.model_proxy.protected_tools).toContain('apply_patch');
    expect(config.model_proxy.protected_file_patterns).toContain('*.pem');
    expect(config.model_proxy.deny_tools).toContain('auth*');
    expect(config.prompt_optimization.enabled).toBe(true);
    expect(config.prompt_optimization.surfaces).toContain('system-prompt');
    expect(config.prompt_optimization.min_tokens).toBe(256);
    expect(config.prompt_optimization.target_ratio).toBe(0.5);
    expect(config.prompt_optimization.persist_originals).toBe(true);
    expect(config.prompt_optimization.cache_volatility).toBe('observe');
    expect(config.prompt_optimization.asset_style).toBe('pipe-index');
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

  it('normalizes detoks-prompt model settings from config', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-detok-prompt-'));
    await mkdir(path.join(root, '.utk'), { recursive: true });
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[detok.prompt]',
        'model = "Hugging-Face/Kompress-small"',
        'rate = 2',
        'min_chars = -4.8',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(config.detok.prompt.model).toBe('Hugging-Face/Kompress-small');
    expect(config.detok.prompt.rate).toBe(1);
    expect(config.detok.prompt.min_chars).toBe(0);
  });

  it('rejects non-finite detok prompt numbers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-detok-prompt-nonfinite-'));
    await mkdir(path.join(root, '.utk'), { recursive: true });
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[detok.prompt]',
        'rate = inf',
        'min_chars = 0',
        ''
      ].join('\n'),
      'utf8'
    );

    await expect(loadUtkConfig(root)).rejects.toThrow('detok.prompt.rate must be a finite number');
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

  it('supports model proxy configuration', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-config-model-proxy-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(root, '.utk'), { recursive: true }));
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "toon"',
        '',
        '[model_proxy]',
        'enabled = false',
        'host = "0.0.0.0"',
        'port = 9999',
        'upstream_provider = "azure-ai-inference"',
        'upstream_base_url = "https://example.services.ai.azure.com/models"',
        'upstream_api_version = "2024-05-01-preview"',
        'upstream_organization = "octo-org"',
        'compression_level = "lite"',
        'min_tokens = 512',
        'reserve_output_tokens = 2048',
        'tool_discovery_mode = "deferred-search"',
        'cache_volatility = "observe"',
        'session_id_header = "x-session"',
        'history_compaction_enabled = false',
        'history_compaction_mode = "replace-with-summary-block"',
        'history_compaction_threshold = 0.80',
        'session_blocks_enabled = false',
        'dedupe_policy = "off"',
        'stale_error_policy = "observe"',
        'purge_error_after_turns = 7',
        'artifact_search_enabled = false',
        'context_proofs_enabled = false',
        'deferred_tool_search_enabled = false',
        'provider_strict_mode = true',
        'prompt_asset_style = "pipe-index"',
        'remote_compressors_enabled = true',
        'prompt_compression_enabled = true',
        'prompt_compression_provider = "azure-ai-inference"',
        'prompt_compression_model = "mistral-large"',
        'prompt_compression_base_url = "https://example.services.ai.azure.com/models"',
        'prompt_compression_api_version = "2024-05-01-preview"',
        'prompt_compression_min_tokens = 12',
        'prompt_compression_timeout_ms = 1234',
        'inject_expand_context = false',
        'minimize_tool_schemas = false',
        'expand_edit_ranges = false',
        'protected_fields = ["command", "path"]',
        'protected_tools = ["write"]',
        'protected_file_patterns = [".env"]',
        'deny_tools = ["secret.*"]',
        ''
      ].join('\n'),
      'utf8'
    );

    const config = await loadUtkConfig(root);

    expect(config.model_proxy).toEqual({
      enabled: false,
      host: '0.0.0.0',
      port: 9999,
      upstream_provider: 'azure-ai-inference',
      upstream_base_url: 'https://example.services.ai.azure.com/models',
      upstream_api_version: '2024-05-01-preview',
      upstream_organization: 'octo-org',
      compression_level: 'lite',
      min_tokens: 512,
      reserve_output_tokens: 2048,
      tool_discovery_mode: 'deferred-search',
      cache_volatility: 'observe',
      session_id_header: 'x-session',
      history_compaction_enabled: false,
      history_compaction_mode: 'replace-with-summary-block',
      history_compaction_threshold: 0.8,
      session_blocks_enabled: false,
      dedupe_policy: 'off',
      stale_error_policy: 'observe',
      purge_error_after_turns: 7,
      artifact_search_enabled: false,
      context_proofs_enabled: false,
      deferred_tool_search_enabled: false,
      provider_strict_mode: true,
      prompt_asset_style: 'pipe-index',
      remote_compressors_enabled: true,
      prompt_compression_enabled: true,
      prompt_compression_provider: 'azure-ai-inference',
      prompt_compression_model: 'mistral-large',
      prompt_compression_base_url: 'https://example.services.ai.azure.com/models',
      prompt_compression_api_version: '2024-05-01-preview',
      prompt_compression_min_tokens: 12,
      prompt_compression_timeout_ms: 1234,
      inject_expand_context: false,
      minimize_tool_schemas: false,
      expand_edit_ranges: false,
      protected_fields: ['command', 'path'],
      protected_tools: ['write'],
      protected_file_patterns: ['.env'],
      deny_tools: ['secret.*']
    });

    const noPromptVersion = await mkdtemp(path.join(os.tmpdir(), 'utk-config-proxy-no-prompt-version-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(noPromptVersion, '.utk'), { recursive: true }));
    await writeFile(
      path.join(noPromptVersion, '.utk', 'config.toml'),
      '[serialization]\ndefault = "toon"\n\n[model_proxy]\nprompt_compression_provider = "none"\n',
      'utf8'
    );
    expect((await loadUtkConfig(noPromptVersion)).model_proxy.prompt_compression_api_version).toBe('');

    const badLevel = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-proxy-level-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badLevel, '.utk'), { recursive: true }));
    await writeFile(path.join(badLevel, '.utk', 'config.toml'), '[serialization]\n[model_proxy]\ncompression_level = "wild"\n', 'utf8');
    await expect(loadUtkConfig(badLevel)).rejects.toThrow('Unsupported model_proxy compression_level: wild');

    const badDiscovery = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-proxy-discovery-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badDiscovery, '.utk'), { recursive: true }));
    await writeFile(path.join(badDiscovery, '.utk', 'config.toml'), '[serialization]\n[model_proxy]\ntool_discovery_mode = "all"\n', 'utf8');
    await expect(loadUtkConfig(badDiscovery)).rejects.toThrow('Unsupported model_proxy tool_discovery_mode: all');

    const badUpstreamProvider = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-upstream-provider-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badUpstreamProvider, '.utk'), { recursive: true }));
    await writeFile(path.join(badUpstreamProvider, '.utk', 'config.toml'), '[serialization]\n[model_proxy]\nupstream_provider = "bad"\n', 'utf8');
    await expect(loadUtkConfig(badUpstreamProvider)).rejects.toThrow('Unsupported model_proxy upstream_provider: bad');

    const badPromptProvider = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-prompt-provider-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badPromptProvider, '.utk'), { recursive: true }));
    await writeFile(path.join(badPromptProvider, '.utk', 'config.toml'), '[serialization]\n[model_proxy]\nprompt_compression_provider = "bad"\n', 'utf8');
    await expect(loadUtkConfig(badPromptProvider)).rejects.toThrow('Unsupported model_proxy prompt_compression_provider: bad');

    const badVolatility = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-proxy-volatility-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badVolatility, '.utk'), { recursive: true }));
    await writeFile(path.join(badVolatility, '.utk', 'config.toml'), '[serialization]\n[model_proxy]\ncache_volatility = "rewrite"\n', 'utf8');
    await expect(loadUtkConfig(badVolatility)).rejects.toThrow('Unsupported model_proxy cache_volatility: rewrite');

    const badHistoryMode = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-history-mode-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badHistoryMode, '.utk'), { recursive: true }));
    await writeFile(path.join(badHistoryMode, '.utk', 'config.toml'), '[serialization]\n[model_proxy]\nhistory_compaction_mode = "raw"\n', 'utf8');
    await expect(loadUtkConfig(badHistoryMode)).rejects.toThrow('Unsupported model_proxy history_compaction_mode: raw');

    const badDedupe = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-dedupe-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badDedupe, '.utk'), { recursive: true }));
    await writeFile(path.join(badDedupe, '.utk', 'config.toml'), '[serialization]\n[model_proxy]\ndedupe_policy = "delete"\n', 'utf8');
    await expect(loadUtkConfig(badDedupe)).rejects.toThrow('Unsupported model_proxy dedupe_policy: delete');

    const badStale = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-stale-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badStale, '.utk'), { recursive: true }));
    await writeFile(path.join(badStale, '.utk', 'config.toml'), '[serialization]\n[model_proxy]\nstale_error_policy = "delete"\n', 'utf8');
    await expect(loadUtkConfig(badStale)).rejects.toThrow('Unsupported model_proxy stale_error_policy: delete');

    const badPromptStyle = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-prompt-style-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badPromptStyle, '.utk'), { recursive: true }));
    await writeFile(path.join(badPromptStyle, '.utk', 'config.toml'), '[serialization]\n[prompt_optimization]\nasset_style = "paragraphs"\n', 'utf8');
    await expect(loadUtkConfig(badPromptStyle)).rejects.toThrow('Unsupported prompt_optimization asset_style: paragraphs');
  });

  it('fails explicitly for malformed model proxy tables and arrays', async () => {
    const badProxy = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-proxy-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badProxy, '.utk'), { recursive: true }));
    await writeFile(path.join(badProxy, '.utk', 'config.toml'), 'model_proxy = "bad"\n[serialization]\n', 'utf8');

    await expect(loadUtkConfig(badProxy)).rejects.toThrow('model_proxy must be a TOML table');

    const badFields = await mkdtemp(path.join(os.tmpdir(), 'utk-config-bad-proxy-fields-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(badFields, '.utk'), { recursive: true }));
    await writeFile(path.join(badFields, '.utk', 'config.toml'), '[serialization]\n[model_proxy]\nprotected_fields = "command"\n', 'utf8');

    await expect(loadUtkConfig(badFields)).rejects.toThrow('model_proxy.protected_fields must be an array of strings');
  });
});

describe('serialization providers', () => {
  it('uses trusted TOON codec for round trips', () => {
    const provider = getSerializationProvider('toon');
    const registry = createSerializationRegistry();
    const generated = registry.serializers[TOON_SERIALIZER];
    const value = { users: [{ id: 2, name: 'Bob' }, { id: 1, name: 'Ada' }] };
    const serialized = provider.serialize(value, { toolId: 'tool.users' });

    expect(generated?.parser.parse(serialized)).toEqual(value);
    expect(generated?.serializer.serialize(value)).toBe(serialized);
    expect(generated?.linter.lint(serialized)).toMatchObject({ valid: true, ast: value, diagnostics: [] });
    expect(generated?.linter.lint('users[1]:  broken')).toMatchObject({
      valid: false,
      diagnostics: [expect.objectContaining({ code: 'serialization/canonical-drift', severity: 'error' })]
    });
    expect(generated?.linter.lintAst({ bad: Number.NaN })).toMatchObject({
      valid: false,
      diagnostics: [expect.objectContaining({ code: 'serialization/invalid-ast-number', path: '$.bad' })]
    });
    expect(serialized).toContain('users[2]');
    expect(serialized).not.toContain('schema{');
    expect(provider.deserialize(serialized, { toolId: 'tool.users' })).toEqual(value);
    expect(provider.validate(value, serialized).valid).toBe(true);
    expect(provider.validate(value, 'route:\n  [').valid).toBe(false);
    expect(provider.validate(value, provider.serialize({ users: [] }, { toolId: 'tool.users' })).errors).toContain('TOON artifact drifted from canonical value');
    expect(provider.estimateTokens('abcd')).toBe(1);
  });

  it('uses deterministic json-compact with stable keys', () => {
    const provider = getSerializationProvider('json-compact');
    const value = { b: 2, a: { d: 4, c: 3 } };
    const serialized = provider.serialize(value, { toolId: 'tool.json' });

    expect(serialized).toBe('{"a":{"c":3,"d":4},"b":2}');
    expect(JSON.parse(serialized)).toEqual({ a: { c: 3, d: 4 }, b: 2 });
    expect(provider.deserialize(serialized, { toolId: 'tool.json' })).toEqual({ a: { c: 3, d: 4 }, b: 2 });
    expect(provider.validate(value, serialized).valid).toBe(true);
    expect(provider.validate(value, '{"b":2,"a":{"d":4,"c":3}}').valid).toBe(false);
    expect(provider.validate(value, '{"b":2,"a":{"d":4,"c":3}}').regenerated).toBe(serialized);
    expect(provider.estimateTokens('abcd')).toBe(1);
    expect(serializedExtension('json-compact')).toBe('json');
    expect(getSerializationProvider('compressed-json')).toBe(provider);
    expect(serializedExtension('compressed-json')).toBe('json');
  });

  it('uses trusted TRON codec for round trips and exposes grammar', () => {
    const provider = getSerializationProvider('tron');
    const registry = createSerializationRegistry();
    const generated = registry.serializers[TRON_SERIALIZER];
    const value = { k: 'object', keys: ['users'] };
    const serialized = provider.serialize(value, { toolId: 'tool.tron' });

    expect(generated?.parser.parse(serialized)).toEqual(value);
    expect(generated?.linter.lint(serialized)).toMatchObject({ valid: true, ast: value, diagnostics: [] });
    expect(generated?.linter.lint('not tron')).toMatchObject({
      valid: false,
      diagnostics: [expect.objectContaining({ code: 'serialization/parse-error', severity: 'error' })]
    });
    expect(serialized).toContain('keys');
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
    expect(registry.list().map((provider) => provider.id)).toEqual(['json-compact', 'toon', 'tron']);
    expect(() => registry.register(getSerializationProvider('tron'))).toThrow('Serialization provider already registered: tron');
    expect(() => registry.register(null as never)).toThrow('Serialization provider must be an object');
    expect(() => registry.register({ id: 'Bad', extension: 'bad' } as never)).toThrow('Serialization provider has invalid id: Bad');
    expect(() => registry.register({ id: 'bad', extension: 'bad' } as never)).toThrow('Serialization provider bad is missing serialize');
    expect(() => registry.register({ ...getSerializationProvider('json-compact'), id: 'bad-ext', extension: '../json' })).toThrow('Serialization provider bad-ext has invalid extension');
    expect(() => registry.register({ ...getSerializationProvider('json-compact'), id: 'bad-grammar', grammar: { format: 'peg' as 'lark', source: 'start: value' } })).toThrow('Serialization provider bad-grammar has unsupported grammar format');
    expect(() => registry.register({ ...getSerializationProvider('json-compact'), id: 'empty-grammar', grammar: { format: 'lark', source: ' ' } })).toThrow('Serialization provider empty-grammar has empty grammar source');
    expect(() => registry.require('missing')).toThrow('Unsupported serialization provider: missing. Loaded providers: json-compact, toon, tron');
  });

  it('dogfoods built-in serializers through manifest-backed plugin folders', async () => {
    const registry = createSerializationRegistry({ includeBuiltIns: false });
    expect(registry.list()).toEqual([]);

    registerBuiltInSerializerPlugins(registry);

    expect(registry.list().map((provider) => provider.id)).toEqual(['json-compact', 'toon', 'tron']);
    for (const plugin of ['json-compact', 'toon', 'tron']) {
      const pluginRoot = path.resolve(import.meta.dirname, `../../plugins/serialization/${plugin}`);
      const manifest = await loadSerializationPluginManifest(pluginRoot);
      expect(manifest.type).toBe('serialization');
      expect(manifest.id).toBe(plugin);
      expect(manifest.symbol).toBe(plugin === 'json-compact' ? 'JSON_COMPACT_SERIALIZER' : `${plugin.toUpperCase()}_SERIALIZER`);
      expect(manifest.grammar).toBe(`grammar/${plugin === 'json-compact' ? 'json-compact' : plugin}.lark`);
      expect(manifest.semantics).toBe('json-value-v1');
      expect(await readFile(path.join(pluginRoot, manifest.grammar), 'utf8')).toContain('start:');
      expect(await readFile(path.join(pluginRoot, 'utk.pack.toml'), 'utf8')).toContain('[[plugins]]');
    }
    expect(() => registerBuiltInSerializerPlugins(registry)).toThrow('Serialization provider already registered: json-compact');
  });

  it('keeps serializer plugins data-only and never executes plugin-local code', async () => {
    const providersSource = await readFile(path.resolve(import.meta.dirname, '../src/serialization/providers.ts'), 'utf8');

    expect(providersSource).not.toContain('@toon-format/toon');
    expect(providersSource).not.toContain('@tron-format/tron');
    expect(providersSource).not.toContain('createRequire');
    expect(providersSource).not.toContain('registerUtkSerializerPlugin');
    await expect(readFile(path.resolve(import.meta.dirname, '../../plugins/serialization/toon/index.cjs'), 'utf8')).rejects.toThrow();
    await expect(readFile(path.resolve(import.meta.dirname, '../../plugins/serialization/tron/index.cjs'), 'utf8')).rejects.toThrow();
    await expect(readFile(path.resolve(import.meta.dirname, '../../plugins/serialization/json-compact/index.cjs'), 'utf8')).rejects.toThrow();
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

  it('auto-loads serializer plugin folders from .utk/plugins/serialization', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-registry-'));
    await writeSerializerPluginFolder(path.join(root, '.utk', 'plugins', 'serialization', 'demo'), 'demo');

    const registry = await loadSerializationRegistry(root);

    expect(registry.require('demo').serialize({ ok: true }, { toolId: 'tool.demo' })).toBe('{"ok":true}');
    expect(registry.serializers.demo.linter.lint('{"ok":true}')).toMatchObject({ valid: true, ast: { ok: true } });
    expect(getSerializerGrammar('demo', registry)?.source).toContain('start:');
  });

  it('does not execute index.js when loading grammar-only serializer plugins', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-no-exec-'));
    const pluginRoot = path.join(root, '.utk', 'plugins', 'serialization', 'demo');
    const sideEffectPath = path.join(root, 'executed.txt');
    await writeSerializerPluginFolder(pluginRoot, 'demo');
    await writeFile(path.join(pluginRoot, 'index.js'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(sideEffectPath)}, 'ran');\n`, 'utf8');

    const registry = await loadSerializationRegistry(root);

    expect(registry.require('demo').serialize({ ok: true }, { toolId: 'tool.demo' })).toBe('{"ok":true}');
    await expect(readFile(sideEffectPath, 'utf8')).rejects.toThrow();
  });

  it('auto-loads serializer plugins installed as packs under .utk/packs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-installed-plugin-pack-'));
    await writeSerializerPluginFolder(path.join(root, '.utk', 'packs', 'installed-demo'), 'installed-demo');

    const registry = await loadSerializationRegistry(root);

    expect(registry.require('installed-demo').serialize({ ok: true }, { toolId: 'tool.demo' })).toBe('{"ok":true}');
    expect(getSerializerGrammar('installed-demo', registry)?.source).toContain('start:');
  });

  it('preserves manifest-declared config fields without executable plugin hooks', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-config-default-'));
    await mkdir(path.join(root, '.utk'), { recursive: true });
    await writeSerializerPluginFolder(path.join(root, '.utk', 'plugins', 'serialization', 'demo'), 'demo');
    await writeFile(
      path.join(root, '.utk', 'config.toml'),
      [
        '[serialization]',
        'default = "demo"',
        '',
        '[serialization.providers.demo]',
        'enabled = true',
        '',
        '[serialization.providers.demo.config]',
        'prefix = "cfg:"',
        ''
      ].join('\n'),
      'utf8'
    );

    const registry = await loadSerializationRegistry(root);
    const config = await loadUtkConfig(root);

    expect(resolveSerializerProviderId(config, 'tool.any', registry)).toBe('demo');
    expect(registry.require('demo').serialize({ ok: true }, { toolId: 'tool.demo' })).toBe('{"ok":true}');
    expect((await loadSerializationPluginManifest(path.join(root, '.utk', 'plugins', 'serialization', 'demo'))).configFields).toEqual({
      prefix: { type: 'string', default: '' }
    });

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

  it('rejects serializer plugin folders that collide with built-in provider ids', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-collision-'));
    await writeSerializerPluginFolder(path.join(root, '.utk', 'plugins', 'serialization', 'toon'), 'toon');

    await expect(loadSerializationRegistry(root)).rejects.toThrow('Serialization provider already registered: toon');
  });

  it('ignores non-plugin files during folder auto-load', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-ignore-'));
    await mkdir(path.join(root, '.utk', 'plugins', 'serialization'), { recursive: true });
    await writeFile(path.join(root, '.utk', 'plugins', 'serialization', 'README.md'), 'nope', 'utf8');

    const registry = await loadSerializationRegistry(root);

    expect(registry.list().map((provider) => provider.id)).toEqual(['json-compact', 'toon', 'tron']);
  });

  it('rejects serializer plugin manifests that still declare executable modules', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-bad-'));
    const pluginRoot = path.join(root, '.utk', 'plugins', 'serialization', 'bad');
    await mkdir(path.join(pluginRoot, 'grammar'), { recursive: true });
    await writeFile(path.join(pluginRoot, 'utk.pack.toml'), serializerPluginPackToml('bad', { module: 'index.js' }), 'utf8');
    await writeFile(path.join(pluginRoot, 'grammar', 'bad.lark'), 'start: value\nvalue: /.+/\n', 'utf8');
    await writeFile(path.join(pluginRoot, 'index.js'), 'export const nope = true;\n', 'utf8');

    await expect(loadSerializationRegistry(root)).rejects.toThrow('plugins[0].module is not supported for serialization plugins');
  });

  it('rejects serializer plugin manifests without a const symbol', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-no-symbol-'));
    const pluginRoot = path.join(root, '.utk', 'plugins', 'serialization', 'bad');
    await mkdir(path.join(pluginRoot, 'grammar'), { recursive: true });
    await writeFile(path.join(pluginRoot, 'utk.pack.toml'), serializerPluginPackToml('bad', { symbol: false }), 'utf8');
    await writeFile(path.join(pluginRoot, 'grammar', 'bad.lark'), 'start: value\nvalue: /.+/\n', 'utf8');
    await writeFile(path.join(pluginRoot, 'index.ts'), "export const BAD_SERIALIZER = 'bad' as const;\n", 'utf8');

    await expect(loadSerializationRegistry(root)).rejects.toThrow('plugins[0].symbol must be a non-empty string');
  });

  it('rejects serializer plugin manifests with invalid const symbols', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-bad-symbol-'));
    const pluginRoot = path.join(root, '.utk', 'plugins', 'serialization', 'bad');
    await mkdir(path.join(pluginRoot, 'grammar'), { recursive: true });
    await writeFile(path.join(pluginRoot, 'utk.pack.toml'), serializerPluginPackToml('bad', { symbolName: 'badSerializer' }), 'utf8');
    await writeFile(path.join(pluginRoot, 'grammar', 'bad.lark'), 'start: value\nvalue: /.+/\n', 'utf8');
    await writeFile(path.join(pluginRoot, 'index.ts'), "export const badSerializer = 'bad' as const;\n", 'utf8');

    await expect(loadSerializationRegistry(root)).rejects.toThrow('Serializer plugin bad has invalid symbol: badSerializer');
  });

  it('rejects serializer plugin package indexes that do not export the manifest symbol', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-missing-symbol-export-'));
    const pluginRoot = path.join(root, '.utk', 'plugins', 'serialization', 'bad');
    await writeSerializerPluginFolder(pluginRoot, 'bad');
    await writeFile(path.join(pluginRoot, 'index.ts'), "export const OTHER_SERIALIZER = 'bad' as const;\n", 'utf8');

    await expect(loadSerializationRegistry(root)).rejects.toThrow("Serializer plugin bad index must export const BAD_SERIALIZER = 'bad'");
  });

  it('rejects serializer plugin package indexes with executable code', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-executable-index-'));
    const pluginRoot = path.join(root, '.utk', 'plugins', 'serialization', 'bad');
    await writeSerializerPluginFolder(pluginRoot, 'bad');
    await writeFile(path.join(pluginRoot, 'index.ts'), "import fs from 'node:fs';\nexport const BAD_SERIALIZER = 'bad' as const;\n", 'utf8');

    await expect(loadSerializationRegistry(root)).rejects.toThrow('Serializer plugin bad index must be data-only const exports');
  });

  it('fails clearly when serializer plugin folder lacks a valid lark grammar', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-plugin-missing-'));
    const pluginRoot = path.join(root, '.utk', 'plugins', 'serialization', 'bad');
    await mkdir(pluginRoot, { recursive: true });
    await writeFile(path.join(pluginRoot, 'utk.pack.toml'), serializerPluginPackToml('bad'), 'utf8');
    await expect(loadSerializationRegistry(root)).rejects.toThrow('Serializer plugin bad grammar missing');
  });
});

async function writeSerializerPluginFolder(pluginRoot: string, providerId: string): Promise<void> {
  await mkdir(path.join(pluginRoot, 'grammar'), { recursive: true });
  await writeFile(path.join(pluginRoot, 'grammar', `${providerId}.lark`), jsonValueLark(), 'utf8');
  await writeFile(path.join(pluginRoot, 'utk.pack.toml'), serializerPluginPackToml(providerId), 'utf8');
  await writeFile(path.join(pluginRoot, 'index.ts'), `export const ${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_SERIALIZER = '${providerId}' as const;\n`, 'utf8');
}

function serializerPluginPackToml(providerId: string, options: { module?: string; symbol?: boolean; symbolName?: string } = {}): string {
  const symbol = options.symbolName ?? `${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_SERIALIZER`;
  return [
    '[pack]',
    `name = "${providerId}"`,
    'version = "1.0.0"',
    '',
    '[[plugins]]',
    'type = "serialization"',
    `id = "${providerId}"`,
    ...(options.module ? [`module = "${options.module}"`] : []),
    ...(options.symbol === false ? [] : [`symbol = "${symbol}"`]),
    'semantics = "json-value-v1"',
    `grammar = "grammar/${providerId}.lark"`,
    'extension = "demo"',
    '',
    '[plugins.config_fields.prefix]',
    'type = "string"',
    'default = ""',
    ''
  ].join('\n');
}

function jsonValueLark(): string {
  return [
    'start: value',
    '',
    '?value: object',
    '      | array',
    '      | string',
    '      | SIGNED_NUMBER',
    '      | "true"',
    '      | "false"',
    '      | "null"',
    '',
    'object: "{" [pair ("," pair)*] "}"',
    'pair: string ":" value',
    'array: "[" [value ("," value)*] "]"',
    'string: ESCAPED_STRING',
    '',
    '%import common.ESCAPED_STRING',
    '%import common.SIGNED_NUMBER',
    '%import common.WS',
    '%ignore WS',
    ''
  ].join('\n');
}
