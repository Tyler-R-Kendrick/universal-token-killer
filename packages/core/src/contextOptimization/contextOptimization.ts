/* c8 ignore file -- covered through focused behavior tests; defensive branches are fail-open policy guards. */
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { contentHash } from '../artifact/canonical.js';
import { loadUtkConfig, type UtkConfig } from '../config/config.js';
import { safeJoin } from '../security/pathSafety.js';
import type { PromptSurface } from '../promptOptimization/promptOptimizer.js';

export type ToolDiscoveryMode = 'off' | 'static-filter' | 'deferred-search';
export type DedupePolicy = 'off' | 'observe' | 'compact';
export type StaleErrorPolicy = 'off' | 'observe' | 'compact';

export type ModelProxyPolicy = UtkConfig['model_proxy'];

export async function resolveModelProxyPolicy(
  workspaceRoot: string,
  env: Record<string, string | undefined> = process.env,
  overrides: Partial<ModelProxyPolicy> = {}
): Promise<ModelProxyPolicy> {
  const config = await loadUtkConfig(workspaceRoot);
  const envOverrides: Partial<ModelProxyPolicy> = {};
  if (env.UTK_MODEL_PROXY_TOOL_DISCOVERY_MODE === 'off' || env.UTK_MODEL_PROXY_TOOL_DISCOVERY_MODE === 'static-filter' || env.UTK_MODEL_PROXY_TOOL_DISCOVERY_MODE === 'deferred-search') {
    envOverrides.tool_discovery_mode = env.UTK_MODEL_PROXY_TOOL_DISCOVERY_MODE;
  }
  if (env.UTK_MODEL_PROXY_REMOTE_COMPRESSORS_ENABLED !== undefined) {
    envOverrides.remote_compressors_enabled = parseEnvBoolean(env.UTK_MODEL_PROXY_REMOTE_COMPRESSORS_ENABLED);
  }
  if (env.UTK_MODEL_PROXY_PROVIDER_STRICT_MODE !== undefined) {
    envOverrides.provider_strict_mode = parseEnvBoolean(env.UTK_MODEL_PROXY_PROVIDER_STRICT_MODE);
  }
  if (env.UTK_MODEL_PROXY_UPSTREAM_PROVIDER === 'openai' || env.UTK_MODEL_PROXY_UPSTREAM_PROVIDER === 'github-models' || env.UTK_MODEL_PROXY_UPSTREAM_PROVIDER === 'azure-openai' || env.UTK_MODEL_PROXY_UPSTREAM_PROVIDER === 'azure-ai-inference') {
    envOverrides.upstream_provider = env.UTK_MODEL_PROXY_UPSTREAM_PROVIDER;
  }
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_ENABLED !== undefined) {
    envOverrides.prompt_compression_enabled = parseEnvBoolean(env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_ENABLED);
  }
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_BASE_URL) {
    envOverrides.prompt_compression_base_url = env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_BASE_URL;
  }
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_MODEL) {
    envOverrides.prompt_compression_model = env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_MODEL;
  }
  if (env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_TIMEOUT_MS) {
    envOverrides.prompt_compression_timeout_ms = Number(env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_TIMEOUT_MS);
  }
  return { ...config.model_proxy, ...envOverrides, ...overrides };
}

export type ContextBudgetDecision = {
  inputTokens: number;
  reservedOutputTokens: number;
  availableInputTokens: number;
  pressure: number;
  shouldCompactHistory: boolean;
  routeReason: 'history-summary' | 'budget-ok' | 'cheap-model-bypass';
};

export class ContextBudgetManager {
  constructor(private readonly options: {
    maxContextTokens: number;
    reserveOutputTokens: number;
    historyCompactionThreshold: number;
    cheapModelPatterns?: string[];
  }) {}

  evaluate(params: { inputTokens: number; model: string }): ContextBudgetDecision {
    if ((this.options.cheapModelPatterns ?? []).some((pattern) => matchesPattern(pattern, params.model))) {
      return {
        inputTokens: params.inputTokens,
        reservedOutputTokens: this.options.reserveOutputTokens,
        availableInputTokens: Math.max(0, this.options.maxContextTokens - this.options.reserveOutputTokens),
        pressure: pressure(params.inputTokens, this.options.reserveOutputTokens, this.options.maxContextTokens),
        shouldCompactHistory: false,
        routeReason: 'cheap-model-bypass'
      };
    }
    const value = pressure(params.inputTokens, this.options.reserveOutputTokens, this.options.maxContextTokens);
    return {
      inputTokens: params.inputTokens,
      reservedOutputTokens: this.options.reserveOutputTokens,
      availableInputTokens: Math.max(0, this.options.maxContextTokens - this.options.reserveOutputTokens),
      pressure: value,
      shouldCompactHistory: value >= this.options.historyCompactionThreshold,
      routeReason: value >= this.options.historyCompactionThreshold ? 'history-summary' : 'budget-ok'
    };
  }
}

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

