import { registerBuiltInSerializerPlugins } from './serializationPluginLoader.js';
import type {
  GeneratedSerializer,
  SerializationProvider,
  SerializationRegistry,
  SerializationRegistryOptions
} from './serializationTypes.js';

export function createSerializationRegistry(options: SerializationRegistryOptions = {}): SerializationRegistry {
  const providers = new Map<string, SerializationProvider>();
  const aliases = new Map<string, string>();
  const serializers: Record<string, GeneratedSerializer> = {};
  const registry: SerializationRegistry = {
    serializers,
    register(provider) {
      assertValidProvider(provider);
      if (providers.has(provider.id) || aliases.has(provider.id)) {
        throw new Error(`Serialization provider already registered: ${provider.id}`);
      }
      providers.set(provider.id, provider);
      for (const alias of provider.aliases ?? []) {
        if (providers.has(alias) || aliases.has(alias)) {
          throw new Error(`Serialization provider alias already registered: ${alias}`);
        }
        aliases.set(alias, provider.id);
      }
    },
    registerGenerated(serializer) {
      registry.register(serializer.provider);
      serializers[serializer.id] = serializer;
      for (const alias of serializer.aliases ?? []) {
        serializers[alias] = serializer;
      }
    },
    get(id) {
      return providers.get(id) ?? providers.get(aliases.get(id) ?? '');
    },
    require(id) {
      const provider = registry.get(id);
      if (!provider) {
        throw new Error(`Unsupported serialization provider: ${id}. Loaded providers: ${providerList(providers)}`);
      }
      return provider;
    },
    list() {
      return [...providers.values()];
    }
  };

  if (options.includeBuiltIns !== false) {
    registerBuiltInSerializerPlugins(registry);
  }

  return registry;
}

function assertValidProvider(provider: SerializationProvider): void {
  if (!provider || typeof provider !== 'object') {
    throw new Error('Serialization provider must be an object');
  }
  const id = provider.id;
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(id)) {
    throw new Error(`Serialization provider has invalid id: ${String(id)}`);
  }
  if (provider.aliases !== undefined && (!Array.isArray(provider.aliases) || provider.aliases.some((alias) => typeof alias !== 'string'))) {
    throw new Error(`Serialization provider ${id} has invalid aliases`);
  }
  if (typeof provider.extension !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(provider.extension)) {
    throw new Error(`Serialization provider ${id} has invalid extension`);
  }
  for (const method of ['serialize', 'deserialize', 'validate', 'estimateTokens'] as const) {
    if (typeof provider[method] !== 'function') {
      throw new Error(`Serialization provider ${id} is missing ${method}`);
    }
  }
  if (provider.grammar) {
    if (provider.grammar.format !== 'lark') {
      throw new Error(`Serialization provider ${id} has unsupported grammar format`);
    }
    if (typeof provider.grammar.source !== 'string' || provider.grammar.source.trim().length === 0) {
      throw new Error(`Serialization provider ${id} has empty grammar source`);
    }
  }
}

function providerList(providers: Map<string, SerializationProvider>): string {
  return [...providers.keys()].sort().join(', ');
}
