import { normalizeToolId } from '../artifact/manifest.js';

export const MAX_DESCRIPTION_CHARS = 160;

export function sanitizeMetadataScalar(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s*---\s*/g, ' ')
    .replace(/\s+(?:name|tags|tools|version):\s*(?:\[[^\]]*\]|"[^"]*"|'[^']*'|[^\s.]+)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDescription(value: string): string {
  const sanitized = sanitizeMetadataScalar(value);
  if (!sanitized) return 'Use when this workflow repeats.';
  const prefixed = /^Use when\b/i.test(sanitized) ? sanitized : `Use when ${sanitized}`;
  const punctuated = /[.!?]$/.test(prefixed) ? prefixed : `${prefixed}.`;
  if (punctuated.length <= MAX_DESCRIPTION_CHARS) return punctuated;
  const clipped = punctuated.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd();
  return `${clipped.replace(/[.,;:!?-]+$/, '')}.`;
}

export function sanitizeBodyLine(value: string): string {
  return value
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, '')
    .trim();
}

export function sanitizeProcedurePreview(value: string): string {
  return sanitizeBodyLine(value);
}

export function yamlScalar(value: string): string {
  if (/^[A-Za-z0-9][A-Za-z0-9 _.,;:()/$@+-]*$/.test(value) && !/\s#/.test(value)) return value;
  return JSON.stringify(value);
}

export function fallbackTrigger(description: string): string {
  const cleaned = sanitizeMetadataScalar(description)
    .replace(/^Use when\s+/i, '')
    .replace(/\brepeats?\.?$/i, '')
    .replace(/\brepeated\.?$/i, '')
    .replace(/^[\s.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'this workflow repeats';
}

export function normalizeSkillSlug(value: string): string {
  if (!/[A-Za-z0-9]/.test(value)) return 'skill';
  return normalizeToolId(value).replace(/_/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'skill';
}

export function uniqueNormalizedLines(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const normalized = sanitizeBodyLine(value);
    const key = normalized.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeRequiredSkills(values: string[]): string[] {
  return uniqueNormalizedLines(values.map((value) => value.replace(/^\$/, '').trim())).filter(Boolean);
}