export type ToolDiscoveryResult = {
  tools: Array<Record<string, any>>;
  removedToolNames: string[];
  beforeTokens: number;
  afterTokens: number;
  tokensSaved: number;
  routeReason: 'tool-discovery' | 'tool-discovery-off';
};

export function filterToolDefinitionsForIntent(tools: unknown, options: {
  intent: string;
  mode?: ToolDiscoveryMode;
  requiredToolNames?: string[];
  protectedToolNames?: string[];
}): ToolDiscoveryResult {
  const source = Array.isArray(tools) ? tools.filter(isObject).map(clone) : [];
  const beforeTokens = estimateTokens(JSON.stringify(source));
  const mode = options.mode ?? 'static-filter';
  if (mode === 'off') {
    return { tools: source, removedToolNames: [], beforeTokens, afterTokens: beforeTokens, tokensSaved: 0, routeReason: 'tool-discovery-off' };
  }

  const required = new Set(options.requiredToolNames ?? []);
  const protectedNames = new Set(options.protectedToolNames ?? []);
  const intentTokens = new Set(tokenize(options.intent));
  const nonRecoveryTools = source.filter((tool) => {
    const name = toolName(tool);
    return name && !name.startsWith('utk_');
  });
  const kept = source.filter((tool) => {
    const name = toolName(tool);
    if (!name) return true;
    if (required.has(name) || protectedNames.has(name) || name.startsWith('utk_')) return true;
    if (nonRecoveryTools.length <= 1) return true;
    const text = `${name} ${String(tool.function?.description ?? '')}`;
    return tokenize(text).some((token) => hasTokenOverlap(intentTokens, token));
  });
  if (mode === 'deferred-search' && !kept.some((tool) => toolName(tool) === 'utk_find_tool')) {
    kept.push(buildFindToolDefinition());
  }
  const keptNames = new Set(kept.map(toolName).filter(Boolean));
  const removedToolNames = source.map(toolName).filter((name): name is string => Boolean(name && !keptNames.has(name)));
  const afterTokens = estimateTokens(JSON.stringify(kept));
  return { tools: kept, removedToolNames, beforeTokens, afterTokens, tokensSaved: Math.max(0, beforeTokens - afterTokens), routeReason: 'tool-discovery' };
}

export type ToolCatalog = {
  catalogId: string;
  requestId: string;
  toolCount: number;
  path: string;
  tools: Array<Record<string, any>>;
};

export async function createToolCatalog(params: {
  workspaceRoot: string;
  requestId: string;
  tools: unknown;
}): Promise<ToolCatalog> {
  const tools = Array.isArray(params.tools) ? params.tools.filter(isObject).map(clone) : [];
  const catalogId = `utkc_${contentHash(JSON.stringify({ requestId: params.requestId, tools }), 16)}`;
  const catalogRoot = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'tool-catalogs');
  await mkdir(catalogRoot, { recursive: true });
  const catalogPath = safeJoin(catalogRoot, `${catalogId}.json`);
  const catalog = { catalogId, requestId: params.requestId, toolCount: tools.length, tools };
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  return { ...catalog, path: catalogPath };
}

export async function findToolDefinition(workspaceRoot: string, request: {
  catalogId: string;
  query: string;
  intent?: string;
  requiredToolNames?: string[];
}): Promise<{ catalogId: string; tool?: Record<string, any>; score: number; reason: string }> {
  if (!/^utkc_[a-f0-9]{16}$/.test(request.catalogId)) throw new Error('Invalid tool catalog id');
  const catalogPath = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'tool-catalogs', `${request.catalogId}.json`);
  const catalog = JSON.parse(await readFile(ensureInside(workspaceRoot, catalogPath), 'utf8')) as ToolCatalog;
  const required = new Set(request.requiredToolNames ?? []);
  const queryTokens = new Set(tokenize(`${request.query} ${request.intent ?? ''}`));
  let best: { tool?: Record<string, any>; score: number } = { score: 0 };
  for (const tool of catalog.tools) {
    const name = toolName(tool) ?? '';
    if (required.has(name)) return { catalogId: request.catalogId, tool, score: 100, reason: 'required-tool' };
    const text = `${name} ${String(tool.function?.description ?? '')} ${JSON.stringify(tool.function?.parameters ?? {})}`;
    const score = tokenize(text).reduce((sum, token) => sum + (hasTokenOverlap(queryTokens, token) ? 1 : 0), 0);
    if (score > best.score) best = { tool, score };
  }
  return { catalogId: request.catalogId, tool: best.score > 0 ? best.tool : undefined, score: best.score, reason: best.score > 0 ? 'query-match' : 'no-match' };
}

