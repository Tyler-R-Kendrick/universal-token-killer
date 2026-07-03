import { lstatSync } from 'node:fs';
import path from 'node:path';

export function safeJoin(base: string, ...parts: string[]): string {
  const resolved = path.resolve(base, ...parts);
  const resolvedBase = path.resolve(base);
  if (!resolved.startsWith(`${resolvedBase}${path.sep}`) && resolved !== resolvedBase) {
    throw new Error('Path traversal blocked');
  }
  assertNoSymlinkTraversal(resolvedBase, resolved);
  return resolved;
}

function assertNoSymlinkTraversal(resolvedBase: string, resolved: string): void {
  let current = resolvedBase;
  assertNotSymlink(current);
  for (const segment of path.relative(resolvedBase, resolved).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    assertNotSymlink(current);
  }
}

function assertNotSymlink(filePath: string): void {
  try {
    /* v8 ignore start -- creating symlinks is privilege-gated on Windows test hosts */
    if (lstatSync(filePath).isSymbolicLink()) {
      throw new Error('Symlink traversal blocked');
    }
    /* v8 ignore stop */
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return;
    }
    /* v8 ignore next -- lstat errors other than ENOENT/ENOTDIR are platform/filesystem specific */
    throw error;
  }
}
