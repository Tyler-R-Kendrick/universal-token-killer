import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';

export type SerializerProviderId = string;

type SerializationRegistryLike = {
  get(id: string): unknown;
  list(): Array<{ id: string }>;
};

export type UtkConfig = {
  serialization: {
    default: SerializerProviderId;
    providers: Record<SerializerProviderId, { enabled: boolean }>;
    overrides: Array<{ tool: string; provider: SerializerProviderId }>;
  };
  routing: {
    deterministic_confidence_threshold: number;
    constrained_routing_enabled: boolean;
  };
  persistence: {
    raw_outputs: boolean;
    storage_root: string;
  };
  detok: {
    enabled: boolean;
    copilot_pre_tool_use: {
      enabled: boolean;
      rate: number;
      min_chars: number;
      deny_tools: string[];
      rewrite_fields: string[];
      protected_fields: string[];
      overrides: Array<{
        tool: string;
        enabled?: boolean;
        rewrite_fields?: string[];
        protected_fields?: string[];
      }>;
    };
  };
  tools: {
    registry: Array<{
      tool: string;
      description?: string;
      output_cache: boolean;
      bypass_on_cache: boolean;
      curry_fields: string[];
      structured_fields: Array<{
        name: string;
        completions: string[];
        required?: boolean;
        description?: string;
      }>;
    }>;
  };
  tracing: {
    enabled: boolean;
    capture_inputs: boolean;
    capture_outputs: boolean;
    emit_eval_set: boolean;
    storage_root: string;
    process_id: string;
  };
  model_proxy: {
    enabled: boolean;
    host: string;
    port: number;
    upstream_provider: 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference';
    upstream_base_url: string;
    upstream_api_version: string;
    upstream_organization: string;
    compression_level: 'off' | 'lite' | 'standard' | 'max';
    min_tokens: number;
    reserve_output_tokens: number;
    tool_discovery_mode: 'off' | 'static-filter' | 'deferred-search';
    cache_volatility: 'observe';
    session_id_header: string;
    session_blocks_enabled: boolean;
    history_compaction_mode: 'summary-block' | 'replace-with-summary-block';
    history_compaction_enabled: boolean;
    history_compaction_threshold: number;
    dedupe_policy: 'off' | 'observe' | 'compact';
    stale_error_policy: 'off' | 'observe' | 'compact';
    purge_error_after_turns: number;
    artifact_search_enabled: boolean;
    context_proofs_enabled: boolean;
    deferred_tool_search_enabled: boolean;
    provider_strict_mode: boolean;
    prompt_asset_style: 'pipe-index';
    remote_compressors_enabled: boolean;
    prompt_compression_enabled: boolean;
    prompt_compression_provider: 'none' | 'github-models' | 'azure-openai' | 'azure-ai-inference' | 'openai-compatible';
    prompt_compression_model: string;
    prompt_compression_base_url: string;
    prompt_compression_min_tokens: number;
    prompt_compression_timeout_ms: number;
    inject_expand_context: boolean;
    minimize_tool_schemas: boolean;
    expand_edit_ranges: boolean;
    protected_fields: string[];
    protected_tools: string[];
    protected_file_patterns: string[];
    deny_tools: string[];
  };
  prompt_optimization: {
    enabled: boolean;
    surfaces: string[];
    min_tokens: number;
    target_ratio: number;
    persist_originals: boolean;
    cache_volatility: 'observe';
    asset_style: 'pipe-index';
  };
};

export const SUPPORTED_SERIALIZERS = ['toon', 'compressed-json', 'tron'] as const;

