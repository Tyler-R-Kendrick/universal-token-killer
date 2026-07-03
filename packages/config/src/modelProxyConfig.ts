import {
  DEFAULT_MODEL_PROXY_DENY_TOOLS,
  DEFAULT_MODEL_PROXY_PROTECTED_TOOLS,
  DEFAULT_MODEL_PROXY_PROVIDER,
  DEFAULT_PROTECTED_FIELDS,
  DEFAULT_PROTECTED_FILE_PATTERNS,
  MODEL_PROXY_COMPRESSION_LEVELS,
  MODEL_PROXY_HISTORY_COMPACTION_MODES,
  MODEL_PROXY_PROVIDER_DEFAULTS,
  MODEL_PROXY_TOOL_DISCOVERY_MODES,
  OBSERVE_ONLY,
  PIPE_INDEX_ONLY,
  RETENTION_POLICIES,
  TOOL_MATCHING_LEVELS
} from './defaults.js';
import type { ModelProxyProviderDefaults } from './defaults.js';
import {
  clampNumber,
  normalizeProviderOptions,
  readBoolean,
  readFiniteNumber,
  readNumber,
  readString,
  readStringArray,
  readStringEnum
} from './configReaders.js';
import type { ModelProxyProviderId, UtkConfig } from './configTypes.js';

const MODEL_PROXY_PROVIDER_DEFAULTS_BY_ID: Record<string, ModelProxyProviderDefaults> = MODEL_PROXY_PROVIDER_DEFAULTS;

export function normalizeToolMatching(value: Record<string, unknown>): UtkConfig['tool_matching'] {
  const providerOptions = normalizeToolMatchingProviderOptions(value);
  return {
    enabled: readBoolean(value.enabled, true),
    level: readStringEnum(value.level, 'slash-commands', TOOL_MATCHING_LEVELS, 'tool_matching level'),
    prefer_local_embeddings: readBoolean(value.prefer_local_embeddings, true),
    embedding_timeout_ms: Math.max(0, Math.floor(readFiniteNumber(value.embedding_timeout_ms, 1000, 'tool_matching.embedding_timeout_ms'))),
    embedding_cache: readBoolean(value.embedding_cache, true),
    embedding_similarity_threshold: clampNumber(readFiniteNumber(value.embedding_similarity_threshold, 0.78, 'tool_matching.embedding_similarity_threshold'), 0, 1),
    lexical_similarity_threshold: clampNumber(readFiniteNumber(value.lexical_similarity_threshold, 0.5, 'tool_matching.lexical_similarity_threshold'), 0, 1),
    exact_similarity_threshold: clampNumber(readFiniteNumber(value.exact_similarity_threshold, 0.98, 'tool_matching.exact_similarity_threshold'), 0, 1),
    winner_gap: clampNumber(readFiniteNumber(value.winner_gap, 0.06, 'tool_matching.winner_gap'), 0, 1),
    providers: readStringArray(value.providers, ['ollama', 'llama-server', 'openai-compatible-local'], 'tool_matching.providers'),
    provider_options: providerOptions
  };
}

function normalizeToolMatchingProviderOptions(value: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const providerOptions = normalizeProviderOptions(value.provider_options);
  mergeLegacyEmbeddingOptions(providerOptions, 'ollama', value, {
    base_url: 'ollama_base_url',
    model: 'ollama_model',
    dimensions: 'ollama_dimensions'
  });
  mergeLegacyEmbeddingOptions(providerOptions, 'llama-server', value, {
    base_url: 'llama_server_base_url',
    model: 'llama_server_model',
    dimensions: 'llama_server_dimensions'
  });
  mergeLegacyEmbeddingOptions(providerOptions, 'openai-compatible-local', value, {
    base_url: 'openai_compatible_base_url',
    model: 'openai_compatible_model',
    dimensions: 'openai_compatible_dimensions'
  });
  return providerOptions;
}

function mergeLegacyEmbeddingOptions(
  providerOptions: Record<string, Record<string, unknown>>,
  providerId: string,
  source: Record<string, unknown>,
  keys: Record<string, string>
): void {
  const legacyEntries = Object.entries(keys).filter(([, sourceKey]) => source[sourceKey] !== undefined);
  if (legacyEntries.length === 0) return;
  const target = providerOptions[providerId] ?? {};
  for (const [optionKey, sourceKey] of legacyEntries) {
    target[optionKey] = optionKey === 'dimensions'
      ? Math.max(1, Math.floor(readFiniteNumber(source[sourceKey], 768, `tool_matching.${sourceKey}`)))
      : readString(source[sourceKey], '');
  }
  providerOptions[providerId] = target;
}

