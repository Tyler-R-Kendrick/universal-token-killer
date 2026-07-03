export type SerializerProviderId = string;
export type ToolMatchingLevel = 'slash-commands' | 'exact-lexical-match' | 'regex-patterns' | 'lexical-similarity';
export type ModelProxyProviderId = string;

export type UtkConfig = {
  serialization: {
    default: SerializerProviderId;
    providers: Record<SerializerProviderId, { enabled: boolean; config: Record<string, unknown> }>;
    overrides: Array<{ tool: string; provider: SerializerProviderId }>;
  };
  plugins: {
    serialization_paths: string[];
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
    prompt: {
      model: string;
      rate: number;
      min_chars: number;
    };
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
      lexical_aliases: string[];
      lexical_regexes: string[];
      bypass_on_match: boolean;
      default_args: Record<string, unknown>;
      structured_fields: Array<{
        name: string;
        completions: string[];
        required?: boolean;
        description?: string;
      }>;
    }>;
  };
  tool_matching: {
    enabled: boolean;
    level: ToolMatchingLevel;
    prefer_local_embeddings: boolean;
    embedding_timeout_ms: number;
    embedding_cache: boolean;
    embedding_similarity_threshold: number;
    lexical_similarity_threshold: number;
    exact_similarity_threshold: number;
    winner_gap: number;
    providers: string[];
    provider_options: Record<string, Record<string, unknown>>;
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
    upstream_provider: ModelProxyProviderId;
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
    provider_options: Record<string, Record<string, unknown>>;
    prompt_asset_style: 'pipe-index';
    remote_compressors_enabled: boolean;
    prompt_compression_enabled: boolean;
    prompt_compression_provider: ModelProxyProviderId;
    prompt_compression_model: string;
    prompt_compression_base_url: string;
    prompt_compression_api_version: string;
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
  code_graph: {
    enabled_languages: Array<'typescript' | 'javascript'>;
    ignored_globs: string[];
    max_context_tokens: number;
    storage_root: string;
    engine_path: string;
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