export const DEFAULT_CONFIG_TOML = `[serialization]
default = "toon"

[serialization.providers.toon]
enabled = true

[serialization.providers.compressed-json]
enabled = true

[serialization.providers.tron]
enabled = true

[routing]
deterministic_confidence_threshold = 0.95
constrained_routing_enabled = true

[persistence]
raw_outputs = true
storage_root = ".utk"

[detok]
enabled = true

[detok.copilot_pre_tool_use]
enabled = true
rate = 0.33
min_chars = 8000
deny_tools = ["bash", "powershell", "create", "edit", "view", "grep", "glob"]
rewrite_fields = ["prompt", "instructions", "description", "question", "message", "summary", "notes", "body"]
protected_fields = ["command", "cmd", "path", "file", "files", "cwd", "url", "pattern", "regex", "glob", "patch", "diff", "content", "old_string", "new_string", "id"]

[tools]
registry = []

[tracing]
enabled = false
capture_inputs = true
capture_outputs = true
emit_eval_set = true
storage_root = ".utk/events"
process_id = "utk"

[model_proxy]
enabled = true
host = "127.0.0.1"
port = 8787
upstream_provider = "github-models"
upstream_base_url = "https://models.github.ai/inference"
upstream_api_version = "2026-03-10"
upstream_organization = ""
compression_level = "standard"
min_tokens = 1024
reserve_output_tokens = 4096
tool_discovery_mode = "static-filter"
cache_volatility = "observe"
session_id_header = "x-utk-session-id"
session_blocks_enabled = true
history_compaction_mode = "replace-with-summary-block"
history_compaction_enabled = true
history_compaction_threshold = 0.75
dedupe_policy = "compact"
stale_error_policy = "compact"
purge_error_after_turns = 4
artifact_search_enabled = true
context_proofs_enabled = true
deferred_tool_search_enabled = true
provider_strict_mode = false
prompt_asset_style = "pipe-index"
remote_compressors_enabled = false
prompt_compression_enabled = true
prompt_compression_provider = "github-models"
prompt_compression_model = "openai/gpt-4.1"
prompt_compression_base_url = "https://models.github.ai/inference"
prompt_compression_min_tokens = 64
prompt_compression_timeout_ms = 2500
inject_expand_context = true
minimize_tool_schemas = true
expand_edit_ranges = true
protected_fields = ["command", "cmd", "path", "file", "files", "cwd", "url", "pattern", "regex", "glob", "patch", "diff", "content", "old_string", "new_string", "id"]
protected_tools = ["edit", "write", "apply_patch", "auth*", "secret*"]
protected_file_patterns = [".env*", "*.pem", "*.key"]
deny_tools = ["auth*", "secret*", "credential*"]

[prompt_optimization]
enabled = true
surfaces = ["system-prompt", "ghcp-agent", "agent-skill", "tool-definition", "recovery-tool", "copilot-instructions", "session-agent", "session-skill"]
min_tokens = 256
target_ratio = 0.50
persist_originals = true
cache_volatility = "observe"
asset_style = "pipe-index"
`;

export async function loadUtkConfig(workspaceRoot: string): Promise<UtkConfig> {
  const configPath = path.join(workspaceRoot, '.utk', 'config.toml');
  const text = await ensureConfigToml(configPath);
  return normalizeConfig(parse(text) as Record<string, unknown>);
}

export function resolveSerializerProviderId(config: UtkConfig, toolId: string, registry?: SerializationRegistryLike): SerializerProviderId {
  const override = resolveSerializerOverride(config.serialization.overrides, toolId);
  const selected = override?.provider ?? config.serialization.default;
  const loaded = registry ? registry.list().map((provider) => provider.id).sort() : [...SUPPORTED_SERIALIZERS].sort();
  const isLoaded = registry ? Boolean(registry.get(selected)) : (SUPPORTED_SERIALIZERS as readonly string[]).includes(selected);
  if (!isLoaded) {
    throw new Error(`Unsupported serialization provider: ${selected}. Loaded providers: ${loaded.join(', ')}`);
  }
  const provider = config.serialization.providers[selected];
  if (!provider?.enabled) {
    throw new Error(`Serialization provider is disabled: ${selected}`);
  }
  return selected;
}

async function ensureConfigToml(configPath: string): Promise<string> {
  try {
    return await readFile(configPath, 'utf8');
  } catch {
    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, DEFAULT_CONFIG_TOML, 'utf8');
    return DEFAULT_CONFIG_TOML;
  }
}

