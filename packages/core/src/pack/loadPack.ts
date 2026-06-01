import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { parse } from 'smol-toml';
import { safeJoin } from '../security/pathSafety.js';
import { recordFailure, type RunContext } from '../tracing/index.js';
import type { LoadedPack, UtkPackManifest } from './types.js';
import { normalizeManifest } from './packManifest.js';
import {
  loadPackGrammars,
  loadPackGrammarsSync,
  loadPackPlugins,
  loadPackPluginsSync,
  loadPackTemplates,
  loadPackTemplatesSync,
  loadPackTools,
  loadPackToolsSync
} from './packEntryLoaders.js';

export { normalizeManifest } from './packManifest.js';

export type LoadPackOptions = { tracer?: RunContext };

export async function loadPackManifest(packDir: string, options: LoadPackOptions = {}): Promise<UtkPackManifest> {
  const manifestPath = safeJoin(packDir, 'utk.pack.toml');
  try {
    const text = await readFile(manifestPath, 'utf8');
    const raw = parse(text) as Record<string, unknown>;
    return normalizeManifest(raw);
  } catch (error) {
    recordFailure(options.tracer, {
      name: 'pack.manifest.parse',
      runType: 'parser',
      error: error as Error,
      extra: { manifestPath }
    });
    throw error;
  }
}

export function loadPackManifestSync(packDir: string): UtkPackManifest {
  const manifestPath = safeJoin(packDir, 'utk.pack.toml');
  const text = readFileSync(manifestPath, 'utf8');
  const raw = parse(text) as Record<string, unknown>;
  return normalizeManifest(raw);
}

export async function loadPack(packDir: string, options: LoadPackOptions = {}): Promise<LoadedPack> {
  const manifest = await loadPackManifest(packDir, options);
  const tools = await loadPackTools(packDir, manifest.tools ?? []);
  const grammars = await loadPackGrammars(packDir, manifest.grammars ?? []);
  const templates = await loadPackTemplates(packDir, manifest.templates ?? []);
  const plugins = await loadPackPlugins(packDir, manifest.plugins ?? []);
  return { manifest, rootDir: packDir, tools, grammars, templates, plugins };
}

export function loadPackSync(packDir: string): LoadedPack {
  const manifest = loadPackManifestSync(packDir);
  const tools = loadPackToolsSync(packDir, manifest.tools ?? []);
  const grammars = loadPackGrammarsSync(packDir, manifest.grammars ?? []);
  const templates = loadPackTemplatesSync(packDir, manifest.templates ?? []);
  const plugins = loadPackPluginsSync(packDir, manifest.plugins ?? []);
  return { manifest, rootDir: packDir, tools, grammars, templates, plugins };
}
