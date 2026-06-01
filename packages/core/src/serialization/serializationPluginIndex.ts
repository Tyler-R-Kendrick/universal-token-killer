import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SerializationPluginManifest } from './serializationTypes.js';

export async function validateSerializationPluginIndex(pluginRoot: string, manifest: SerializationPluginManifest): Promise<void> {
  const source = await readSerializationPluginIndex(pluginRoot, manifest);
  validateSerializationPluginIndexSource(source, manifest);
}

export function validateSerializationPluginIndexSync(pluginRoot: string, manifest: SerializationPluginManifest): void {
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