function normalizeConfig(raw: Record<string, unknown>): UtkConfig {
  const serialization = readObject(raw.serialization, 'serialization');
  const routing = readOptionalObject(raw.routing);
  const persistence = readOptionalObject(raw.persistence);
  const detok = readNamedOptionalObject(raw.detok, 'detok');
  const providers = readOptionalObject(serialization.providers);
  const tools = readOptionalObject(raw.tools);
  const modelProxy = readNamedOptionalObject(raw.model_proxy, 'model_proxy');
  const promptOptimization = readNamedOptionalObject(raw.prompt_optimization, 'prompt_optimization');

  const defaultProvider = readProvider(serialization.default ?? 'toon');
  const normalizedProviders = normalizeProviders(providers);
  const overrides = normalizeOverrides(serialization.overrides);

  return {
    serialization: {
      default: defaultProvider,
      providers: normalizedProviders,
      overrides
    },
    routing: {
      deterministic_confidence_threshold: readNumber(routing.deterministic_confidence_threshold, 0.95),
      constrained_routing_enabled: readBoolean(routing.constrained_routing_enabled, true)
    },
    persistence: {
      raw_outputs: readBoolean(persistence.raw_outputs, true),
      storage_root: readString(persistence.storage_root, '.utk')
    },
    detok: {
      enabled: readBoolean(detok.enabled, true),
      copilot_pre_tool_use: normalizeCopilotPreToolUse(detok.copilot_pre_tool_use)
    },
    tools: {
      registry: normalizeRegisteredTools(tools.registry)
    },
    tracing: normalizeTracing(raw.tracing),
    model_proxy: normalizeModelProxy(modelProxy),
    prompt_optimization: normalizePromptOptimization(promptOptimization)
  };
}

function normalizeModelProxy(proxy: Record<string, unknown>): UtkConfig['model_proxy'] {
  return {
    enabled: readBoolean(proxy.enabled, true),
    host: readString(proxy.host, '127.0.0.1'),
    port: readNumber(proxy.port, 8787),
    upstream_provider: readUpstreamProvider(proxy.upstream_provider),
    upstream_base_url: readString(proxy.upstream_base_url, 'https://models.github.ai/inference'),
    upstream_api_version: readString(proxy.upstream_api_version, '2026-03-10'),
    upstream_organization: readString(proxy.upstream_organization, ''),
    compression_level: readCompressionLevel(proxy.compression_level),
    min_tokens: readNumber(proxy.min_tokens, 1024),
    reserve_output_tokens: readNumber(proxy.reserve_output_tokens, 4096),
    tool_discovery_mode: readToolDiscoveryMode(proxy.tool_discovery_mode),
    cache_volatility: readObserveOnly(proxy.cache_volatility, 'model_proxy cache_volatility'),
    session_id_header: readString(proxy.session_id_header, 'x-utk-session-id'),
    session_blocks_enabled: readBoolean(proxy.session_blocks_enabled, true),
    history_compaction_mode: readHistoryCompactionMode(proxy.history_compaction_mode),
    history_compaction_enabled: readBoolean(proxy.history_compaction_enabled, true),
    history_compaction_threshold: readNumber(proxy.history_compaction_threshold, 0.75),
    dedupe_policy: readDedupePolicy(proxy.dedupe_policy),
    stale_error_policy: readStaleErrorPolicy(proxy.stale_error_policy),
    purge_error_after_turns: readNumber(proxy.purge_error_after_turns, 4),
    artifact_search_enabled: readBoolean(proxy.artifact_search_enabled, true),
    context_proofs_enabled: readBoolean(proxy.context_proofs_enabled, true),
    deferred_tool_search_enabled: readBoolean(proxy.deferred_tool_search_enabled, true),
    provider_strict_mode: readBoolean(proxy.provider_strict_mode, false),
    prompt_asset_style: readPipeIndex(proxy.prompt_asset_style, 'model_proxy prompt_asset_style'),
    remote_compressors_enabled: readBoolean(proxy.remote_compressors_enabled, false),
    prompt_compression_enabled: readBoolean(proxy.prompt_compression_enabled, true),
    prompt_compression_provider: readPromptCompressionProvider(proxy.prompt_compression_provider),
    prompt_compression_model: readString(proxy.prompt_compression_model, 'openai/gpt-4.1'),
    prompt_compression_base_url: readString(proxy.prompt_compression_base_url, 'https://models.github.ai/inference'),
    prompt_compression_min_tokens: readNumber(proxy.prompt_compression_min_tokens, 64),
    prompt_compression_timeout_ms: readNumber(proxy.prompt_compression_timeout_ms, 2500),
    inject_expand_context: readBoolean(proxy.inject_expand_context, true),
    minimize_tool_schemas: readBoolean(proxy.minimize_tool_schemas, true),
    expand_edit_ranges: readBoolean(proxy.expand_edit_ranges, true),
    protected_fields: readStringArray(proxy.protected_fields, DEFAULT_PROTECTED_FIELDS, 'model_proxy.protected_fields'),
    protected_tools: readStringArray(proxy.protected_tools, DEFAULT_MODEL_PROXY_PROTECTED_TOOLS, 'model_proxy.protected_tools'),
    protected_file_patterns: readStringArray(proxy.protected_file_patterns, DEFAULT_PROTECTED_FILE_PATTERNS, 'model_proxy.protected_file_patterns'),
    deny_tools: readStringArray(proxy.deny_tools, DEFAULT_MODEL_PROXY_DENY_TOOLS, 'model_proxy.deny_tools')
  };
}