export function normalizeModelProxy(proxy: Record<string, unknown>): UtkConfig['model_proxy'] {
  const upstreamProvider = readProviderId(proxy.upstream_provider, DEFAULT_MODEL_PROXY_PROVIDER, 'model_proxy upstream_provider');
  const promptCompressionProvider = readProviderId(proxy.prompt_compression_provider, DEFAULT_MODEL_PROXY_PROVIDER, 'model_proxy prompt_compression_provider', { allowNone: true });
  return {
    enabled: readBoolean(proxy.enabled, true),
    host: readString(proxy.host, '127.0.0.1'),
    port: readNumber(proxy.port, 8787),
    upstream_provider: upstreamProvider,
    upstream_base_url: readString(proxy.upstream_base_url, defaultModelProxyBaseUrl(upstreamProvider)),
    upstream_api_version: readString(proxy.upstream_api_version, defaultModelProxyApiVersion(upstreamProvider)),
    upstream_organization: readString(proxy.upstream_organization, ''),
    compression_level: readStringEnum(proxy.compression_level, 'standard', MODEL_PROXY_COMPRESSION_LEVELS, 'model_proxy compression_level'),
    min_tokens: readNumber(proxy.min_tokens, 1024),
    reserve_output_tokens: readNumber(proxy.reserve_output_tokens, 4096),
    tool_discovery_mode: readStringEnum(proxy.tool_discovery_mode, 'static-filter', MODEL_PROXY_TOOL_DISCOVERY_MODES, 'model_proxy tool_discovery_mode'),
    cache_volatility: readStringEnum(proxy.cache_volatility, 'observe', OBSERVE_ONLY, 'model_proxy cache_volatility'),
    session_id_header: readString(proxy.session_id_header, 'x-utk-session-id'),
    session_blocks_enabled: readBoolean(proxy.session_blocks_enabled, true),
    history_compaction_mode: readStringEnum(proxy.history_compaction_mode, 'replace-with-summary-block', MODEL_PROXY_HISTORY_COMPACTION_MODES, 'model_proxy history_compaction_mode'),
    history_compaction_enabled: readBoolean(proxy.history_compaction_enabled, true),
    history_compaction_threshold: readNumber(proxy.history_compaction_threshold, 0.75),
    dedupe_policy: readStringEnum(proxy.dedupe_policy, 'compact', RETENTION_POLICIES, 'model_proxy dedupe_policy'),
    stale_error_policy: readStringEnum(proxy.stale_error_policy, 'compact', RETENTION_POLICIES, 'model_proxy stale_error_policy'),
    purge_error_after_turns: readNumber(proxy.purge_error_after_turns, 4),
    artifact_search_enabled: readBoolean(proxy.artifact_search_enabled, true),
    context_proofs_enabled: readBoolean(proxy.context_proofs_enabled, true),
    deferred_tool_search_enabled: readBoolean(proxy.deferred_tool_search_enabled, true),
    provider_strict_mode: readBoolean(proxy.provider_strict_mode, false),
    provider_options: normalizeProviderOptions(proxy.provider_options),
    prompt_asset_style: readStringEnum(proxy.prompt_asset_style, 'pipe-index', PIPE_INDEX_ONLY, 'model_proxy prompt_asset_style'),
    remote_compressors_enabled: readBoolean(proxy.remote_compressors_enabled, false),
    prompt_compression_enabled: readBoolean(proxy.prompt_compression_enabled, true),
    prompt_compression_provider: promptCompressionProvider,
    prompt_compression_model: readString(proxy.prompt_compression_model, 'openai/gpt-4.1'),
    prompt_compression_base_url: readString(proxy.prompt_compression_base_url, defaultModelProxyBaseUrl(promptCompressionProvider)),
    prompt_compression_api_version: readString(proxy.prompt_compression_api_version, defaultModelProxyApiVersion(promptCompressionProvider)),
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

function readProviderId(
  value: unknown,
  fallback: ModelProxyProviderId,
  label: string,
  options: { allowNone?: boolean } = {}
): ModelProxyProviderId {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  if (!options.allowNone && value === 'none') throw new Error(`${label} cannot be "none"`);
  return value;
}

function defaultModelProxyBaseUrl(provider: ModelProxyProviderId): string {
  return MODEL_PROXY_PROVIDER_DEFAULTS_BY_ID[provider]?.baseUrl ?? '';
}

function defaultModelProxyApiVersion(provider: ModelProxyProviderId): string {
  return MODEL_PROXY_PROVIDER_DEFAULTS_BY_ID[provider]?.apiVersion ?? '';
}
