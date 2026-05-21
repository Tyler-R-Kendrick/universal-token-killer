import { readdirSync, statSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentHash } from '../artifact/canonical.js';
import { loadUtkConfig, type UtkConfig } from '../config/config.js';
import { loadPack, loadPackSync } from '../pack/loadPack.js';
import type { LoadedPack, PackSerializationPluginRecord } from '../pack/types.js';

export const BUILT_IN_SERIALIZER_IDS = ['json-compact', 'toon', 'tron'] as const;

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
  path?: string;
  hash?: string;
  llguidancePrefix?: string;
};

export type LarkGeneratedParser = {
  grammar: SerializerGrammar;
  parse<T>(text: string, parse: (text: string) => T): T;
};

export type SerializationProvider = {
  id: string;
  aliases?: string[];
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

export type SerializationPluginManifest = {
  id: string;
  aliases?: string[];
  version: string;
  type: 'serialization';
  module: string;
  grammar: string;
  extension: string;
  configFields: Record<string, unknown>;
};

export type UtkSerializerPluginContext = {
  manifest: SerializationPluginManifest;
  pluginRoot: string;
  grammar: SerializerGrammar;
  parser: LarkGeneratedParser;
  config: Record<string, unknown>;
};

export type UtkSerializerPlugin = {
  registerUtkSerializerPlugin(registry: SerializationRegistry, context: UtkSerializerPluginContext): void | Promise<void>;
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
  const aliases = new Map<string, string>();
  const registry: SerializationRegistry = {
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

export function registerBuiltInSerializerPlugins(registry: SerializationRegistry): void {
  for (const pluginRoot of listSerializationPluginRootsSync(builtInSerializationPluginDir())) {
    registerSerializationPluginFromFolderSync(registry, pluginRoot, {});
  }
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

export async function loadSerializationRegistry(workspaceRoot: string, config?: UtkConfig): Promise<SerializationRegistry> {
  const activeConfig = config ?? await loadUtkConfig(workspaceRoot);
  const registry = createSerializationRegistry();
  const loadedRoots = new Set<string>(listSerializationPluginRootsSync(builtInSerializationPluginDir()).map((root) => path.resolve(root)));

  for (const configuredPath of activeConfig.plugins.serialization_paths) {
    const pluginDir = path.resolve(workspaceRoot, configuredPath);
    for (const pluginRoot of await listSerializationPluginRoots(pluginDir)) {
      const resolved = path.resolve(pluginRoot);
      if (loadedRoots.has(resolved)) continue;
      await registerSerializationPluginFromFolder(registry, pluginRoot, providerConfig(activeConfig, pluginRoot));
      loadedRoots.add(resolved);
    }
  }

  for (const pluginRoot of await listSerializationPluginRoots(path.resolve(workspaceRoot, '.utk', 'packs'))) {
    const resolved = path.resolve(pluginRoot);
    if (loadedRoots.has(resolved)) continue;
    const manifest = await maybeLoadSerializationPluginManifest(pluginRoot);
    if (!manifest) continue;
    await registerSerializationPluginFromFolder(registry, pluginRoot, activeConfig.serialization.providers[manifest.id]?.config ?? {});
    loadedRoots.add(resolved);
    }

  return registry;
}

export function serializedExtension(id: string, registry: SerializationRegistry = globalRegistry): string {
  return registry.require(id).extension;
}

export async function loadSerializationPluginManifest(pluginRoot: string): Promise<SerializationPluginManifest> {
  const pack = await loadPack(pluginRoot);
  const plugin = requireSingleSerializationPlugin(pack);
  return serializationManifestFromPack(pack, plugin);
}

function registerSerializationPluginFromFolderSync(registry: SerializationRegistry, pluginRoot: string, config: Record<string, unknown>): void {
  const pack = loadPackSync(pluginRoot);
  const plugin = requireSingleSerializationPlugin(pack);
  const manifest = serializationManifestFromPack(pack, plugin);
  const grammar = normalizeGrammar(manifest, path.join(pluginRoot, manifest.grammar), plugin.grammar.lark);
  const modulePath = path.join(pluginRoot, plugin.entry.module);
  const pluginModule = createRequire(import.meta.url)(modulePath) as SerializerPluginModule;
  registerPluginModule(pluginModule, registry, pluginRoot, manifest, grammar, config);
}

async function registerSerializationPluginFromFolder(registry: SerializationRegistry, pluginRoot: string, config: Record<string, unknown>): Promise<void> {
  const pack = await loadPack(pluginRoot);
  const plugin = requireSingleSerializationPlugin(pack);
  const manifest = serializationManifestFromPack(pack, plugin);
  const grammar = normalizeGrammar(manifest, path.join(pluginRoot, manifest.grammar), plugin.grammar.lark);
  const modulePath = path.join(pluginRoot, plugin.entry.module);
  const pluginModule = await loadPluginModule(modulePath);
  await registerPluginModule(pluginModule, registry, pluginRoot, manifest, grammar, config);
}

async function loadPluginModule(modulePath: string): Promise<SerializerPluginModule> {
  if (modulePath.endsWith('.cjs')) {
    return createRequire(import.meta.url)(modulePath) as SerializerPluginModule;
  }
  return await import(pathToFileURL(modulePath).href) as SerializerPluginModule;
}

function registerPluginModule(
  pluginModule: SerializerPluginModule,
  registry: SerializationRegistry,
  pluginRoot: string,
  manifest: SerializationPluginManifest,
  grammar: SerializerGrammar,
  config: Record<string, unknown>
): void | Promise<void> {
  if (typeof pluginModule.registerUtkSerializerPlugin !== 'function') {
    throw new Error(`Serializer plugin ${manifest.id} must export registerUtkSerializerPlugin`);
  }
  return pluginModule.registerUtkSerializerPlugin(registry, {
    manifest,
    pluginRoot,
    grammar,
    parser: createLarkGeneratedParser(grammar),
    config
  });
}

function normalizeGrammar(manifest: SerializationPluginManifest, grammarPath: string, source: string): SerializerGrammar {
  if (!grammarPath.endsWith('.lark')) {
    throw new Error(`Serializer plugin ${manifest.id} grammar must be a .lark file`);
  }
  if (!/\bstart\s*:/.test(source)) {
    throw new Error(`Serializer plugin ${manifest.id} grammar missing start rule`);
  }
  return {
    format: 'lark',
    source,
    path: grammarPath,
    hash: contentHash(source, 16),
    llguidancePrefix: '%llguidance {}'
  };
}

function requireSingleSerializationPlugin(pack: LoadedPack): PackSerializationPluginRecord {
  const plugins = serializationPluginRecords(pack);
  if (plugins.length === 0) {
    throw new Error(`Pack ${pack.manifest.pack.name} does not declare a serialization plugin`);
  }
  if (plugins.length > 1) {
    throw new Error(`Pack ${pack.manifest.pack.name} declares multiple serialization plugins; load one plugin per pack root`);
  }
  return plugins[0]!;
}

function serializationPluginRecords(pack: LoadedPack): PackSerializationPluginRecord[] {
  return pack.plugins.filter((plugin): plugin is PackSerializationPluginRecord => plugin.entry.type === 'serialization');
}

function serializationManifestFromPack(pack: LoadedPack, plugin: PackSerializationPluginRecord): SerializationPluginManifest {
  const manifest: SerializationPluginManifest = {
    id: plugin.entry.id,
    aliases: plugin.entry.aliases,
    version: pack.manifest.pack.version,
    type: 'serialization',
    module: plugin.entry.module,
    grammar: plugin.entry.grammar,
    extension: plugin.entry.extension,
    configFields: plugin.entry.config_fields ?? {}
  };
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(manifest.id)) {
    throw new Error(`Serializer plugin pack ${pack.manifest.pack.name} has invalid id: ${manifest.id}`);
  }
  return manifest;
}

function createLarkGeneratedParser(grammar: SerializerGrammar): LarkGeneratedParser {
  if (grammar.format !== 'lark' || !/\bstart\s*:/.test(grammar.source)) {
    throw new Error('Cannot generate parser without valid Lark start rule');
  }
  return {
    grammar,
    parse(text, parse) {
      if (typeof text !== 'string') throw new TypeError('Parser input must be a string');
      return parse(text);
    }
  };
}

function providerConfig(config: UtkConfig, pluginRoot: string): Record<string, unknown> {
  try {
    const pack = loadPackSync(pluginRoot);
    const plugin = requireSingleSerializationPlugin(pack);
    const id = plugin.entry.id;
    return config.serialization.providers[id]?.config ?? {};
  } catch {
    return {};
  }
}

async function maybeLoadSerializationPluginManifest(pluginRoot: string): Promise<SerializationPluginManifest | undefined> {
  try {
    return await loadSerializationPluginManifest(pluginRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    if ((error as Error).message.includes('does not declare a serialization plugin')) return undefined;
    throw error;
  }
}

async function listSerializationPluginRoots(pluginDir: string): Promise<string[]> {
  try {
    const entries = await readdir(pluginDir);
    const roots: string[] = [];
    for (const entry of entries.sort()) {
      const fullPath = path.join(pluginDir, entry);
      if ((await stat(fullPath)).isDirectory()) roots.push(fullPath);
    }
    return roots;
  } catch {
    return [];
  }
}

function listSerializationPluginRootsSync(pluginDir: string): string[] {
  try {
    return readdirSync(pluginDir)
      .sort()
      .map((entry) => path.join(pluginDir, entry))
      .filter((entry) => statSync(entry).isDirectory());
  } catch {
    return [];
  }
}

function builtInSerializationPluginDir(): string {
  return path.resolve(import.meta.dirname, '../../../plugins/serialization');
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