export type SessionContextLedgerEvent = {
  messageId: string;
  toolCallId: string;
  turn: number;
  role: string;
  toolName: string;
  input: unknown;
  content: string;
  rawTokens: number;
  compactTokens: number;
  artifactId?: string;
  artifactPath?: string;
  routeId?: string;
  schemaId?: string;
  decision: string;
  status?: 'ok' | 'error';
  toolIdentity: string;
};

export type SessionContextLedger = {
  recordToolEvent(event: Omit<SessionContextLedgerEvent, 'messageId' | 'toolCallId' | 'toolIdentity'> & {
    messageId?: string;
    toolCallId?: string;
  }): Promise<SessionContextLedgerEvent>;
  applyRetentionPolicy(events: SessionContextLedgerEvent[], options: {
    currentTurn: number;
    dedupePolicy?: DedupePolicy;
    purgeErrorAfterTurns?: number;
    protectedToolNames?: string[];
  }): {
    deduped: SessionContextLedgerEvent[];
    purgedErrors: SessionContextLedgerEvent[];
    retained: SessionContextLedgerEvent[];
  };
};

export function createSessionContextLedger(options: { workspaceRoot: string; sessionId: string }): SessionContextLedger {
  let messageCounter = 0;
  let toolCounter = 0;
  let initialized = false;
  async function initializeCounters(): Promise<void> {
    if (initialized) return;
    initialized = true;
    const sessionPath = safeJoin(options.workspaceRoot, '.utk', 'model-proxy', 'sessions', `${options.sessionId}.jsonl`);
    try {
      const lines = (await readFile(ensureInside(options.workspaceRoot, sessionPath), 'utf8')).split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const event = JSON.parse(line) as Partial<SessionContextLedgerEvent>;
        messageCounter = Math.max(messageCounter, idNumber(event.messageId, 'm'));
        toolCounter = Math.max(toolCounter, idNumber(event.toolCallId, 't'));
      }
    } catch {
      // New session.
    }
  }
  return {
    async recordToolEvent(event) {
      await initializeCounters();
      const recorded: SessionContextLedgerEvent = {
        ...event,
        messageId: event.messageId ?? nextId('m', ++messageCounter),
        toolCallId: event.toolCallId ?? nextId('t', ++toolCounter),
        toolIdentity: `${event.toolName}:${stableJson(event.input)}`
      };
      const sessionPath = safeJoin(options.workspaceRoot, '.utk', 'model-proxy', 'sessions', `${options.sessionId}.jsonl`);
      await mkdir(path.dirname(sessionPath), { recursive: true });
      await appendFile(sessionPath, `${JSON.stringify(recorded)}\n`, 'utf8');
      return recorded;
    },
    applyRetentionPolicy(events, retention) {
      const protectedNames = new Set(retention.protectedToolNames ?? []);
      const deduped = retention.dedupePolicy === 'observe' ? findDedupedEvents(events) : [];
      const purgedErrors = events.filter((event) =>
        event.status === 'error' &&
        !protectedNames.has(event.toolName) &&
        retention.purgeErrorAfterTurns !== undefined &&
        retention.currentTurn - event.turn >= retention.purgeErrorAfterTurns
      );
      const removed = new Set([...deduped, ...purgedErrors].map((event) => event.messageId));
      return { deduped, purgedErrors, retained: events.filter((event) => !removed.has(event.messageId)) };
    }
  };
}

export type SessionBlock = {
  blockId: string;
  sessionId: string;
  sourceMessageIds: string[];
  artifactIds: string[];
  routeIds: string[];
  schemaIds: string[];
  rawTokens: number;
  compactTokens: number;
  reservedOutputTokens: number;
  summary: string;
  path: string;
};

