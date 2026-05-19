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
  const providers = readOptionalObject(serialization.providers);

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
    }
  };
}

function normalizeProvider(value: unknown): { enabled: boolean } {
  const provider = readOptionalObject(value);
  return { enabled: readBoolean(provider.enabled, true) };
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

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}
