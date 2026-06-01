export type ModelProxyProviderDefaults = {
  baseUrl: string;
  apiVersion: string;
};

export const DEFAULT_MODEL_PROXY_PROVIDER = 'github-models';
export const MODEL_PROXY_PROVIDER_DEFAULTS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiVersion: ''
  },
  'github-models': {
    baseUrl: 'https://models.github.ai/inference',
    apiVersion: '2026-03-10'
  },
  'azure-openai': {
    baseUrl: 'https://<resource>.openai.azure.com/openai/v1',
    apiVersion: ''
  },
  'azure-ai-inference': {
    baseUrl: 'https://<resource>.services.ai.azure.com/models',
    apiVersion: '2024-05-01-preview'
  }
} as const satisfies Record<string, ModelProxyProviderDefaults>;

export const SUPPORTED_SERIALIZERS = ['json-compact', 'toon', 'tron'] as const;
export const SERIALIZER_ALIASES: Record<string, string> = {
  'compressed-json': 'json-compact'
};

export const TOOL_MATCHING_LEVELS = ['slash-commands', 'exact-lexical-match', 'regex-patterns', 'lexical-similarity'] as const;
export const MODEL_PROXY_COMPRESSION_LEVELS = ['off', 'lite', 'standard', 'max'] as const;
export const MODEL_PROXY_TOOL_DISCOVERY_MODES = ['off', 'static-filter', 'deferred-search'] as const;
export const MODEL_PROXY_HISTORY_COMPACTION_MODES = ['summary-block', 'replace-with-summary-block'] as const;
export const RETENTION_POLICIES = ['off', 'observe', 'compact'] as const;
export const OBSERVE_ONLY = ['observe'] as const;
export const PIPE_INDEX_ONLY = ['pipe-index'] as const;

export const DEFAULT_DENY_TOOLS = ['bash', 'powershell', 'create', 'edit', 'view', 'grep', 'glob'];
export const DEFAULT_REWRITE_FIELDS = ['prompt', 'instructions', 'description', 'question', 'message', 'summary', 'notes', 'body'];
export const DEFAULT_PROTECTED_FIELDS = ['command', 'cmd', 'path', 'file', 'files', 'cwd', 'url', 'pattern', 'regex', 'glob', 'patch', 'diff', 'content', 'old_string', 'new_string', 'id'];
export const DEFAULT_MODEL_PROXY_PROTECTED_TOOLS = ['edit', 'write', 'apply_patch', 'auth*', 'secret*'];
export const DEFAULT_PROTECTED_FILE_PATTERNS = ['.env*', '*.pem', '*.key'];
export const DEFAULT_MODEL_PROXY_DENY_TOOLS = ['auth*', 'secret*', 'credential*'];
export const DEFAULT_PROMPT_SURFACES = ['system-prompt', 'ghcp-agent', 'agent-skill', 'tool-definition', 'recovery-tool', 'copilot-instructions', 'session-agent', 'session-skill'];

export const DEFAULT_CONFIG_TOML = `[serialization]
default = "toon"

[serialization.providers.toon]
enabled = true

[serialization.providers.json-compact]
enabled = true

[serialization.providers.tron]
enabled = true

[plugins]
serialization_paths = [".utk/plugins/serialization"]

[routing]
deterministic_confidence_threshold = 0.95
constrained_routing_enabled = true

[persistence]
raw_outputs = true
storage_root = ".utk"

[detok]
enabled = true

[detok.prompt]
model = "default/LLMLingua2"
rate = 0.33
min_chars = 0

[detok.copilot_pre_tool_use]
enabled = true
rate = 0.33
min_chars = 8000
deny_tools = ["bash", "powershell", "create", "edit", "view", "grep", "glob"]
rewrite_fields = ["prompt", "instructions", "description", "question", "message", "summary", "notes", "body"]
protected_fields = ["command", "cmd", "path", "file", "files", "cwd", "url", "pattern", "regex", "glob", "patch", "diff", "content", "old_string", "new_string", "id"]

[tools]
registry = []

[tool_matching]
enabled = true
level = "slash-commands"
prefer_local_embeddings = true
embedding_timeout_ms = 1000
embedding_cache = true
embedding_similarity_threshold = 0.78
lexical_similarity_threshold = 0.50
exact_similarity_threshold = 0.98
winner_gap = 0.06
providers = ["ollama", "llama-server", "openai-compatible-local"]

[tool_matching.provider_options.ollama]
base_url = "http://127.0.0.1:11434/v1"
model = "nomic-embed-text"
dimensions = 768

[tool_matching.provider_options.llama-server]
base_url = "http://127.0.0.1:8080/v1"
model = ""
dimensions = 768
require_model = false

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
provider_options = {}
prompt_asset_style = "pipe-index"
remote_compressors_enabled = false
prompt_compression_enabled = true
prompt_compression_provider = "github-models"
prompt_compression_model = "openai/gpt-4.1"
prompt_compression_base_url = "https://models.github.ai/inference"
prompt_compression_api_version = "2026-03-10"
prompt_compression_min_tokens = 64
prompt_compression_timeout_ms = 2500
inject_expand_context = true
minimize_tool_schemas = true
expand_edit_ranges = true
protected_fields = ["command", "cmd", "path", "file", "files", "cwd", "url", "pattern", "regex", "glob", "patch", "diff", "content", "old_string", "new_string", "id"]
protected_tools = ["edit", "write", "apply_patch", "auth*", "secret*"]
protected_file_patterns = [".env*", "*.pem", "*.key"]
deny_tools = ["auth*", "secret*", "credential*"]

[code_graph]
enabled_languages = ["typescript", "javascript"]
ignored_globs = []
max_context_tokens = 1200
storage_root = ".utk/code-graph"
engine_path = ""

[prompt_optimization]
enabled = true
surfaces = ["system-prompt", "ghcp-agent", "agent-skill", "tool-definition", "recovery-tool", "copilot-instructions", "session-agent", "session-skill"]
min_tokens = 256
target_ratio = 0.50
persist_originals = true
cache_volatility = "observe"
asset_style = "pipe-index"
`;
