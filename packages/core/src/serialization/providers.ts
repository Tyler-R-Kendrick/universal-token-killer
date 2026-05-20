import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerUtkSerializerPlugin as registerCompressedJsonSerializer } from './plugins/compressedJson.js';
import { registerUtkSerializerPlugin as registerToonSerializer } from './plugins/toon.js';
import { registerUtkSerializerPlugin as registerTronSerializer } from './plugins/tron.js';

export const BUILT_IN_SERIALIZER_IDS = ['toon', 'compressed-json', 'tron'] as const;

export type SerializationContext = {
  toolId: string;
};

export type SerializationValidation = {
  valid: boolean;
  errors: string[];
  regenerated?: string;
};

export type SerializerGrammar = {
  format: 'lark';
  source: string;
  llguidancePrefix?: string;
};

export type LarkBackedSerializerDefinition = {
  grammar: SerializerGrammar;
};

export type SerializationProvider = {
  id: string;
  extension: string;
  grammar?: SerializerGrammar;
  serialize(value: unknown, context: SerializationContext): string;
  deserialize(text: string, context: SerializationContext): unknown;
  validate(value: unknown, text: string, context?: SerializationContext): SerializationValidation;
  estimateTokens(text: string): number;
};

export type SerializationRegistry = {
  register(provider: SerializationProvider): void;
  get(id: string): SerializationProvider | undefined;
  require(id: string): SerializationProvider;
  list(): SerializationProvider[];
};

export type UtkSerializerPlugin = {
  name: string;
  registerUtkSerializerPlugin(registry: SerializationRegistry): void | Promise<void>;
};

export type SerializationRegistryOptions = {
  includeBuiltIns?: boolean;
};

type SerializerPluginModule = {
  registerUtkSerializerPlugin?: unknown;
};

const globalRegistry = createSerializationRegistry();

export function createSerializationRegistry(options: SerializationRegistryOptions = {}): SerializationRegistry {
  const providers = new Map<string, SerializationProvider>();
  const registry: SerializationRegistry = {
    register(provider) {
      assertValidProvider(provider);
      if (providers.has(provider.id)) {
        throw new Error(`Serialization provider already registered: ${provider.id}`);
      }
      providers.set(provider.id, provider);
    },
    get(id) {
      return providers.get(id);
    },
    require(id) {
      const provider = providers.get(id);
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

export function registerBuiltInSerializerPlugins(registry: SerializationRegistry): void {
  registerToonSerializer(registry);
  registerCompressedJsonSerializer(registry);
  registerTronSerializer(registry);
}

export function registerSerializationProvider(provider: SerializationProvider): void {
  globalRegistry.register(provider);
}

export function getSerializationProvider(id: string): SerializationProvider {
  return globalRegistry.require(id);
}

export function listSerializationProviders(): SerializationProvider[] {
  return globalRegistry.list();
}

export function getSerializerGrammar(id: string, registry: SerializationRegistry = globalRegistry): SerializerGrammar | undefined {
  const provider = registry.get(id);
  return provider?.grammar;
}

export async function loadSerializationRegistry(workspaceRoot: string): Promise<SerializationRegistry> {
  const registry = createSerializationRegistry();
  const packageJsonPath = path.join(workspaceRoot, 'package.json');
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(await readFile(packageJsonPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return registry;
  }

  for (const packageName of serializerPluginPackageNames(manifest)) {
    await loadSerializerPlugin(packageJsonPath, packageName, registry);
  }

  return registry;
}

export function serializedExtension(id: string, registry: SerializationRegistry = globalRegistry): string {
  return registry.require(id).extension;
}

async function loadSerializerPlugin(packageJsonPath: string, packageName: string, registry: SerializationRegistry): Promise<void> {
  const requireFromWorkspace = createRequire(packageJsonPath);
  let entry: string;
  try {
    entry = requireFromWorkspace.resolve(packageName);
  } catch (error) {
    throw new Error(`Serializer plugin ${packageName} could not be resolved: ${String(error)}`);
  }

  const pluginModule = await import(pathToFileURL(entry).href) as SerializerPluginModule;
  if (typeof pluginModule.registerUtkSerializerPlugin !== 'function') {
    throw new Error(`Serializer plugin ${packageName} must export registerUtkSerializerPlugin`);
  }

  await pluginModule.registerUtkSerializerPlugin(registry);
}

function serializerPluginPackageNames(manifest: Record<string, unknown>): string[] {
  const fields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  const names = new Set<string>();
  for (const field of fields) {
    const deps = manifest[field];
    if (!deps || typeof deps !== 'object' || Array.isArray(deps)) continue;
    for (const name of Object.keys(deps)) {
      if (isSerializerPluginPackageName(name)) {
        names.add(name);
      }
    }
  }
  return [...names].sort();
}

function isSerializerPluginPackageName(name: string): boolean {
  return name.startsWith('utk-serializer-') || name.startsWith('@utk/serializer-');
}

function assertValidProvider(provider: SerializationProvider): void {
  if (!provider || typeof provider !== 'object') {
    throw new Error('Serialization provider must be an object');
  }
  const id = provider.id;
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(id)) {
    throw new Error(`Serialization provider has invalid id: ${String(id)}`);
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