function normalizePromptOptimization(value: Record<string, unknown>): UtkConfig['prompt_optimization'] {
  return {
    enabled: readBoolean(value.enabled, true),
    surfaces: readStringArray(value.surfaces, DEFAULT_PROMPT_SURFACES, 'prompt_optimization.surfaces'),
    min_tokens: readNumber(value.min_tokens, 256),
    target_ratio: readNumber(value.target_ratio, 0.5),
    persist_originals: readBoolean(value.persist_originals, true),
    cache_volatility: readObserveOnly(value.cache_volatility, 'prompt_optimization cache_volatility'),
    asset_style: readPipeIndex(value.asset_style, 'prompt_optimization asset_style')
  };
}

function readCompressionLevel(value: unknown): UtkConfig['model_proxy']['compression_level'] {
  if (value === undefined) return 'standard';
  if (value === 'off' || value === 'lite' || value === 'standard' || value === 'max') return value;
  throw new Error(`Unsupported model_proxy compression_level: ${String(value)}`);
}

function readToolDiscoveryMode(value: unknown): UtkConfig['model_proxy']['tool_discovery_mode'] {
  if (value === undefined) return 'static-filter';
  if (value === 'off' || value === 'static-filter' || value === 'deferred-search') return value;
  throw new Error(`Unsupported model_proxy tool_discovery_mode: ${String(value)}`);
}

function readUpstreamProvider(value: unknown): UtkConfig['model_proxy']['upstream_provider'] {
  if (value === undefined) return 'github-models';
  if (value === 'openai' || value === 'github-models' || value === 'azure-openai' || value === 'azure-ai-inference') return value;
  throw new Error(`Unsupported model_proxy upstream_provider: ${String(value)}`);
}

function readPromptCompressionProvider(value: unknown): UtkConfig['model_proxy']['prompt_compression_provider'] {
  if (value === undefined) return 'github-models';
  if (value === 'none' || value === 'github-models' || value === 'azure-openai' || value === 'azure-ai-inference' || value === 'openai-compatible') return value;
  throw new Error(`Unsupported model_proxy prompt_compression_provider: ${String(value)}`);
}

function readHistoryCompactionMode(value: unknown): UtkConfig['model_proxy']['history_compaction_mode'] {
  if (value === undefined) return 'replace-with-summary-block';
  if (value === 'summary-block' || value === 'replace-with-summary-block') return value;
  throw new Error(`Unsupported model_proxy history_compaction_mode: ${String(value)}`);
}

