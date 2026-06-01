import { readdirSync, statSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export async function listSerializationPluginRoots(pluginDir: string): Promise<string[]> {
  try {
    const entries = await readdir(pluginDir);
    const roots: string[] = [];
    for (const entry of entries.sort()) {
      const fullPath = path.join(pluginDir, entry);
      if ((await stat(fullPath)).isDirectory()) roots.push(fullPath);
    }
    return roots;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export function listSerializationPluginRootsSync(pluginDir: string): string[] {
  try {
    return readdirSync(pluginDir)
      .sort()
      .map((entry) => path.join(pluginDir, entry))
      .filter((entry) => statSync(entry).isDirectory());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export function builtInSerializationPluginDir(): string {
  return path.resolve(import.meta.dirname, '../../../plugins/serialization');
}
