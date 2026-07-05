import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Main-module check for CLI entrypoints exposed as npm bins. Compares
 * realpaths because npm bin shims are symlinks — a plain
 * `process.argv[1] === fileURLToPath(import.meta.url)` never matches there.
 */
export function isMainModule(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}
