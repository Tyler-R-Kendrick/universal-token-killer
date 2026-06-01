import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import {
  DEFAULT_CONFIG_TOML,
  DEFAULT_MODEL_PROXY_PROVIDER,
  MODEL_PROXY_PROVIDER_DEFAULTS,
  SERIALIZER_ALIASES,
  SUPPORTED_SERIALIZERS
} from './defaults.js';
import {
  readBoolean,
  readNamedOptionalObject,
  readNumber,
  readObject,
  readOptionalObject,
  readString,
  readStringArray
} from './configReaders.js';
import { normalizeModelProxy, normalizeToolMatching } from './modelProxyConfig.js';
import { normalizeCopilotPreToolUse, normalizeDetokPrompt } from './detokConfig.js';
import { normalizeCodeGraph, normalizePromptOptimization, normalizeTracing } from './featureConfig.js';
import { normalizeRegisteredTools, toolMatches } from './configToolRegistry.js';
import type { SerializerProviderId, UtkConfig } from './configTypes.js';

export {
  DEFAULT_CONFIG_TOML,
  DEFAULT_MODEL_PROXY_PROVIDER,
  MODEL_PROXY_PROVIDER_DEFAULTS,
  SUPPORTED_SERIALIZERS
} from './defaults.js';
export type { ModelProxyProviderDefaults } from './defaults.js';
export type { ModelProxyProviderId, ToolMatchingLevel, UtkConfig } from './configTypes.js';
export { resolveRegisteredTool } from './configToolRegistry.js';

type SerializationRegistryLike = {
  get(id: string): unknown;
  list(): Array<{ id: string }>;
};


export async function loadUtkConfig(workspaceRoot: string): Promise<UtkConfig> {
  const configPath = path.join(workspaceRoot, '.utk', 'config.toml');
  const text = await ensureConfigToml(configPath);
  return normalizeConfig(parse(text) as Record<string, unknown>);
}

export function resolveSerializerProviderId(config: UtkConfig, toolId: string, registry?: SerializationRegistryLike): SerializerProviderId {
  const override = resolveSerializerOverride(config.serialization.overrides, toolId);
  const selected = canonicalSerializerProviderId(override?.provider ?? config.serialization.default);
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
  const plugins = readOptionalObject(raw.plugins);
  const detok = readNamedOptionalObject(raw.detok, 'detok');
  const providers = readOptionalObject(serialization.providers);
  const tools = readOptionalObject(raw.tools);
  const toolMatching = readNamedOptionalObject(raw.tool_matching, 'tool_matching');
  const modelProxy = readNamedOptionalObject(raw.model_proxy, 'model_proxy');
  const codeGraph = readNamedOptionalObject(raw.code_graph, 'code_graph');
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
    plugins: {
      serialization_paths: readStringArray(plugins.serialization_paths, ['.utk/plugins/serialization'], 'plugins.serialization_paths')
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
      prompt: normalizeDetokPrompt(detok.prompt),
      copilot_pre_tool_use: normalizeCopilotPreToolUse(detok.copilot_pre_tool_use)
    },
    tools: {
      registry: normalizeRegisteredTools(tools.registry)
    },
    tool_matching: normalizeToolMatching(toolMatching),
    tracing: normalizeTracing(raw.tracing),
    model_proxy: normalizeModelProxy(modelProxy),
    code_graph: normalizeCodeGraph(codeGraph),
    prompt_optimization: normalizePromptOptimization(promptOptimization)
  };
}

function normalizeProviders(providers: Record<string, unknown>): Record<string, { enabled: boolean; config: Record<string, unknown> }> {
  const normalized: Record<string, { enabled: boolean; config: Record<string, unknown> }> = {};
  for (const providerId of SUPPORTED_SERIALIZERS) {
    normalized[providerId] = normalizeProvider(providers[providerId]);
  }
  for (const [providerId, value] of Object.entries(providers)) {
    normalized[canonicalSerializerProviderId(providerId)] = normalizeProvider(value);
  }
  return normalized;
}

function resolveSerializerOverride(overrides: Array<{ tool: string; provider: SerializerProviderId }>, toolId: string): { tool: string; provider: SerializerProviderId } | undefined {
  return overrides.find((item) => item.tool === toolId) ?? overrides.find((item) => toolMatches(item.tool, toolId));
}

function normalizeProvider(value: unknown): { enabled: boolean; config: Record<string, unknown> } {
  const provider = readOptionalObject(value);
  return { enabled: readBoolean(provider.enabled, true), config: readOptionalObject(provider.config) };
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
  if (typeof value === 'string' && value.length > 0) return canonicalSerializerProviderId(value);
  throw new Error(`Unsupported serialization provider: ${String(value)}`);
}

function canonicalSerializerProviderId(value: string): SerializerProviderId {
  return SERIALIZER_ALIASES[value] ?? value;
}
