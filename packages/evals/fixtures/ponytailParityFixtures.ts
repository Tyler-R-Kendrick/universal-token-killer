import { defineMacro, type MacroDescriptor, type MinMapEntry } from '@utk/emission';
import { estimateTokens } from '../assertions/tokenBudgets.js';

export const PONYTAIL_MODES = ['lite', 'full', 'ultra'] as const;
export type PonytailMode = (typeof PONYTAIL_MODES)[number];
export type PonytailModeBaselines = Record<PonytailMode, string>;

export const PONYTAIL_PARITY_MACROS: Record<string, MacroDescriptor> = {
  httpGetJson: defineMacro({
    name: 'httpGetJson',
    description: 'fetch a URL and parse the JSON body',
    params: ['targetUrl'],
    expansion: 'fetch({{targetUrl}}).then((response) => response.json())'
  })
};

export type PonytailParityFixture = {
  name: string;
  category: string;
  useCase: string;
  testStrategy: string;
  ponytailStrength: string;
  utkApproach: string;
  request: string;
  capability: string;
  verboseBaseline: string;
  ponytailBaseline: string;
  ponytailBaselines: PonytailModeBaselines;
  /** The GGE arm: what the model actually emits — @minmap patch plus min code. */
  utkMinEmission: string;
  /** Deterministic expansion of the min emission — the only user-facing form. */
  utkPrettyExpected: string;
  mapEntries: MinMapEntry[];
  macroNames: string[];
  requiredTerms: string[];
  maxTokenRatio: number;
};

type PonytailParityFixtureParams = Omit<PonytailParityFixture, 'ponytailBaselines' | 'maxTokenRatio' | 'mapEntries' | 'macroNames'> &
  Partial<Pick<PonytailParityFixture, 'maxTokenRatio' | 'mapEntries' | 'macroNames'>> & {
    ponytailBaselines?: Partial<PonytailModeBaselines>;
  };

function fixture(params: PonytailParityFixtureParams): PonytailParityFixture {
  const full = params.ponytailBaselines?.full ?? params.ponytailBaseline;
  const baselines: PonytailModeBaselines = {
    lite: params.ponytailBaselines?.lite ?? `// Reviewed the request; this is the simplest sufficient implementation.\n${full}`,
    full,
    ultra: params.ponytailBaselines?.ultra ?? full
  };
  return {
    maxTokenRatio: 1,
    mapEntries: [],
    macroNames: [],
    ...params,
    ponytailBaseline: full,
    ponytailBaselines: baselines
  };
}

const HTTP_GET_JSON_MACRO_ENTRY: MinMapEntry = { minId: 'm1', pretty: 'httpGetJson', kind: 'macro', provenance: 'new' };

