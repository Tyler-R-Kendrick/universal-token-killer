export function routeSpecificCompactObject(content: string, routeReason: string, query: string, protectedPreview: string): Record<string, unknown> {
  const base = {
    kind: routeReason,
    lines: content.split(/\r?\n/).length,
    chars: content.length,
    query: query.slice(0, 80) || undefined,
    facts: extractKeyFactLines(content, query),
    protected: protectedPreview || undefined
  };
  if (routeReason === 'structured-json-array') return { ...base, ...compactJsonArray(content) };
  if (routeReason === 'search-results') return { ...base, ...compactSearchResults(content) };
  if (routeReason === 'file-read-envelope') return { ...base, ...compactFileEnvelope(content) };
  if (routeReason === 'edit-loop') return { ...base, status: 'OK', summary: 'OK; raw edit output recoverable' };
  if (routeReason === 'test-error' || routeReason === 'build-log') return { ...base, diagnostics: extractDiagnostics(content), summary: summarizeContent(content, routeReason, query) };
  if (routeReason === 'diff') return { ...base, hunks: extractDiffHunks(content), summary: summarizeContent(content, routeReason, query) };
  return { ...base, summary: summarizeContent(content, routeReason, query) };
}

export function extractKeyFactLines(content: string, query: string): string[] {
  const queryTokens = query.toLowerCase().split(/[^a-z0-9_./:-]+/).filter((token) => token.length > 2);
  const lines = content.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^noise \d+:/.test(line) && !/^```/.test(line) && !/^<type>file<\/type>$/i.test(line) && !/^End of file$/i.test(line));
  const factLines = lines.filter((line) => {
    if (/^(command|cmd|path|file):/i.test(line)) return false;
    const lower = line.toLowerCase();
    return queryTokens.length === 0 || queryTokens.some((token) => lower.includes(token)) || /error|fail|ERR!|warning|denied|OK|OPEN|CLEAN|Plan:|diff --git|@@|<path>|End of file|rows|keys/i.test(line);
  });
  const fallbackLines = lines.slice(0, 6).filter((line) => {
    if (/^(command|cmd|path|file):/i.test(line)) return false;
    return true;
  });
  return unique([...factLines, ...fallbackLines])
    .slice(0, 8)
    .map((line) => line.slice(0, 220));
}

export function extractProtectedPreview(content: string): string {
  const lines = content.split(/\r?\n/);
  const protectedLines: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      protectedLines.push(line);
      continue;
    }
    if (inFence || /^(command|cmd|path|file|error|fatal):/i.test(line.trim()) || /error TS\d+/.test(line)) {
      protectedLines.push(line);
    }
    if (protectedLines.length >= 12) break;
  }
  return protectedLines.join('\n').slice(0, 800);
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function summarizeContent(content: string, routeReason: string, query: string): string {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const first = lines.slice(0, 3).join(' | ');
  return `${routeReason}; ${query ? `query="${query.slice(0, 64)}"; ` : ''}${first.slice(0, 240)}`;
}

function compactJsonArray(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) return { summary: 'invalid json array shape' };
    const rows = parsed.length;
    const objects = parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
    const keys = [...new Set(objects.flatMap((item) => Object.keys(item)))].sort();
    return { rows, keys, sample: parsed.slice(0, 3) };
  } catch {
    return { summary: summarizeContent(content, 'structured-json-array', '') };
  }
}

function compactSearchResults(content: string): Record<string, unknown> {
  const matches = content.split(/\r?\n/).filter(Boolean);
  const byFile = new Map<string, string[]>();
  for (const line of matches) {
    const match = /^(.+?):(\d+)(?::\d+)?:?(.*)$/.exec(line);
    if (!match) continue;
    const file = match[1];
    if (!file) continue;
    const lines = byFile.get(file) ?? [];
    lines.push(`${match[2]}:${match[3]?.trim() ?? ''}`.slice(0, 160));
    byFile.set(file, lines);
  }
  return {
    matches: matches.length,
    files: [...byFile.entries()].map(([file, lines]) => ({ file, matches: lines.length, sample: lines.slice(0, 3) })).slice(0, 20),
    summary: `matches=${matches.length}; files=${byFile.size}`
  };
}

function compactFileEnvelope(content: string): Record<string, unknown> {
  const pathMatch = /<path>([\s\S]*?)<\/path>/i.exec(content);
  const path = pathMatch?.[1]?.trim();
  const stripped = content
    .replace(/<type>file<\/type>/gi, '')
    .replace(/<path>[\s\S]*?<\/path>/gi, '')
    .replace(/End of file/gi, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  return {
    path,
    contentLines: stripped.length,
    sample: stripped.slice(0, 8),
    summary: `${path ?? 'file'} lines=${stripped.length}`
  };
}

function extractDiagnostics(content: string): string[] {
  return content.split(/\r?\n/)
    .filter((line) => /(?:error TS\d+|FAIL|Error:|ERR!|:\d+(?::\d+)?)/i.test(line))
    .slice(0, 20);
}

function extractDiffHunks(content: string): string[] {
  return content.split(/\r?\n/)
    .filter((line) => /^(diff --git|--- |\+\+\+ |@@ )/.test(line))
    .slice(0, 40);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}
