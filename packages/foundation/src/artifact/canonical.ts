import { createHash } from 'node:crypto';

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value), null, 2);
}

export function canonicalJson(value: unknown): string {
  return `${stableStringify(value)}\n`;
}

export function contentHash(value: unknown, length = 10): string {
  return createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : stableStringify(value)).digest('hex').slice(0, length);
}

export function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortValue((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }

  return value;
}
