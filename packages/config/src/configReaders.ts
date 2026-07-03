export function readObject(value: unknown, name: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${name} must be a TOML table`);
}

export function readOptionalObject(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  return readObject(value, 'configuration value');
}

export function readNamedOptionalObject(value: unknown, name: string): Record<string, unknown> {
  if (value === undefined) return {};
  return readObject(value, name);
}

export function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

export function readFiniteNumber(value: unknown, fallback: number, name: string): number {
  const numberValue = readNumber(value, fallback);
  if (!Number.isFinite(numberValue)) throw new TypeError(`${name} must be a finite number`);
  return numberValue;
}

export function readStringEnum<const T extends readonly string[]>(
  value: unknown,
  fallback: T[number],
  allowed: T,
  name: string
): T[number] {
  if (value === undefined) return fallback;
  if (typeof value === 'string' && allowed.includes(value)) return value;
  throw new Error(`Unsupported ${name}: ${String(value)}`);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function readStringArray(value: unknown, fallback: readonly string[], name: string): string[] {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be an array of strings`);
  }
  return [...value];
}

export function normalizeProviderOptions(value: unknown): Record<string, Record<string, unknown>> {
  const options = readOptionalObject(value);
  return Object.fromEntries(Object.entries(options).map(([providerId, providerOptions]) => [providerId, readOptionalObject(providerOptions)]));
}
