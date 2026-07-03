export type CacheVolatilityFinding = {
  kind: 'timestamp' | 'uuid' | 'jwt' | 'hash';
  value: string;
};

export function detectCacheVolatility(text: string, mode: 'observe' = 'observe'): {
  mode: 'observe';
  findings: CacheVolatilityFinding[];
  rewrittenText: string;
} {
  const findings: CacheVolatilityFinding[] = [];
  collect(findings, 'timestamp', text, /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g);
  collect(findings, 'uuid', text, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi);
  collect(findings, 'jwt', text, /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g);
  collect(findings, 'hash', text, /\b[a-f0-9]{32,64}\b/gi);
  return { mode, findings, rewrittenText: text };
}

function collect(findings: CacheVolatilityFinding[], kind: CacheVolatilityFinding['kind'], text: string, regex: RegExp): void {
  for (const match of text.matchAll(regex)) findings.push({ kind, value: match[0] });
}