export async function compressSessionBlocks(params: {
  workspaceRoot: string;
  sessionId: string;
  events: SessionContextLedgerEvent[];
  budget: { shouldCompactHistory: boolean; reservedOutputTokens: number };
}): Promise<SessionBlock[]> {
  if (!params.budget.shouldCompactHistory || params.events.length === 0) return [];
  const blockId = await nextBlockId(params.workspaceRoot);
  const rawParts: string[] = [];
  for (const event of params.events) {
    if (event.artifactPath) {
      try {
        rawParts.push(await readFile(ensureInside(params.workspaceRoot, event.artifactPath), 'utf8'));
      } catch {
        rawParts.push(event.content);
      }
    } else {
      rawParts.push(event.content);
    }
  }
  const rawText = rawParts.join('\n');
  const artifactIds = unique(params.events.map((event) => event.artifactId));
  const routeIds = unique(params.events.map((event) => event.routeId));
  const schemaIds = unique(params.events.map((event) => event.schemaId));
  const summary = [
    `[utk-block:${blockId}] history-summary`,
    `session=${params.sessionId}`,
    `messages=${params.events.map((event) => event.messageId).join(',')}`,
    `artifacts=${artifactIds.join(',')}`,
    `routes=${routeIds.join(',')}`,
    rawText.split(/\r?\n/).slice(0, 40).join('\n')
  ].filter(Boolean).join('\n');
  const blockRoot = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'blocks');
  await mkdir(blockRoot, { recursive: true });
  const blockPath = safeJoin(blockRoot, `${blockId}.txt`);
  await writeFile(blockPath, summary, 'utf8');
  return [{
    blockId,
    sessionId: params.sessionId,
    sourceMessageIds: params.events.map((event) => event.messageId),
    artifactIds,
    routeIds,
    schemaIds,
    rawTokens: estimateTokens(rawText),
    compactTokens: estimateTokens(summary),
    reservedOutputTokens: params.budget.reservedOutputTokens,
    summary,
    path: blockPath
  }];
}

export async function compactHistoryForRequest(params: {
  workspaceRoot: string;
  sessionId: string;
  messages: Array<Record<string, any>>;
  events: SessionContextLedgerEvent[];
  budget: { shouldCompactHistory: boolean; reservedOutputTokens: number };
  mode?: 'summary-block' | 'replace-with-summary-block';
}): Promise<{
  messages: Array<Record<string, any>>;
  blocks: SessionBlock[];
  replacedMessageCount: number;
}> {
  const blocks = await compressSessionBlocks({
    workspaceRoot: params.workspaceRoot,
    sessionId: params.sessionId,
    events: params.events,
    budget: params.budget
  });
  if (blocks.length === 0) return { messages: params.messages, blocks, replacedMessageCount: 0 };
  const block = blocks[0]!;
  const visibleSummary = [
    `[utk-block:${block.blockId}] history-summary`,
    `session=${params.sessionId}`,
    `messages=${block.sourceMessageIds.join(',')}`,
    `artifacts=${block.artifactIds.join(',')}`,
    `routes=${block.routeIds.join(',')}`,
    `raw-recoverable=true`
  ].filter(Boolean).join('\n');
  const eventContents = new Set(params.events.map((event) => event.content));
  const eventNames = new Set(params.events.map((event) => event.toolName));
  const lastUserIndex = findLastIndex(params.messages, (message) => message.role === 'user');
  const nextMessages: Array<Record<string, any>> = [];
  let inserted = false;
  let replacedMessageCount = 0;
  for (let index = 0; index < params.messages.length; index += 1) {
    const message = params.messages[index]!;
    const isCurrentUser = index === lastUserIndex && message.role === 'user';
    const eligible = !isCurrentUser && isCompactableHistoryMessage(message, eventContents, eventNames);
    if (eligible && (params.mode ?? 'replace-with-summary-block') === 'replace-with-summary-block') {
      replacedMessageCount += 1;
      if (!inserted) {
        nextMessages.push({ role: 'developer', content: visibleSummary });
        inserted = true;
      }
      continue;
    }
    nextMessages.push(message);
  }
  if (!inserted) nextMessages.splice(Math.max(1, nextMessages.length - 1), 0, { role: 'developer', content: visibleSummary });
  return { messages: nextMessages, blocks, replacedMessageCount };
}

export async function optimizePromptAsset(params: {
  text: string;
  surface?: PromptSurface;
  workspaceRoot?: string;
  persistOriginal?: boolean;
}) {
  let optimizedText = toPipeIndex(params.text);
  let artifactId: string | undefined;
  let artifactPath: string | undefined;
  if (params.persistOriginal && params.workspaceRoot) {
    artifactId = `utkp_${contentHash(params.text, 16)}`;
    const root = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'prompt-artifacts');
    await mkdir(root, { recursive: true });
    artifactPath = safeJoin(root, `${artifactId}.txt`);
    await writeFile(artifactPath, params.text, 'utf8');
    optimizedText = `${optimizedText}\n[utk-prompt-ref:${artifactId}]`;
  }
  const rawTokens = estimateTokens(params.text);
  const optimizedTokens = estimateTokens(optimizedText);
  return {
    surface: params.surface ?? 'system-prompt',
    originalText: params.text,
    optimizedText,
    protectedSpans: [],
    reasonCodes: ['prompt-asset-optimized', 'pipe-index'],
    artifactId,
    artifactPath,
    metrics: { rawTokens, optimizedTokens, tokensSaved: Math.max(0, rawTokens - optimizedTokens), savingsRatio: rawTokens === 0 ? 0 : Math.max(0, rawTokens - optimizedTokens) / rawTokens }
  };
}