export const PONYTAIL_PARITY_FIXTURES: PonytailParityFixture[] = [
  fixture({
    name: 'fetch-json-retry',
    category: 'Emission: resilient helper',
    useCase: 'Emit a retrying JSON fetch helper with timeout handling plus a null-safe wrapper.',
    testStrategy: 'Round-trip fidelity, parse validity, and strict min-token wins over every Ponytail mode arm.',
    ponytailStrength: 'Writes the minimum viable retry loop with no prose and no dependency.',
    utkApproach: 'Declare repeated identifiers once in a @minmap patch, emit single-token ids at every use.',
    request: 'Add fetchJsonWithRetry(requestUrl, maxAttempts, timeoutMs) with abort timeout and status checks, plus a fetchJsonOrNull wrapper.',
    capability: 'fetchJsonWithRetry',
    verboseBaseline: [
      'Sure! Here is a robust retry helper plus a null-safe wrapper. The helper wraps the native fetch API, adds an',
      'AbortSignal-based timeout so requests cannot hang forever, validates the HTTP status, and retries up to the',
      'configured number of attempts before surfacing the last error it saw.',
      '',
      'export async function fetchJsonWithRetry(requestUrl: string, maxAttempts: number, timeoutMs: number) {',
      'let lastError: unknown;',
      'for (let attempt = 0; attempt < maxAttempts; attempt += 1) {',
      'try {',
      'const response = await fetch(requestUrl, { signal: AbortSignal.timeout(timeoutMs) });',
      'if (!response.ok) {',
      "throw new Error('retry request failed with status ' + response.status);",
      '}',
      'return await response.json();',
      '} catch (caught) {',
      'lastError = caught;',
      '}',
      '}',
      'throw lastError;',
      '}',
      'export async function fetchJsonOrNull(requestUrl: string, maxAttempts: number, timeoutMs: number) {',
      'try {',
      'return await fetchJsonWithRetry(requestUrl, maxAttempts, timeoutMs);',
      '} catch {',
      'return null;',
      '}',
      '}',
      '',
      'You can tune maxAttempts and timeoutMs per call site; the wrapper swallows the final error and returns null for',
      'callers that prefer a soft failure.'
    ].join('\n'),
    ponytailBaseline: [
      'export async function fetchJsonWithRetry(requestUrl: string, maxAttempts: number, timeoutMs: number) {',
      'let lastError: unknown;',
      'for (let attempt = 0; attempt < maxAttempts; attempt += 1) {',
      'try {',
      'const response = await fetch(requestUrl, { signal: AbortSignal.timeout(timeoutMs) });',
      'if (!response.ok) {',
      "throw new Error('retry request failed with status ' + response.status);",
      '}',
      'return await response.json();',
      '} catch (caught) {',
      'lastError = caught;',
      '}',
      '}',
      'throw lastError;',
      '}',
      'export async function fetchJsonOrNull(requestUrl: string, maxAttempts: number, timeoutMs: number) {',
      'try {',
      'return await fetchJsonWithRetry(requestUrl, maxAttempts, timeoutMs);',
      '} catch {',
      'return null;',
      '}',
      '}'
    ].join('\n'),
    ponytailBaselines: {
      ultra: [
        'export async function fetchJsonWithRetry(requestUrl: string, maxAttempts: number, timeoutMs: number) {',
        'let lastError: unknown;',
        'for (let attempt = 0; attempt < maxAttempts; attempt += 1) {',
        'try {',
        'const response = await fetch(requestUrl, { signal: AbortSignal.timeout(timeoutMs) });',
        'if (response.ok) return await response.json();',
        "lastError = new Error('retry request failed with status ' + response.status);",
        '} catch (caught) {',
        'lastError = caught;',
        '}',
        '}',
        'throw lastError;',
        '}',
        'export async function fetchJsonOrNull(requestUrl: string, maxAttempts: number, timeoutMs: number) {',
        'return fetchJsonWithRetry(requestUrl, maxAttempts, timeoutMs).catch(() => null);',
        '}'
      ].join('\n')
    },
    utkMinEmission: [
      '@minmap + f fetchJsonWithRetry + u requestUrl + x maxAttempts + t timeoutMs + l lastError + a attempt + r response @end',
      'export async function f(u: string, x: number, t: number) {',
      'let l: unknown;',
      'for (let a = 0; a < x; a += 1) {',
      'try {',
      'const r = await fetch(u, { signal: AbortSignal.timeout(t) });',
      'if (!r.ok) {',
      "throw new Error('retry request failed with status ' + r.status);",
      '}',
      'return await r.json();',
      '} catch (caught) {',
      'l = caught;',
      '}',
      '}',
      'throw l;',
      '}',
      'export async function fetchJsonOrNull(u: string, x: number, t: number) {',
      'try {',
      'return await f(u, x, t);',
      '} catch {',
      'return null;',
      '}',
      '}'
    ].join('\n'),
    utkPrettyExpected: [
      'export async function fetchJsonWithRetry(requestUrl: string, maxAttempts: number, timeoutMs: number) {',
      'let lastError: unknown;',
      'for (let attempt = 0; attempt < maxAttempts; attempt += 1) {',
      'try {',
      'const response = await fetch(requestUrl, { signal: AbortSignal.timeout(timeoutMs) });',
      'if (!response.ok) {',
      "throw new Error('retry request failed with status ' + response.status);",
      '}',
      'return await response.json();',
      '} catch (caught) {',
      'lastError = caught;',
      '}',
      '}',
      'throw lastError;',
      '}',
      'export async function fetchJsonOrNull(requestUrl: string, maxAttempts: number, timeoutMs: number) {',
      'try {',
      'return await fetchJsonWithRetry(requestUrl, maxAttempts, timeoutMs);',
      '} catch {',
      'return null;',
      '}',
      '}'
    ].join('\n'),
    requiredTerms: ['fetchJsonWithRetry', 'fetchJsonOrNull', 'requestUrl', 'maxAttempts', 'AbortSignal', 'fetch', 'json', 'lastError']
  }),
  fixture({
    name: 'widget-api-macro-helpers',
    category: 'Emission: macro idioms',
    useCase: 'Emit three JSON API helpers that all share the fetch-then-json idiom.',
    testStrategy: 'Macro-call compression of a repeated idiom with expansion equality against the committed pretty form.',
    ponytailStrength: 'Writes each helper as a compact one-line arrow function.',
    utkApproach: 'Collapse the shared fetch-then-json idiom into a single-token macro call per helper.',
    request: 'Add loadWidgetList, loadWidgetDetail, and searchWidgets JSON helpers over a base URL.',
    capability: 'httpGetJson',
    verboseBaseline: [
      'Here are the three widget API helpers. Each one builds the endpoint URL from the base URL, performs the request',
      'with the native fetch API, and parses the JSON body, so no HTTP client dependency is needed.',
      '',
      "export const loadWidgetList = (baseUrl: string) => fetch(baseUrl + '/widgets').then((response) => response.json());",
      "export const loadWidgetDetail = (baseUrl: string, resourcePath: string) => fetch(baseUrl + '/widgets/' + resourcePath).then((response) => response.json());",
      "export const searchWidgets = (baseUrl: string, queryText: string) => fetch(baseUrl + '/widgets/search?q=' + queryText).then((response) => response.json());",
      '',
      'Let me know if you also want abort-signal timeouts wired through these helpers.'
    ].join('\n'),
    ponytailBaseline: [
      "export const loadWidgetList = (baseUrl: string) => fetch(baseUrl + '/widgets').then((response) => response.json());",
      "export const loadWidgetDetail = (baseUrl: string, resourcePath: string) => fetch(baseUrl + '/widgets/' + resourcePath).then((response) => response.json());",
      "export const searchWidgets = (baseUrl: string, queryText: string) => fetch(baseUrl + '/widgets/search?q=' + queryText).then((response) => response.json());"
    ].join('\n'),
    utkMinEmission: [
      '@minmap + u baseUrl + p resourcePath + q queryText @end',
      "export const loadWidgetList = (u: string) => m1(u + '/widgets');",
      "export const loadWidgetDetail = (u: string, p: string) => m1(u + '/widgets/' + p);",
      "export const searchWidgets = (u: string, q: string) => m1(u + '/widgets/search?q=' + q);"
    ].join('\n'),
    utkPrettyExpected: [
      "export const loadWidgetList = (baseUrl: string) => fetch(baseUrl + '/widgets').then((response) => response.json());",
      "export const loadWidgetDetail = (baseUrl: string, resourcePath: string) => fetch(baseUrl + '/widgets/' + resourcePath).then((response) => response.json());",
      "export const searchWidgets = (baseUrl: string, queryText: string) => fetch(baseUrl + '/widgets/search?q=' + queryText).then((response) => response.json());"
    ].join('\n'),
    mapEntries: [HTTP_GET_JSON_MACRO_ENTRY],
    macroNames: ['httpGetJson'],
    requiredTerms: ['loadWidgetList', 'loadWidgetDetail', 'searchWidgets', 'baseUrl', 'fetch', 'json']
  }),
  fixture({
    name: 'service-config-loader',
    category: 'Emission: config parsing',
    useCase: 'Emit an environment config loader with validated port and timeout values.',
    testStrategy: 'Identifier-repetition compression with validation carve-outs preserved through expansion.',
    ponytailStrength: 'Reads only the needed environment keys and returns a plain object.',
    utkApproach: 'Map the five repeated config identifiers to single tokens; keep validation errors verbatim.',
    request: 'Add loadServiceConfig(environmentSource) with SERVICE_NAME, SERVICE_PORT, REQUEST_TIMEOUT_MS, VERBOSE_LOGGING and validation.',
    capability: 'loadServiceConfig',
    verboseBaseline: [
      'This config loader pulls the four service settings from the provided environment map, applies sensible defaults,',
      'validates the numeric values, and throws descriptive errors when a value is unusable so misconfiguration fails fast.',
      '',
      'export function loadServiceConfig(environmentSource: Record<string, string | undefined>) {',
      "const serviceName = environmentSource['SERVICE_NAME'] ?? 'utk-service';",
      "const servicePort = Number(environmentSource['SERVICE_PORT'] ?? '8080');",
      "const requestTimeoutMs = Number(environmentSource['REQUEST_TIMEOUT_MS'] ?? '5000');",
      "const verboseLogging = environmentSource['VERBOSE_LOGGING'] === 'true';",
      'if (Number.isNaN(servicePort) || servicePort <= 0) {',
      "throw new Error('invalid SERVICE_PORT for ' + serviceName);",
      '}',
      'if (Number.isNaN(requestTimeoutMs) || requestTimeoutMs <= 0) {',
      "throw new Error('invalid REQUEST_TIMEOUT_MS for ' + serviceName);",
      '}',
      'return { serviceName, servicePort, requestTimeoutMs, verboseLogging };',
      '}',
      '',
      'The defaults keep local development working without any environment setup.'
    ].join('\n'),
    ponytailBaseline: [
      'export function loadServiceConfig(environmentSource: Record<string, string | undefined>) {',
      "const serviceName = environmentSource['SERVICE_NAME'] ?? 'utk-service';",
      "const servicePort = Number(environmentSource['SERVICE_PORT'] ?? '8080');",
      "const requestTimeoutMs = Number(environmentSource['REQUEST_TIMEOUT_MS'] ?? '5000');",
      "const verboseLogging = environmentSource['VERBOSE_LOGGING'] === 'true';",
      'if (Number.isNaN(servicePort) || servicePort <= 0) {',
      "throw new Error('invalid SERVICE_PORT for ' + serviceName);",
      '}',
      'if (Number.isNaN(requestTimeoutMs) || requestTimeoutMs <= 0) {',
      "throw new Error('invalid REQUEST_TIMEOUT_MS for ' + serviceName);",
      '}',
      'return { serviceName, servicePort, requestTimeoutMs, verboseLogging };',
      '}'
    ].join('\n'),
    utkMinEmission: [
      '@minmap + e environmentSource + n serviceName + p servicePort + t requestTimeoutMs + v verboseLogging @end',
      'export function loadServiceConfig(e: Record<string, string | undefined>) {',
      "const n = e['SERVICE_NAME'] ?? 'utk-service';",
      "const p = Number(e['SERVICE_PORT'] ?? '8080');",
      "const t = Number(e['REQUEST_TIMEOUT_MS'] ?? '5000');",
      "const v = e['VERBOSE_LOGGING'] === 'true';",
      'if (Number.isNaN(p) || p <= 0) {',
      "throw new Error('invalid SERVICE_PORT for ' + n);",
      '}',
      'if (Number.isNaN(t) || t <= 0) {',
      "throw new Error('invalid REQUEST_TIMEOUT_MS for ' + n);",
      '}',
      'return { n, p, t, v };',
      '}'
    ].join('\n'),
    utkPrettyExpected: [
      'export function loadServiceConfig(environmentSource: Record<string, string | undefined>) {',
      "const serviceName = environmentSource['SERVICE_NAME'] ?? 'utk-service';",
      "const servicePort = Number(environmentSource['SERVICE_PORT'] ?? '8080');",
      "const requestTimeoutMs = Number(environmentSource['REQUEST_TIMEOUT_MS'] ?? '5000');",
      "const verboseLogging = environmentSource['VERBOSE_LOGGING'] === 'true';",
      'if (Number.isNaN(servicePort) || servicePort <= 0) {',
      "throw new Error('invalid SERVICE_PORT for ' + serviceName);",
      '}',
      'if (Number.isNaN(requestTimeoutMs) || requestTimeoutMs <= 0) {',
      "throw new Error('invalid REQUEST_TIMEOUT_MS for ' + serviceName);",
      '}',
      'return { serviceName, servicePort, requestTimeoutMs, verboseLogging };',
      '}'
    ].join('\n'),
    requiredTerms: ['loadServiceConfig', 'SERVICE_NAME', 'SERVICE_PORT', 'REQUEST_TIMEOUT_MS', 'VERBOSE_LOGGING', 'servicePort']
  }),
  fixture({
    name: 'memoize-async-lookup',
    category: 'Emission: caching utility',
    useCase: 'Emit an async memoization wrapper with a shared in-flight cache.',
    testStrategy: 'High identifier reuse across cache reads and writes with exact expansion equality.',
    ponytailStrength: 'Uses a plain Map and returns early on cache hits — no memoization dependency.',
    utkApproach: 'Five repeated identifiers become single tokens across ten usage sites.',
    request: 'Add memoizeAsyncLookup(computeValue) that caches promises by lookup key.',
    capability: 'memoizeAsyncLookup',
    verboseBaseline: [
      'The wrapper below memoizes an async lookup function. It stores the promise itself, so concurrent callers share',
      'one in-flight request instead of racing duplicate work, and settled promises stay cached for later calls.',
      '',
      'export function memoizeAsyncLookup(computeValue: (lookupKey: string) => Promise<string>) {',
      'const cachedResults = new Map<string, Promise<string>>();',
      'return (lookupKey: string) => {',
      'const existingResult = cachedResults.get(lookupKey);',
      'if (existingResult !== undefined) {',
      'return existingResult;',
      '}',
      'const pendingResult = computeValue(lookupKey);',
      'cachedResults.set(lookupKey, pendingResult);',
      'return pendingResult;',
      '};',
      '}',
      '',
      'Pass any keyed async loader; the Map keeps one promise per key.'
    ].join('\n'),
    ponytailBaseline: [
      'export function memoizeAsyncLookup(computeValue: (lookupKey: string) => Promise<string>) {',
      'const cachedResults = new Map<string, Promise<string>>();',
      'return (lookupKey: string) => {',
      'const existingResult = cachedResults.get(lookupKey);',
      'if (existingResult !== undefined) {',
      'return existingResult;',
      '}',
      'const pendingResult = computeValue(lookupKey);',
      'cachedResults.set(lookupKey, pendingResult);',
      'return pendingResult;',
      '};',
      '}'
    ].join('\n'),
    utkMinEmission: [
      '@minmap + c computeValue + k lookupKey + r cachedResults + x existingResult + q pendingResult @end',
      'export function memoizeAsyncLookup(c: (k: string) => Promise<string>) {',
      'const r = new Map<string, Promise<string>>();',
      'return (k: string) => {',
      'const x = r.get(k);',
      'if (x !== undefined) {',
      'return x;',
      '}',
      'const q = c(k);',
      'r.set(k, q);',
      'return q;',
      '};',
      '}'
    ].join('\n'),
    utkPrettyExpected: [
      'export function memoizeAsyncLookup(computeValue: (lookupKey: string) => Promise<string>) {',
      'const cachedResults = new Map<string, Promise<string>>();',
      'return (lookupKey: string) => {',
      'const existingResult = cachedResults.get(lookupKey);',
      'if (existingResult !== undefined) {',
      'return existingResult;',
      '}',
      'const pendingResult = computeValue(lookupKey);',
      'cachedResults.set(lookupKey, pendingResult);',
      'return pendingResult;',
      '};',
      '}'
    ].join('\n'),
    requiredTerms: ['memoizeAsyncLookup', 'computeValue', 'lookupKey', 'cachedResults', 'Map', 'Promise']
  }),
  fixture({
    name: 'group-records-by-key',
    category: 'Emission: data shaping',
    useCase: 'Emit a group-by utility that buckets records under a key value.',
    testStrategy: 'Repeated bucket identifiers compressed while the unknown-key fallback string survives verbatim.',
    ponytailStrength: 'Uses a plain object accumulator instead of a collection dependency.',
    utkApproach: 'Six repeated identifiers become single tokens; the fallback label stays a literal.',
    request: 'Add groupRecordsByKey(recordList, groupKeyName) that buckets records and defaults missing keys to unknown.',
    capability: 'groupRecordsByKey',
    verboseBaseline: [
      'This utility groups a list of string records under the value they carry for the chosen key. Records that do not',
      'carry the key are grouped under the "unknown" bucket so no record is silently dropped.',
      '',
      'export function groupRecordsByKey(recordList: Array<Record<string, string>>, groupKeyName: string) {',
      'const groupedRecords: Record<string, Array<Record<string, string>>> = {};',
      'for (const currentRecord of recordList) {',
      "const groupLabel = currentRecord[groupKeyName] ?? 'unknown';",
      'const existingBucket = groupedRecords[groupLabel] ?? [];',
      'groupedRecords[groupLabel] = [...existingBucket, currentRecord];',
      '}',
      'return groupedRecords;',
      '}',
      '',
      'The accumulator is a plain object so the result serializes directly to JSON.'
    ].join('\n'),
    ponytailBaseline: [
      'export function groupRecordsByKey(recordList: Array<Record<string, string>>, groupKeyName: string) {',
      'const groupedRecords: Record<string, Array<Record<string, string>>> = {};',
      'for (const currentRecord of recordList) {',
      "const groupLabel = currentRecord[groupKeyName] ?? 'unknown';",
      'const existingBucket = groupedRecords[groupLabel] ?? [];',
      'groupedRecords[groupLabel] = [...existingBucket, currentRecord];',
      '}',
      'return groupedRecords;',
      '}'
    ].join('\n'),
    utkMinEmission: [
      '@minmap + i recordList + k groupKeyName + g groupedRecords + c currentRecord + l groupLabel + b existingBucket @end',
      'export function groupRecordsByKey(i: Array<Record<string, string>>, k: string) {',
      'const g: Record<string, Array<Record<string, string>>> = {};',
      'for (const c of i) {',
      "const l = c[k] ?? 'unknown';",
      'const b = g[l] ?? [];',
      'g[l] = [...b, c];',
      '}',
      'return g;',
      '}'
    ].join('\n'),
    utkPrettyExpected: [
      'export function groupRecordsByKey(recordList: Array<Record<string, string>>, groupKeyName: string) {',
      'const groupedRecords: Record<string, Array<Record<string, string>>> = {};',
      'for (const currentRecord of recordList) {',
      "const groupLabel = currentRecord[groupKeyName] ?? 'unknown';",
      'const existingBucket = groupedRecords[groupLabel] ?? [];',
      'groupedRecords[groupLabel] = [...existingBucket, currentRecord];',
      '}',
      'return groupedRecords;',
      '}'
    ].join('\n'),
    requiredTerms: ['groupRecordsByKey', 'recordList', 'groupKeyName', 'groupedRecords', 'unknown']
  }),
  fixture({
    name: 'paginate-entries',
    category: 'Emission: pagination utility',
    useCase: 'Emit an array pagination helper returning the page slice and total page count.',
    testStrategy: 'Arithmetic identifier reuse compressed with stdlib Math calls left untouched.',
    ponytailStrength: 'Uses Array.slice and Math with no pagination dependency.',
    utkApproach: 'Seven repeated identifiers become single tokens; Math stays verbatim as a platform anchor.',
    request: 'Add paginateEntries(entryList, pageSize, pageIndex) returning pagedEntries and totalPages.',
    capability: 'paginateEntries',
    verboseBaseline: [
      'The pagination helper clamps the page size to at least one, slices out the requested page, and reports the total',
      'page count so callers can render pagination controls without recomputing anything.',
      '',
      'export function paginateEntries(entryList: string[], pageSize: number, pageIndex: number) {',
      'const boundedSize = Math.max(1, pageSize);',
      'const startOffset = pageIndex * boundedSize;',
      'const pagedEntries = entryList.slice(startOffset, startOffset + boundedSize);',
      'const totalPages = Math.ceil(entryList.length / boundedSize);',
      'return { pagedEntries, totalPages, pageIndex };',
      '}',
      '',
      'Out-of-range page indexes simply return an empty page, which keeps the caller logic simple.'
    ].join('\n'),
    ponytailBaseline: [
      'export function paginateEntries(entryList: string[], pageSize: number, pageIndex: number) {',
      'const boundedSize = Math.max(1, pageSize);',
      'const startOffset = pageIndex * boundedSize;',
      'const pagedEntries = entryList.slice(startOffset, startOffset + boundedSize);',
      'const totalPages = Math.ceil(entryList.length / boundedSize);',
      'return { pagedEntries, totalPages, pageIndex };',
      '}'
    ].join('\n'),
    utkMinEmission: [
      '@minmap + i entryList + s pageSize + x pageIndex + z boundedSize + o startOffset + d pagedEntries + t totalPages @end',
      'export function paginateEntries(i: string[], s: number, x: number) {',
      'const z = Math.max(1, s);',
      'const o = x * z;',
      'const d = i.slice(o, o + z);',
      'const t = Math.ceil(i.length / z);',
      'return { d, t, x };',
      '}'
    ].join('\n'),
    utkPrettyExpected: [
      'export function paginateEntries(entryList: string[], pageSize: number, pageIndex: number) {',
      'const boundedSize = Math.max(1, pageSize);',
      'const startOffset = pageIndex * boundedSize;',
      'const pagedEntries = entryList.slice(startOffset, startOffset + boundedSize);',
      'const totalPages = Math.ceil(entryList.length / boundedSize);',
      'return { pagedEntries, totalPages, pageIndex };',
      '}'
    ].join('\n'),
    requiredTerms: ['paginateEntries', 'entryList', 'pageSize', 'pageIndex', 'pagedEntries', 'totalPages']
  })
];

