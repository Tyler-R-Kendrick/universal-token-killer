/**
 * Deterministic capability indexes backing ladder rungs 3 and 4. These are
 * data, not heuristics: a capability resolves only on an exact key match,
 * and language packs extend the indexes rather than fuzzy-matching.
 */
export const TYPESCRIPT_STDLIB_CAPABILITIES: Record<string, string> = {
  structuredClone: 'structuredClone(value) deep-clones without a dependency',
  jsonParse: 'JSON.parse(text) parses JSON without a dependency',
  jsonStringify: 'JSON.stringify(value) serializes JSON without a dependency',
  arrayDedupe: 'new Set(items) deduplicates without a dependency',
  randomUuid: "crypto.randomUUID() from 'node:crypto' issues UUIDs without a dependency"
};

export const TYPESCRIPT_PLATFORM_CAPABILITIES: Record<string, string> = {
  fetch: 'global fetch() performs HTTP requests without an HTTP client dependency',
  urlParse: 'new URL(text) parses URLs without a dependency',
  abortSignal: 'AbortSignal.timeout(ms) cancels work without a dependency',
  datePicker: '<input type="date"> provides date picking without a widget library'
};

export function stdlibCapabilities(language: string): Record<string, string> {
  return language === 'typescript' ? TYPESCRIPT_STDLIB_CAPABILITIES : {};
}

export function platformCapabilities(language: string): Record<string, string> {
  return language === 'typescript' ? TYPESCRIPT_PLATFORM_CAPABILITIES : {};
}
