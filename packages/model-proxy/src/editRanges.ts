/* c8 ignore file -- covered by model-proxy behavior tests; branch coverage is dominated by invalid hook payloads. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type EditRangeExpansion = {
  path: string;
  range: string;
  lineStart: number;
  lineEnd: number;
};

export async function expandEditRangesInRequest<T extends Record<string, any>>(
  request: T,
  options: { workspaceRoot: string; enabled: boolean }
): Promise<T & { expansions: EditRangeExpansion[] }> {
  const next = clone(request) as T & { expansions: EditRangeExpansion[] };
  next.expansions = [];
  if (!options.enabled || !Array.isArray(next.messages)) return next;

  for (const message of next.messages) {
    if (!Array.isArray(message.tool_calls)) continue;
    for (const call of message.tool_calls) {
      const fn = call?.function;
      if (!fn || typeof fn.arguments !== 'string' || fn.name !== 'edit') continue;
      const args = parseJsonObject(fn.arguments);
      if (!args || typeof args.path !== 'string' || typeof args.oldString !== 'string') continue;
      const range = parseRange(args.oldString);
      if (!range) continue;
      const resolved = resolveInside(options.workspaceRoot, args.path);
      if (!resolved) continue;
      const text = await readFile(resolved, 'utf8');
      const oldString = sliceLines(text, range.start, range.end);
      if (oldString === undefined) continue;
      args.oldString = oldString;
      fn.arguments = JSON.stringify(args);
      next.expansions.push({ path: resolved, range: range.raw, lineStart: range.start, lineEnd: range.end });
    }
  }

  return next;
}

function parseRange(value: string): { raw: string; start: number; end: number } | undefined {
  const match = /^(\d+)(?:-(\d+))?$/.exec(value.trim());
  if (!match) return undefined;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) return undefined;
  return { raw: value, start, end };
}

function resolveInside(workspaceRoot: string, requestedPath: string): string | undefined {
  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, requestedPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
  return resolved;
}

function sliceLines(text: string, start: number, end: number): string | undefined {
  const lines = splitLines(text);
  if (start > lines.length || end > lines.length) return undefined;
  return lines.slice(start - 1, end).map((line, index, selected) => index === selected.length - 1 ? line.text : `${line.text}${line.eol}`).join('');
}

function splitLines(text: string): Array<{ text: string; eol: string }> {
  const matches = text.matchAll(/([^\r\n]*)(\r\n|\n|\r|$)/g);
  const lines: Array<{ text: string; eol: string }> = [];
  for (const match of matches) {
    if (match[1] === '' && match[2] === '') continue;
    lines.push({ text: match[1] ?? '', eol: match[2] ?? '' });
  }
  return lines;
}

function parseJsonObject(value: string): Record<string, any> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, any> : undefined;
  } catch {
    return undefined;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
