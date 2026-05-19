import path from 'node:path';

export function safeJoin(base: string, ...parts: string[]): string {
  const resolved = path.resolve(base, ...parts);
  const resolvedBase = path.resolve(base);
  if (!resolved.startsWith(`${resolvedBase}${path.sep}`) && resolved !== resolvedBase) {
    throw new Error('Path traversal blocked');
  }
  return resolved;
}
