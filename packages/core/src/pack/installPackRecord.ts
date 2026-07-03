import { canonicalJson, contentHash } from '@utk/foundation';
import type { InstalledPack, LoadedPack, PackPluginRecord } from './types.js';

export function createInstalledPackRecord(pack: LoadedPack, input: {
  source: string;
  revision: string;
  installedAt: string;
  templateIds: string[];
}): InstalledPack {
  return {
    name: pack.manifest.pack.name,
    version: pack.manifest.pack.version,
    source: input.source,
    revision: input.revision,
    contentHash: packContentHash(pack),
    installedAt: input.installedAt,
    tools: pack.tools.map((tool) => tool.entry.id),
    templates: input.templateIds,
    grammars: pack.grammars.map((grammar) => ({
      tool: grammar.tool,
      field: grammar.field,
      larkHash: grammar.larkHash
    })),
    plugins: pack.plugins.map((plugin) => pluginLockEntry(plugin))
  };
}

function packContentHash(pack: LoadedPack): string {
  return contentHash(canonicalJson({
    manifest: pack.manifest,
    tools: pack.tools.map((tool) => tool.source),
    grammars: pack.grammars.map((grammar) => ({
      tool: grammar.tool,
      field: grammar.field,
      lark: grammar.lark
    })),
    templates: pack.templates.map((template) => template.source),
    plugins: pack.plugins.map((plugin) => pluginContentForHash(plugin))
  }), 16);
}

function pluginContentForHash(plugin: PackPluginRecord): Record<string, unknown> {
  if ('grammar' in plugin) {
    return { entry: plugin.entry, lark: plugin.grammar.lark };
  }
  return { entry: plugin.entry };
}

function pluginLockEntry(plugin: PackPluginRecord): InstalledPack['plugins'][number] {
  if ('grammar' in plugin) {
    return {
      type: 'serialization',
      id: plugin.entry.id,
      larkHash: plugin.grammar.larkHash
    };
  }
  return {
    type: 'agent',
    id: plugin.entry.id,
    target: plugin.entry.target
  };
}
