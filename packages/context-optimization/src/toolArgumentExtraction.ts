import { normalizeArgKey, regexPhrase, trimPunctuation, unquote } from './toolText.js';

export type ToolArgumentCandidate = {
  parameters: Record<string, unknown>;
  defaultArgs: Record<string, unknown>;
  aliases: string[];
};

type DerivedArgContext = {
  request: string;
  text: string;
};
type DerivedArgInferer = (context: DerivedArgContext) => unknown | undefined;

const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const DERIVED_ARG_INFERERS: Record<string, DerivedArgInferer> = {
  url: ({ text }) => trimOptional(firstMatch(text, URL_PATTERN)),
  to: ({ text }) => firstMatch(text, EMAIL_PATTERN),
  path: ({ text }) => inferPath(text),
  pattern: ({ request }) => inferPattern(request),
  query: ({ request }) => inferQuery(request),
  content: ({ request }) => inferContent(request)
};

export function buildToolArgs(candidate: ToolArgumentCandidate, request: string, rawTail: string, captures: Record<string, string>): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const json = parseJsonArgs(rawTail);
  if (json) Object.assign(args, json);
  Object.assign(args, parseFlagArgs(rawTail), parseFlagArgs(request), cleanCaptureArgs(captures));
  applyDerivedArgs(args, candidate, request, rawTail);
  applySchemaDefaults(args, candidate.parameters);
  Object.assign(args, Object.fromEntries(Object.entries(candidate.defaultArgs).filter(([key]) => args[key] === undefined)));
  return args;
}

function parseJsonArgs(rawTail: string): Record<string, unknown> | undefined {
  const text = rawTail.trim();
  if (!text.startsWith('{')) return undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    return isObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function parseFlagArgs(text: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const flag = /--([A-Za-z_][\w.-]*)(?:\s+("[^"]*"|'[^']*'|\S+))?/g;
  for (const match of text.matchAll(flag)) {
    const key = normalizeArgKey(match[1] ?? '');
    if (key) args[key] = unquote(match[2] ?? 'true');
  }
  const kv = /\b([A-Za-z_][\w.-]*)=("[^"]*"|'[^']*'|\S+)/g;
  for (const match of text.matchAll(kv)) {
    const key = normalizeArgKey(match[1] ?? '');
    if (key) args[key] = unquote(match[2] ?? '');
  }
  return args;
}

function cleanCaptureArgs(captures: Record<string, string>): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(captures)) {
    if (key === 'tail') continue;
    args[normalizeArgKey(key)] = unquote(value.trim());
  }
  return args;
}

function applySchemaDefaults(args: Record<string, unknown>, parameters: Record<string, unknown>): void {
  const properties = isObject(parameters.properties) ? parameters.properties : {};
  for (const [key, value] of Object.entries(properties)) {
    if (args[key] !== undefined || !isObject(value) || value.default === undefined) continue;
    args[key] = value.default;
  }
}

function applyDerivedArgs(args: Record<string, unknown>, candidate: ToolArgumentCandidate, request: string, rawTail: string): void {
  const properties = propertyNames(candidate.parameters);
  const text = `${rawTail} ${request}`.trim();
  for (const name of properties) setDerivedArg(args, name, { request, text });
  const missing = properties.filter((name) => args[name] === undefined);
  const tail = stripCommandPrefix(rawTail || request, candidate.aliases).trim();
  const [onlyMissing] = missing;
  if (onlyMissing && missing.length === 1 && tail) args[onlyMissing] = normalizeSingleTarget(tail, onlyMissing);
}

function setDerivedArg(args: Record<string, unknown>, name: string, context: DerivedArgContext): void {
  if (args[name] !== undefined) return;
  const value = DERIVED_ARG_INFERERS[name]?.(context);
  if (value !== undefined) args[name] = value;
}

function propertyNames(parameters: Record<string, unknown>): string[] {
  const properties = isObject(parameters.properties) ? parameters.properties : {};
  return Object.keys(properties);
}

function inferPath(text: string): string | undefined {
  if (/\bpackage\s+json\b/i.test(text)) return 'package.json';
  const explicit = /\b(?:path|file|in|under|at)\s+("[^"]*"|'[^']*'|[A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+|[A-Za-z0-9_./\\-]+\/[A-Za-z0-9_./\\-]+)/i.exec(text)?.[1];
  if (explicit) return normalizeSingleTarget(explicit, 'path');
  const direct = /\b[A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+\b/.exec(text)?.[0];
  if (direct) return trimPunctuation(direct);
  const directory = /\b(?:src|docs|packages|test|tests|lib)(?:\/[A-Za-z0-9_.-]+)*\b/i.exec(text)?.[0];
  return directory ? trimPunctuation(directory) : undefined;
}

function inferPattern(request: string): string | undefined {
  const find = /\b(?:find|search|grep|look\s+for)\s+("[^"]*"|'[^']*'|[^\s]+)(?:\s+(?:in|under|inside|from)\b|$)/i.exec(request)?.[1];
  if (find) return unquote(find);
  const pattern = /\bpattern\s+("[^"]*"|'[^']*'|\S+)/i.exec(request)?.[1];
  return pattern ? unquote(pattern) : undefined;
}

function inferQuery(request: string): string | undefined {
  const query = request
    .replace(/^\s*(?:please\s+)?(?:web\s+search|search\s+web|find\s+online|look\s+up|search\s+for|search)\s*/i, '')
    .replace(/^\s*for\s+/i, '')
    .trim();
  return query && query !== request.trim() ? trimPunctuation(query) : undefined;
}

function inferContent(request: string): string | undefined {
  const content = /(?:with\s+content|content)\s+("[^"]*"|'[^']*'|.+)$/i.exec(request)?.[1];
  return content ? unquote(content.trim()) : undefined;
}

function firstMatch(text: string, pattern: RegExp): string | undefined {
  return pattern.exec(text)?.[0];
}

function trimOptional(value: string | undefined): string | undefined {
  return value ? trimPunctuation(value) : undefined;
}

function normalizeSingleTarget(value: string, key: string): string {
  const text = unquote(value.trim());
  if (key === 'path' && /^package\s+json$/i.test(text)) return 'package.json';
  return trimPunctuation(text);
}

function stripCommandPrefix(text: string, aliases: string[]): string {
  return stripAliasPrefix(text, aliases) ?? text.trim();
}

function stripAliasPrefix(text: string, aliases: string[]): string | undefined {
  for (const alias of [...aliases].sort((left, right) => right.length - left.length)) {
    const tail = stripAliasPrefixForAlias(text, alias);
    if (tail !== undefined) return tail;
  }
  return undefined;
}

function stripAliasPrefixForAlias(text: string, alias: string): string | undefined {
  const phrase = regexPhrase(alias);
  if (!phrase) return undefined;
  const match = new RegExp(`^\\s*${phrase}\\b`, 'iu').exec(text);
  const matched = match?.[0];
  return matched ? text.slice(matched.length).trim() : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
