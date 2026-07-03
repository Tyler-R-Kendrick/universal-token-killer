import { contentHash } from '@utk/foundation';
import type { LoadedPack, PackSerializationPluginRecord } from '../pack/types.js';
import type { SerializationPluginManifest, SerializerGrammar } from './serializationTypes.js';

export function requireSingleSerializationPlugin(pack: LoadedPack): PackSerializationPluginRecord {
  const plugins = serializationPluginRecords(pack);
  if (plugins.length === 0) {
    throw new Error(`Pack ${pack.manifest.pack.name} does not declare a serialization plugin`);
  }
  if (plugins.length > 1) {
    throw new Error(`Pack ${pack.manifest.pack.name} declares multiple serialization plugins; load one plugin per pack root`);
  }
  return plugins[0]!;
}

export function serializationManifestFromPack(pack: LoadedPack, plugin: PackSerializationPluginRecord): SerializationPluginManifest {
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

export function normalizePluginGrammar(manifest: SerializationPluginManifest, grammarPath: string, source: string): SerializerGrammar {
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

function serializationPluginRecords(pack: LoadedPack): PackSerializationPluginRecord[] {
  return pack.plugins.filter((plugin): plugin is PackSerializationPluginRecord => plugin.entry.type === 'serialization');
}
