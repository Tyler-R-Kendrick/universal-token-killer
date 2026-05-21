import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { contentHash } from '../artifact/canonical.js';
import { loadUtkConfig, type UtkConfig } from '../config/config.js';
import { loadPack, loadPackSync } from '../pack/loadPack.js';
import type { LoadedPack, PackSerializationPluginRecord } from '../pack/types.js';
import { generatedSerializerFromCompiledGrammar, type GeneratedSerializer } from './grammarCodec.js';

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
  serializers: Record<string, GeneratedSerializer>;
  register(provider: SerializationProvider): void;
  registerGenerated(serializer: GeneratedSerializer): void;
  get(id: string): SerializationProvider | undefined;
  require(id: string): SerializationProvider;
  list(): SerializationProvider[];
};

export type SerializationPluginManifest = {
  id: string;
  aliases?: string[];
  version: string;
  type: 'serialization';
  symbol: string;
  semantics: 'json-value-v1';
  grammar: string;
  extension: string;
  canonical: boolean;
  configFields: Record<string, unknown>;
};

export type SerializationRegistryOptions = {
  includeBuiltIns?: boolean;
};

const globalRegistry = createSerializationRegistry();

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

export function registerBuiltInSerializerPlugins(registry: SerializationRegistry): void {
  for (const pluginRoot of listSerializationPluginRootsSync(builtInSerializationPluginDir())) {
    registerSerializationPluginFromFolderSync(registry, pluginRoot);
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
      await registerSerializationPluginFromFolder(registry, pluginRoot);
      loadedRoots.add(resolved);
    }
  }

  for (const pluginRoot of await listSerializationPluginRoots(path.resolve(workspaceRoot, '.utk', 'packs'))) {
    const resolved = path.resolve(pluginRoot);
    if (loadedRoots.has(resolved)) continue;
    const manifest = await maybeLoadSerializationPluginManifest(pluginRoot);
    if (!manifest) continue;
    await registerSerializationPluginFromFolder(registry, pluginRoot);
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
  const manifest = serializationManifestFromPack(pack, plugin);
  await validateSerializationPluginIndex(pluginRoot, manifest);
  return manifest;
}

function registerSerializationPluginFromFolderSync(registry: SerializationRegistry, pluginRoot: string): void {
  const pack = loadPackSync(pluginRoot);
  const plugin = requireSingleSerializationPlugin(pack);
  const manifest = serializationManifestFromPack(pack, plugin);
  validateSerializationPluginIndexSync(pluginRoot, manifest);
  const grammar = normalizeGrammar(manifest, path.join(pluginRoot, manifest.grammar), plugin.grammar.lark);
  registerCompiledSerializationPlugin(registry, manifest, grammar);
}

async function registerSerializationPluginFromFolder(registry: SerializationRegistry, pluginRoot: string): Promise<void> {
  const pack = await loadPack(pluginRoot);
  const plugin = requireSingleSerializationPlugin(pack);
  const manifest = serializationManifestFromPack(pack, plugin);
  await validateSerializationPluginIndex(pluginRoot, manifest);
  const grammar = normalizeGrammar(manifest, path.join(pluginRoot, manifest.grammar), plugin.grammar.lark);
  registerCompiledSerializationPlugin(registry, manifest, grammar);
}

function registerCompiledSerializationPlugin(
  registry: SerializationRegistry,
  manifest: SerializationPluginManifest,
  grammar: SerializerGrammar
): void {
  registry.registerGenerated(generatedSerializerFromCompiledGrammar({
    id: manifest.id,
    symbol: manifest.symbol,
    aliases: manifest.aliases,
    extension: manifest.extension,
    grammar,
    semantics: manifest.semantics
  }));
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
    symbol: plugin.entry.symbol,
    semantics: plugin.entry.semantics,
    grammar: plugin.entry.grammar,
    extension: plugin.entry.extension,
    canonical: plugin.entry.canonical ?? true,
    configFields: plugin.entry.config_fields ?? {}
  };
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(manifest.id)) {
    throw new Error(`Serializer plugin pack ${pack.manifest.pack.name} has invalid id: ${manifest.id}`);
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(manifest.symbol)) {
    throw new Error(`Serializer plugin ${manifest.id} has invalid symbol: ${manifest.symbol}`);
  }
  return manifest;
}

async function validateSerializationPluginIndex(pluginRoot: string, manifest: SerializationPluginManifest): Promise<void> {
  const source = await readSerializationPluginIndex(pluginRoot, manifest);
  validateSerializationPluginIndexSource(source, manifest);
}

function validateSerializationPluginIndexSync(pluginRoot: string, manifest: SerializationPluginManifest): void {
  const source = readSerializationPluginIndexSync(pluginRoot, manifest);
  validateSerializationPluginIndexSource(source, manifest);
}

async function readSerializationPluginIndex(pluginRoot: string, manifest: SerializationPluginManifest): Promise<string> {
  for (const relative of serializationPluginIndexCandidates()) {
    try {
      return await readFile(path.join(pluginRoot, relative), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Serializer plugin ${manifest.id} index must export const ${manifest.symbol} = '${manifest.id}'`);
}

function readSerializationPluginIndexSync(pluginRoot: string, manifest: SerializationPluginManifest): string {
  for (const relative of serializationPluginIndexCandidates()) {
    const target = path.join(pluginRoot, relative);
    if (existsSync(target)) return readFileSync(target, 'utf8');
  }
  throw new Error(`Serializer plugin ${manifest.id} index must export const ${manifest.symbol} = '${manifest.id}'`);
}

function validateSerializationPluginIndexSource(source: string, manifest: SerializationPluginManifest): void {
  const exportPattern = /^\s*export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*(['"])([^'"]+)\2\s*(?:as\s+const)?\s*;\s*$/;
  let found = false;
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('//')) continue;
    const match = exportPattern.exec(line);
    if (!match) {
      throw new Error(`Serializer plugin ${manifest.id} index must be data-only const exports`);
    }
    if (match[1] === manifest.symbol && match[3] === manifest.id) found = true;
  }
  if (!found) {
    throw new Error(`Serializer plugin ${manifest.id} index must export const ${manifest.symbol} = '${manifest.id}'`);
  }
}

function serializationPluginIndexCandidates(): string[] {
  return ['index.ts', 'index.js', 'index.mjs'];
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
