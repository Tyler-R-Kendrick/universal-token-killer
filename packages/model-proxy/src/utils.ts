/* c8 ignore file -- Path safety varies by platform; behavior tests cover traversal and symlinks. */
import { createHash } from 'node:crypto';
import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';

export function contentHash(value: string | Buffer, length = 16): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

export function safeJoin(base: string, ...segments: string[]): string {
  const root = path.resolve(base);
  const target = path.resolve(root, ...segments);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path traversal blocked: ${target}`);
  }

  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      if (lstatSync(current).isSymbolicLink()) {
        const real = realpathSync(current);
        const linkRelative = path.relative(root, real);
        if (linkRelative.startsWith('..') || path.isAbsolute(linkRelative)) {
          throw new Error(`Symlink traversal blocked: ${current}`);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Symlink traversal blocked')) throw error;
    }
  }
  return target;
}