function readDedupePolicy(value: unknown): UtkConfig['model_proxy']['dedupe_policy'] {
  if (value === undefined) return 'compact';
  if (value === 'off' || value === 'observe' || value === 'compact') return value;
  throw new Error(`Unsupported model_proxy dedupe_policy: ${String(value)}`);
}

function readStaleErrorPolicy(value: unknown): UtkConfig['model_proxy']['stale_error_policy'] {
  if (value === undefined) return 'compact';
  if (value === 'off' || value === 'observe' || value === 'compact') return value;
  throw new Error(`Unsupported model_proxy stale_error_policy: ${String(value)}`);
}

function readObserveOnly(value: unknown, name: string): 'observe' {
  if (value === undefined || value === 'observe') return 'observe';
  throw new Error(`Unsupported ${name}: ${String(value)}`);
}

function readPipeIndex(value: unknown, name: string): 'pipe-index' {
  if (value === undefined || value === 'pipe-index') return 'pipe-index';
  throw new Error(`Unsupported ${name}: ${String(value)}`);
}

function normalizeTracing(value: unknown): UtkConfig['tracing'] {
  const tracing = readNamedOptionalObject(value, 'tracing');
  return {
    enabled: readBoolean(tracing.enabled, false),
    capture_inputs: readBoolean(tracing.capture_inputs, true),
    capture_outputs: readBoolean(tracing.capture_outputs, true),
    emit_eval_set: readBoolean(tracing.emit_eval_set, true),
    storage_root: readString(tracing.storage_root, '.utk/events'),
    process_id: readString(tracing.process_id, 'utk')
  };
}

function normalizeCopilotPreToolUse(value: unknown): UtkConfig['detok']['copilot_pre_tool_use'] {
  const hook = readNamedOptionalObject(value, 'detok.copilot_pre_tool_use');
  return {
    enabled: readBoolean(hook.enabled, true),
    rate: readNumber(hook.rate, 0.33),
    min_chars: readNumber(hook.min_chars, 8000),
    deny_tools: readStringArray(hook.deny_tools, DEFAULT_DENY_TOOLS, 'detok.copilot_pre_tool_use.deny_tools'),
    rewrite_fields: readStringArray(hook.rewrite_fields, DEFAULT_REWRITE_FIELDS, 'detok.copilot_pre_tool_use.rewrite_fields'),
    protected_fields: readStringArray(hook.protected_fields, DEFAULT_PROTECTED_FIELDS, 'detok.copilot_pre_tool_use.protected_fields'),
    overrides: normalizeDetokOverrides(hook.overrides)
  };
}

function normalizeDetokOverrides(value: unknown): UtkConfig['detok']['copilot_pre_tool_use']['overrides'] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('detok.copilot_pre_tool_use.overrides must be an array');
  }
  return value.map((item) => {
    const object = readObject(item, 'detok.copilot_pre_tool_use.overrides[]');
    const override: UtkConfig['detok']['copilot_pre_tool_use']['overrides'][number] = {
      tool: readString(object.tool, '')
    };
    if (object.enabled !== undefined) override.enabled = readBoolean(object.enabled, true);
    if (object.rewrite_fields !== undefined) {
      override.rewrite_fields = readStringArray(object.rewrite_fields, [], 'detok.copilot_pre_tool_use.overrides[].rewrite_fields');
    }
    if (object.protected_fields !== undefined) {
      override.protected_fields = readStringArray(object.protected_fields, [], 'detok.copilot_pre_tool_use.overrides[].protected_fields');
    }
    return override;
  });
}

function normalizeProviders(providers: Record<string, unknown>): Record<string, { enabled: boolean }> {
  const normalized: Record<string, { enabled: boolean }> = {};
  for (const providerId of SUPPORTED_SERIALIZERS) {
    normalized[providerId] = normalizeProvider(providers[providerId]);
  }
  for (const [providerId, value] of Object.entries(providers)) {
    normalized[providerId] = normalizeProvider(value);
  }
  return normalized;
}