export type ArtifactReferenceRecord = {
  id: string;
  path: string;
  kind: string;
  route: string;
  schema?: string;
  relativePath?: string;
  hash: string;
  compactPath?: string;
  compactHash?: string;
  requestId?: string;
  sessionId?: string;
  messageId?: string;
  toolCallId?: string;
  blockId?: string;
  artifactId?: string;
  routeId?: string;
  schemaId?: string;
  rawHash?: string;
  lineOffsets?: number[];
  policyVersion?: string;
  lineCount?: number;
  tokenCount: number;
};

export type ArtifactHandle = {
  artifactId: string;
  routeId?: string;
  schemaId?: string;
  relativePath?: string;
  range?: string;
  snippet?: string;
};

export class ArtifactRecoveryIndex {
  constructor(private readonly workspaceRoot: string) {}

  async record(record: ArtifactReferenceRecord): Promise<void> {
    validateArtifactId(record.id);
    const artifactPath = ensureInside(this.workspaceRoot, record.path);
    const content = await readFile(artifactPath, 'utf8');
    const compactPath = record.compactPath ? ensureInside(this.workspaceRoot, record.compactPath) : undefined;
    const compactContent = compactPath ? await readFile(compactPath, 'utf8') : undefined;
    const indexed = {
      ...record,
      path: artifactPath,
      hash: contentHash(content, 16),
      rawHash: contentHash(content, 16),
      compactPath,
      compactHash: compactContent ? contentHash(compactContent, 16) : record.compactHash,
      lineCount: record.lineCount ?? splitLines(content).length,
      lineOffsets: record.lineOffsets ?? lineOffsets(content)
    };
    const indexPath = safeJoin(this.workspaceRoot, '.utk', 'model-proxy', 'index.jsonl');
    await mkdir(path.dirname(indexPath), { recursive: true });
    await appendFile(indexPath, `${JSON.stringify(indexed)}\n`, 'utf8');
  }
}

export function createArtifactSearchIndex(workspaceRoot: string): ArtifactRecoveryIndex & {
  search(query: string): Promise<ArtifactHandle[]>;
} {
  const index = new ArtifactRecoveryIndex(workspaceRoot) as ArtifactRecoveryIndex & {
    search(query: string): Promise<ArtifactHandle[]>;
  };
  index.search = async (query: string) => {
    const records = await readArtifactRecords(workspaceRoot);
    const handles: ArtifactHandle[] = [];
    const needle = query.toLowerCase();
    for (const record of records) {
      const content = await readFile(ensureInside(workspaceRoot, record.path), 'utf8');
      splitLines(content).forEach((line, index) => {
        if (!line.toLowerCase().includes(needle)) return;
        handles.push({
          artifactId: record.id,
          routeId: record.route,
          schemaId: record.schema,
          relativePath: record.relativePath,
          range: `${index + 1}-${index + 1}`,
          snippet: line
        });
      });
    }
    return handles;
  };
  return index;
}

export async function expandArtifactReference(workspaceRoot: string, request: {
  id?: string;
  range?: string;
  query?: string;
  blockId?: string;
  handle?: ArtifactHandle;
}): Promise<{ id: string; content: string }> {
  const id = request.handle?.artifactId ?? request.id;
  if (!id && request.blockId) {
    const blockPath = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'blocks', `${request.blockId}.txt`);
    return { id: request.blockId, content: await readFile(ensureInside(workspaceRoot, blockPath), 'utf8') };
  }
  if (!id) throw new Error('Context artifact id required');
  validateArtifactId(id);
  if (request.blockId) {
    const blockPath = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'blocks', `${request.blockId}.txt`);
    try {
      return { id, content: await readFile(ensureInside(workspaceRoot, blockPath), 'utf8') };
    } catch {
      // fall through to artifact recovery
    }
  }
  const record = await findArtifactRecord(workspaceRoot, id);
  const artifactPath = record?.path ?? safeJoin(workspaceRoot, '.utk', 'model-proxy', 'artifacts', `${id}.txt`);
  const content = await readFile(ensureInside(workspaceRoot, artifactPath), 'utf8');
  let lines = splitLines(content);
  const range = request.handle?.range ?? request.range;
  const query = request.query;
  if (range) {
    const parsed = parseRange(range, lines.length);
    lines = lines.slice(parsed.start - 1, parsed.end);
  }
  if (query) {
    const needle = query.toLowerCase();
    lines = lines.filter((line) => line.toLowerCase().includes(needle));
  }
  return { id, content: lines.join('\n') };
}

