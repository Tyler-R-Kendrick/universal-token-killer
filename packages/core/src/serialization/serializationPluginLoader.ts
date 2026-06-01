import path from 'node:path';
import { loadPack, loadPackSync } from '../pack/loadPack.js';
import { generatedSerializerFromCompiledGrammar } from './grammarCodec.js';
import type { SerializationPluginManifest, SerializationRegistry, SerializerGrammar } from './serializationTypes.js';
import { validateSerializationPluginIndex, validateSerializationPluginIndexSync } from './serializationPluginIndex.js';
import {
  normalizePluginGrammar,
  requireSingleSerializationPlugin,
  serializationManifestFromPack
} from './serializationPluginManifest.js';
import {
  builtInSerializationPluginDir,
  listSerializationPluginRoots,
  listSerializationPluginRootsSync
} from './serializationPluginRoots.js';

export {
  builtInSerializationPluginDir,
  listSerializationPluginRoots,
  listSerializationPluginRootsSync
} from './serializationPluginRoots.js';

export function registerBuiltInSerializerPlugins(registry: SerializationRegistry): void {
  for (const pluginRoot of listSerializationPluginRootsSync(builtInSerializationPluginDir())) {
    registerSerializationPluginFromFolderSync(registry, pluginRoot);
  }
}

export async function loadSerializationPluginManifest(pluginRoot: string): Promise<SerializationPluginManifest> {
  const pack = await loadPack(pluginRoot);
  const plugin = requireSingleSerializationPlugin(pack);
  const manifest = serializationManifestFromPack(pack, plugin);
  await validateSerializationPluginIndex(pluginRoot, manifest);
  return manifest;
}

export function registerSerializationPluginFromFolderSync(registry: SerializationRegistry, pluginRoot: string): void {
  const pack = loadPackSync(pluginRoot);
  const plugin = requireSingleSerializationPlugin(pack);
  const manifest = serializationManifestFromPack(pack, plugin);
  validateSerializationPluginIndexSync(pluginRoot, manifest);
  const grammar = normalizePluginGrammar(manifest, path.join(pluginRoot, manifest.grammar), plugin.grammar.lark);
  registerCompiledSerializationPlugin(registry, manifest, grammar);
}

export async function registerSerializationPluginFromFolder(registry: SerializationRegistry, pluginRoot: string): Promise<void> {
  const pack = await loadPack(pluginRoot);
  const plugin = requireSingleSerializationPlugin(pack);
  const manifest = serializationManifestFromPack(pack, plugin);
  await validateSerializationPluginIndex(pluginRoot, manifest);
  const grammar = normalizePluginGrammar(manifest, path.join(pluginRoot, manifest.grammar), plugin.grammar.lark);
  registerCompiledSerializationPlugin(registry, manifest, grammar);
}

export async function maybeLoadSerializationPluginManifest(pluginRoot: string): Promise<SerializationPluginManifest | undefined> {
  try {
    return await loadSerializationPluginManifest(pluginRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    if ((error as Error).message.includes('does not declare a serialization plugin')) return undefined;
    throw error;
  }
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