function resolveSerializerOverride(overrides: Array<{ tool: string; provider: SerializerProviderId }>, toolId: string): { tool: string; provider: SerializerProviderId } | undefined {
  return overrides.find((item) => item.tool === toolId) ?? overrides.find((item) => toolMatches(item.tool, toolId));
}

function normalizeProvider(value: unknown): { enabled: boolean } {
  const provider = readOptionalObject(value);
  return { enabled: readBoolean(provider.enabled, true) };
}

function normalizeRegisteredTools(value: unknown): UtkConfig['tools']['registry'] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('tools.registry must be an array');
  }
  return value.map((item) => {
    const object = readObject(item, 'tools.registry[]');
    return {
      tool: readString(object.tool, ''),
      description: object.description === undefined ? undefined : readString(object.description, ''),
      output_cache: readBoolean(object.output_cache, false),
      bypass_on_cache: readBoolean(object.bypass_on_cache, false),
      curry_fields: readStringArray(object.curry_fields, [], 'tools.registry[].curry_fields'),
      structured_fields: normalizeStructuredFields(object.structured_fields)
    };
  });
}

function normalizeStructuredFields(value: unknown): UtkConfig['tools']['registry'][number]['structured_fields'] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('tools.registry[].structured_fields must be an array');
  }
  return value.map((item) => {
    const object = readObject(item, 'tools.registry[].structured_fields[]');
    return {
      name: readString(object.name, ''),
      completions: readStringArray(object.completions, [], 'tools.registry[].structured_fields[].completions'),
      required: object.required === undefined ? undefined : readBoolean(object.required, false),
      description: object.description === undefined ? undefined : readString(object.description, '')
    };
  });
}

function normalizeOverrides(value: unknown): Array<{ tool: string; provider: SerializerProviderId }> {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('serialization.overrides must be an array');
  }
  return value.map((item) => {
    const object = readObject(item, 'serialization.overrides[]');
    return {
      tool: readString(object.tool, ''),
      provider: readProvider(object.provider)
    };
  });
}

function readProvider(value: unknown): SerializerProviderId {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error(`Unsupported serialization provider: ${String(value)}`);
}

function toolMatches(pattern: string, toolId: string): boolean {
  if (pattern.endsWith('*')) return toolId.startsWith(pattern.slice(0, -1));
  return false;
}

export function resolveRegisteredTool(config: UtkConfig, toolId: string): UtkConfig['tools']['registry'][number] | undefined {
  const exact = config.tools.registry.find((item) => item.tool === toolId);
  if (exact) return exact;
  return config.tools.registry.find((item) => item.tool.endsWith('*') && toolMatches(item.tool, toolId));
}

function readObject(value: unknown, name: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${name} must be a TOML table`);
}

function readOptionalObject(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  return readObject(value, 'configuration value');
}

function readNamedOptionalObject(value: unknown, name: string): Record<string, unknown> {
  if (value === undefined) return {};
  return readObject(value, name);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[], name: string): string[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be an array of strings`);
  }
  return [...value];
}

const DEFAULT_DENY_TOOLS = ['bash', 'powershell', 'create', 'edit', 'view', 'grep', 'glob'];
const DEFAULT_REWRITE_FIELDS = ['prompt', 'instructions', 'description', 'question', 'message', 'summary', 'notes', 'body'];
const DEFAULT_PROTECTED_FIELDS = ['command', 'cmd', 'path', 'file', 'files', 'cwd', 'url', 'pattern', 'regex', 'glob', 'patch', 'diff', 'content', 'old_string', 'new_string', 'id'];
const DEFAULT_MODEL_PROXY_PROTECTED_TOOLS = ['edit', 'write', 'apply_patch', 'auth*', 'secret*'];
const DEFAULT_PROTECTED_FILE_PATTERNS = ['.env*', '*.pem', '*.key'];
const DEFAULT_MODEL_PROXY_DENY_TOOLS = ['auth*', 'secret*', 'credential*'];
const DEFAULT_PROMPT_SURFACES = ['system-prompt', 'ghcp-agent', 'agent-skill', 'tool-definition', 'recovery-tool', 'copilot-instructions', 'session-agent', 'session-skill'];