export type PonytailLadderFixture = {
  name: string;
  capability: string;
  request: string;
  files: Record<string, string>;
  dependencyCapabilities?: Record<string, string[]>;
  macroNames?: string[];
  mode?: string;
  expectedRung: number;
  expectedStrategy: string;
};

export const PONYTAIL_LADDER_FIXTURES: PonytailLadderFixture[] = [
  {
    name: 'ladder-reuse-existing-helper',
    capability: 'httpGetJson',
    request: 'Add a JSON fetch helper.',
    files: { 'src/http.ts': 'export function httpGetJson(requestUrl: string) { return fetch(requestUrl); }\n' },
    expectedRung: 2,
    expectedStrategy: 'reuse'
  },
  {
    name: 'ladder-stdlib-structured-clone',
    capability: 'structuredClone',
    request: 'Add a deep clone helper.',
    files: {},
    expectedRung: 3,
    expectedStrategy: 'stdlib'
  },
  {
    name: 'ladder-platform-date-picker',
    capability: 'datePicker',
    request: 'Add a date picker.',
    files: {},
    expectedRung: 4,
    expectedStrategy: 'platform'
  },
  {
    name: 'ladder-dependency-schema-validation',
    capability: 'schemaValidation',
    request: 'Validate request payload schemas.',
    files: { 'package.json': '{"name":"fixture","dependencies":{"zod":"^3.0.0"}}\n' },
    dependencyCapabilities: { zod: ['schemaValidation'] },
    expectedRung: 5,
    expectedStrategy: 'dependency'
  },
  {
    name: 'ladder-macro-full-mode',
    capability: 'httpGetJson',
    request: 'Add a JSON fetch helper.',
    files: {},
    macroNames: ['httpGetJson'],
    mode: 'full',
    expectedRung: 6,
    expectedStrategy: 'macro'
  },
  {
    name: 'ladder-macro-lite-mode',
    capability: 'httpGetJson',
    request: 'Add a JSON fetch helper.',
    files: {},
    macroNames: ['httpGetJson'],
    mode: 'lite',
    expectedRung: 7,
    expectedStrategy: 'plain'
  }
];