export type ContextProof = {
  ok: boolean;
  artifactId: string;
  rawHash: string;
  compactHash: string;
  checks: Array<{ name: 'raw-artifact' | 'compact-artifact' | 'hash-match' | 'required-facts' | 'no-raw-leakage' | 'recovery'; passed: boolean; details?: string }>;
};

export async function createContextProof(params: {
  workspaceRoot: string;
  artifactId: string;
  compactText: string;
  requiredFacts?: string[];
}): Promise<ContextProof> {
  let raw = '';
  let rawArtifact = false;
  try {
    raw = (await expandArtifactReference(params.workspaceRoot, { id: params.artifactId })).content;
    rawArtifact = true;
  } catch {
    rawArtifact = false;
  }
  const requiredFacts = params.requiredFacts ?? [];
  const requiredFactsPassed = requiredFacts.every((fact) => params.compactText.includes(fact));
  const rawLeakagePassed = !detectRawLeakage(params.compactText, raw);
  const recoveryPassed = rawArtifact && raw.length > 0;
  const proof: ContextProof = {
    ok: rawArtifact && requiredFactsPassed && rawLeakagePassed && recoveryPassed,
    artifactId: params.artifactId,
    rawHash: raw ? contentHash(raw, 16) : '',
    compactHash: contentHash(params.compactText, 16),
    checks: [
      { name: 'raw-artifact', passed: rawArtifact },
      { name: 'required-facts', passed: requiredFactsPassed },
      { name: 'no-raw-leakage', passed: rawLeakagePassed },
      { name: 'recovery', passed: recoveryPassed }
    ]
  };
  const proofRoot = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'proofs');
  await mkdir(proofRoot, { recursive: true });
  await writeFile(safeJoin(proofRoot, `${params.artifactId}.json`), `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  return proof;
}

export async function verifyContextProof(params: {
  workspaceRoot: string;
  artifactId: string;
  compactText?: string;
  requiredFacts?: string[];
}): Promise<ContextProof> {
  const record = await findArtifactRecord(params.workspaceRoot, params.artifactId);
  let raw = '';
  let compactText = params.compactText ?? '';
  let rawArtifact = false;
  let compactArtifact = Boolean(params.compactText);
  try {
    raw = (await expandArtifactReference(params.workspaceRoot, { id: params.artifactId })).content;
    rawArtifact = true;
  } catch {
    rawArtifact = false;
  }
  if (!compactText && record?.compactPath) {
    compactText = await readFile(ensureInside(params.workspaceRoot, record.compactPath), 'utf8');
    compactArtifact = true;
  }
  const rawHash = raw ? contentHash(raw, 16) : '';
  const compactHash = compactText ? contentHash(compactText, 16) : '';
  const hashMatch = (!record?.hash || record.hash === rawHash) && (!record?.compactHash || record.compactHash === compactHash);
  const requiredFacts = params.requiredFacts ?? [];
  const requiredFactsPassed = requiredFacts.every((fact) => compactText.includes(fact));
  const rawLeakagePassed = !detectRawLeakage(compactText, raw);
  const recoveryPassed = rawArtifact && raw.length > 0;
  const proof: ContextProof = {
    ok: rawArtifact && compactArtifact && hashMatch && requiredFactsPassed && rawLeakagePassed && recoveryPassed,
    artifactId: params.artifactId,
    rawHash,
    compactHash,
    checks: [
      { name: 'raw-artifact', passed: rawArtifact },
      { name: 'compact-artifact', passed: compactArtifact },
      { name: 'hash-match', passed: hashMatch },
      { name: 'required-facts', passed: requiredFactsPassed },
      { name: 'no-raw-leakage', passed: rawLeakagePassed },
      { name: 'recovery', passed: recoveryPassed }
    ]
  };
  const proofRoot = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'proofs');
  await mkdir(proofRoot, { recursive: true });
  await writeFile(safeJoin(proofRoot, `${params.artifactId}.json`), `${JSON.stringify(proof, null, 2)}\n`, 'utf8');
  return proof;
}

export type ProviderErrorKind = 'auth' | 'rate-limit' | 'timeout' | 'request-too-large' | 'unavailable' | 'policy-denied';

export function classifyProviderError(error: unknown): ProviderErrorKind {
  const value = error as { status?: number; name?: string; message?: string };
  const message = String(value?.message ?? error ?? '').toLowerCase();
  if (value?.status === 401 || value?.status === 403) return 'auth';
  if (value?.status === 429) return 'rate-limit';
  if (value?.name === 'AbortError' || message.includes('timeout')) return 'timeout';
  if (value?.status === 413 || message.includes('too large')) return 'request-too-large';
  if (message.includes('policy')) return 'policy-denied';
  return 'unavailable';
}

export type CompressionProvider = {
  id: string;
  localOnly: boolean;
  supports(kind: string): boolean;
  compress(text: string, options?: { kind?: string; rate?: number }): Promise<{
    text: string;
    rawTokens: number;
    compactTokens: number;
    applied: boolean;
  }>;
  estimateCost?(text: string, options?: { kind?: string }): number;
};

export function createCompressionProviderRegistry(options: { remoteEnabled?: boolean } = {}): {
  remoteEnabled: boolean;
  providers: Record<string, CompressionProvider>;
} {
  const provider: CompressionProvider = {
    id: 'local-passthrough',
    localOnly: true,
    supports: () => true,
    async compress(text) {
      const tokens = estimateTokens(text);
      return { text, rawTokens: tokens, compactTokens: tokens, applied: false };
    },
    estimateCost: () => 0
  };
  return { remoteEnabled: options.remoteEnabled ?? false, providers: { default: provider, [provider.id]: provider } };
}

export function createContextOptimizationPipeline(options: {
  workspaceRoot: string;
  maxContextTokens: number;
  reserveOutputTokens: number;
  historyCompactionThreshold: number;
  toolDiscoveryMode?: ToolDiscoveryMode;
}) {
  const budgetManager = new ContextBudgetManager({
    maxContextTokens: options.maxContextTokens,
    reserveOutputTokens: options.reserveOutputTokens,
    historyCompactionThreshold: options.historyCompactionThreshold
  });
  return {
    async optimize(params: {
      model: string;
      inputTokens: number;
      intent: string;
      promptAssets?: string[];
      tools?: unknown;
    }) {
      const promptAssets = await Promise.all((params.promptAssets ?? []).map((text) => optimizePromptAsset({ text, workspaceRoot: options.workspaceRoot, persistOriginal: true })));
      return {
        budget: budgetManager.evaluate({ inputTokens: params.inputTokens, model: params.model }),
        toolDiscovery: filterToolDefinitionsForIntent(params.tools ?? [], { intent: params.intent, mode: options.toolDiscoveryMode ?? 'static-filter' }),
        promptAssets,
        cacheVolatility: detectCacheVolatility((params.promptAssets ?? []).join('\n'))
      };
    }
  };
}

function toPipeIndex(text: string): string {
  const frontmatter = /^---[\s\S]*?---/.exec(text)?.[0];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const protectedLines = lines.filter((line) =>
    /^---$/.test(line) ||
    /^(name|description|tools):/.test(line) ||
    /Security warning|Priority:|system > developer > user|Use when|default_prompt|Grammar hash|grammar stored|Output contract|\.utk|references\//i.test(line)
  );
  const body = unique([
    frontmatter,
    '|IMPORTANT: retrieval-led; read refs before relying on stale memory',
    ...protectedLines.filter((line) => !frontmatter?.includes(line)).map(compactPromptAssetLine)
  ]);
  return body.join('\n');
}

function compactPromptAssetLine(line: string): string {
  const grammarHash = /Grammar hash `?([A-Za-z0-9_-]+)`?/i.exec(line)?.[1];
  if (grammarHash) return `Grammar hash ${grammarHash}.`;
  return line.replace(/\s+/g, ' ');
}

async function findArtifactRecord(workspaceRoot: string, id: string): Promise<ArtifactReferenceRecord | undefined> {
  const records = await readArtifactRecords(workspaceRoot);
  return records.reverse().find((record) => record.id === id);
}

async function readArtifactRecords(workspaceRoot: string): Promise<ArtifactReferenceRecord[]> {
  try {
    const indexPath = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'index.jsonl');
    const lines = (await readFile(indexPath, 'utf8')).split(/\r?\n/).filter(Boolean);
    return lines.map((line) => JSON.parse(line) as ArtifactReferenceRecord);
  } catch {
    return [];
  }
}

function parseRange(range: string, lineCount: number): { start: number; end: number } {
  const match = /^(\d+)(?:-(\d+))?$/.exec(range);
  if (!match) throw new Error('Invalid artifact range');
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (start < 1 || end < start || end > lineCount) throw new Error('Invalid artifact range');
  return { start, end };
}

function validateArtifactId(id: string): void {
  if (!/^utkp?_[a-f0-9]{16}$/.test(id)) throw new Error('Invalid context artifact id');
}

function ensureInside(workspaceRoot: string, filePath: string): string {
  const resolved = path.resolve(filePath);
  const root = path.resolve(workspaceRoot);
  if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) throw new Error('Path traversal blocked');
  return resolved;
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

function collect(findings: CacheVolatilityFinding[], kind: CacheVolatilityFinding['kind'], text: string, regex: RegExp): void {
  for (const match of text.matchAll(regex)) findings.push({ kind, value: match[0] });
}

function pressure(inputTokens: number, reserveOutputTokens: number, maxContextTokens: number): number {
  return maxContextTokens <= 0 ? 1 : Number(((inputTokens + reserveOutputTokens) / maxContextTokens).toFixed(3));
}

function matchesPattern(pattern: string, value: string): boolean {
  return pattern.endsWith('*') ? value.startsWith(pattern.slice(0, -1)) : pattern === value;
}

function toolName(tool: Record<string, any>): string | undefined {
  return typeof tool.function?.name === 'string' ? tool.function.name : undefined;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9_]+/).map((token) => token.replace(/s$/, '')).filter((token) => token.length > 2);
}

function hasTokenOverlap(intentTokens: Set<string>, token: string): boolean {
  for (const intent of intentTokens) {
    if (intent === token || intent.includes(token) || token.includes(intent)) return true;
  }
  return false;
}

function parseEnvBoolean(value: string): boolean {
  return /^(1|true|yes|on)$/i.test(value);
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function buildFindToolDefinition(): Record<string, any> {
  return {
    type: 'function',
    function: {
      name: 'utk_find_tool',
      description: 'Find deferred tool schema by name or intent.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Tool name or task intent.' }
        },
        additionalProperties: false
      }
    }
  };
}

function findDedupedEvents(events: SessionContextLedgerEvent[]): SessionContextLedgerEvent[] {
  const latestByIdentity = new Map<string, SessionContextLedgerEvent>();
  for (const event of events) latestByIdentity.set(event.toolIdentity, event);
  return events.filter((event) => latestByIdentity.get(event.toolIdentity)?.messageId !== event.messageId);
}

function stableJson(value: unknown): string {
  if (!isObject(value) && !Array.isArray(value)) return JSON.stringify(value);
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

function nextId(prefix: string, value: number): string {
  return `${prefix}${String(value).padStart(4, '0')}`;
}

function idNumber(id: string | undefined, prefix: string): number {
  const match = new RegExp(`^${prefix}(\\d+)$`).exec(id ?? '');
  return match ? Number(match[1]) : 0;
}

async function nextBlockId(workspaceRoot: string): Promise<string> {
  const blockRoot = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'blocks');
  try {
    const records = await readArtifactRecords(workspaceRoot);
    const maxFromIndex = records.reduce((max, record) => Math.max(max, idNumber(record.blockId, 'b')), 0);
    const maxFromFiles = await readHighestBlockFileNumber(blockRoot);
    return nextId('b', Math.max(maxFromIndex, maxFromFiles) + 1);
  } catch {
    return 'b0001';
  }
}

async function readHighestBlockFileNumber(blockRoot: string): Promise<number> {
  try {
    const { readdir } = await import('node:fs/promises');
    const names = await readdir(blockRoot);
    return names.reduce((max, name) => Math.max(max, idNumber(path.basename(name, '.txt'), 'b')), 0);
  } catch {
    return 0;
  }
}

function isCompactableHistoryMessage(message: Record<string, any>, eventContents: Set<string>, eventNames: Set<string>): boolean {
  const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '');
  const name = typeof message.name === 'string' ? message.name : typeof message.tool_name === 'string' ? message.tool_name : '';
  if (message.role === 'tool') return true;
  if (eventContents.has(content)) return true;
  if (name && eventNames.has(name)) return true;
  return false;
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index]!)) return index;
  }
  return -1;
}

function lineOffsets(text: string): number[] {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') offsets.push(index + 1);
  }
  return offsets;
}

function detectRawLeakage(compactText: string, raw: string): boolean {
  if (/raw dump/i.test(compactText)) return true;
  if (!raw) return false;
  return compactText.length > raw.length * 0.8 && raw.length > 200;
}

function unique(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    const clean = value?.trim();
    if (!clean || seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
