import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';

export type SerializerProviderId = 'toon' | 'compressed-json';

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
};

export const SUPPORTED_SERIALIZERS = ['toon', 'compressed-json'] as const;

export const DEFAULT_CONFIG_TOML = `[serialization]
default = "toon"

[serialization.providers.toon]
enabled = true

[serialization.providers.compressed-json]
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
`;

export async function loadUtkConfig(workspaceRoot: string): Promise<UtkConfig> {
  const configPath = path.join(workspaceRoot, '.utk', 'config.toml');
  const text = await ensureConfigToml(configPath);
  return normalizeConfig(parse(text) as Record<string, unknown>);
}

export function resolveSerializerProviderId(config: UtkConfig, toolId: string): SerializerProviderId {
  const override = config.serialization.overrides.find((item) => toolMatches(item.tool, toolId));
  const selected = override?.provider ?? config.serialization.default;
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

  const defaultProvider = readProvider(serialization.default ?? 'toon');
  const toonProvider = normalizeProvider(providers.toon);
  const compressedJsonProvider = normalizeProvider(providers['compressed-json']);
  const overrides = normalizeOverrides(serialization.overrides);

  return {
    serialization: {
      default: defaultProvider,
      providers: {
        toon: toonProvider,
        'compressed-json': compressedJsonProvider
      },
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
    tracing: normalizeTracing(raw.tracing)
  };
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
  if (value === 'toon' || value === 'compressed-json') return value;
  throw new Error(`Unsupported serialization provider: ${String(value)}`);
}

function toolMatches(pattern: string, toolId: string): boolean {
  if (pattern === toolId) return true;
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