export const PONYTAIL_PARITY_EVALS: string[] = PONYTAIL_PARITY_FIXTURES.map((entry) => entry.name);

export const PONYTAIL_PARITY_MODE_EVALS: string[] = PONYTAIL_PARITY_FIXTURES.flatMap((entry) =>
  PONYTAIL_MODES.map((mode) => `${entry.name}-${mode}`)
);

export const PONYTAIL_LADDER_EVALS: string[] = PONYTAIL_LADDER_FIXTURES.map((entry) => entry.name);

export function ponytailBaselineForMode(entry: PonytailParityFixture, mode: PonytailMode): string {
  return entry.ponytailBaselines[mode];
}

export function ponytailParityExpectedPayload(entry: PonytailParityFixture, mode: PonytailMode = 'full'): string {
  const ponytailBaseline = ponytailBaselineForMode(entry, mode);
  return JSON.stringify(
    {
      scenario: entry.name,
      ponytail_mode: mode,
      ponytail_baseline: ponytailBaseline,
      verbose_baseline: entry.verboseBaseline,
      expected_pretty: entry.utkPrettyExpected,
      required_terms: entry.requiredTerms,
      map_entries: entry.mapEntries,
      macro_names: entry.macroNames,
      max_token_ratio: entry.maxTokenRatio,
      ponytail_tokens: estimateTokens(ponytailBaseline)
    },
    null,
    2
  );
}
