import path from 'node:path';
import { loadUtkConfig, type UtkConfig } from '../config/config.js';
import { createSerializationRegistry } from './serializationRegistry.js';
import {
  builtInSerializationPluginDir,
  listSerializationPluginRoots,
  listSerializationPluginRootsSync,
  maybeLoadSerializationPluginManifest,
  registerSerializationPluginFromFolder
} from './serializationPluginLoader.js';
import type { SerializationProvider, SerializationRegistry, SerializerGrammar } from './serializationTypes.js';

export { loadSerializationPluginManifest, registerBuiltInSerializerPlugins } from './serializationPluginLoader.js';
export { createSerializationRegistry } from './serializationRegistry.js';
export type {
  SerializationContext,
  SerializationPluginManifest,
  SerializationProvider,
  SerializationRegistry,
  SerializationRegistryOptions,
  SerializationValidation,
  SerializerGrammar
} from './serializationTypes.js';

export const BUILT_IN_SERIALIZER_IDS = ['json-compact', 'toon', 'tron'] as const;

const globalRegistry = createSerializationRegistry();

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
