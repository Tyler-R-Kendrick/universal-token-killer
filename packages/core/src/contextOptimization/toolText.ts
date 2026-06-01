export function regexPhrase(alias: string): string {
  return alias
    .trim()
    .split(/\s+/)
    .map(escapeRegex)
    .join('[\\s_.-]+');
}

export function trimPunctuation(value: string): string {
  return value.replace(/^[\s"'`]+|[\s"'`,.;:!?]+$/g, '');
}

export function unquote(value: string): string {
  const trimmed = trimPunctuation(value);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) return trimmed.slice(1, -1);
  return trimmed;
}

export function normalizeArgKey(value: string): string {
  return value.replace(/[.-]/g, '_');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
