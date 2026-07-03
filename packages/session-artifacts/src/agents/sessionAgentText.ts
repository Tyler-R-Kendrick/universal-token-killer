import { normalizeToolId } from '@utk/foundation';

const MAX_DESCRIPTION_CHARS = 160;

export function normalizeAgentSlug(value: string): string {
  if (!/[A-Za-z0-9]/.test(value)) return 'agent';
  const normalized = normalizeToolId(value).replace(/_/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return normalized || 'agent';
}

export function normalizeDescription(value: string): string {
  const sanitized = sanitizeLine(value)
    .replace(/\s+(?:name|tools|agents|handoffs|model|target):\s*(?:\[[^\]]*\]|"[^"]*"|'[^']*'|[^\s.]+)/gi, '')
    .trim();
  const prefixed = /^Use when\b/i.test(sanitized) ? sanitized : `Use when ${sanitized || 'this agent repeats'}`;
  const punctuated = /[.!?]$/.test(prefixed) ? prefixed : `${prefixed}.`;
  if (punctuated.length <= MAX_DESCRIPTION_CHARS) return punctuated;
  return `${punctuated.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd().replace(/[.,;:!?-]+$/, '')}.`;
}

export function uniqueLines(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const sanitized = sanitizeLine(value);
    const key = sanitized.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(sanitized);
  }
  return result;
}

export function sanitizeLine(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s*---\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function yamlScalar(value: string): string {
  if (/^https?:\/\/\S+$/.test(value)) return value;
  if (/^[A-Za-z0-9][A-Za-z0-9 _.,;/$@+-]*$/.test(value) && !/\s#/.test(value)) return value;
  return JSON.stringify(value);
}

export function yamlInlineArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}
