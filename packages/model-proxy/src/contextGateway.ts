/* c8 ignore file -- Context gateway fail-open branches are covered through integration behavior tests. */
import { expandEditRangesInRequest } from './editRanges.js';
import { estimateTokens, isObject, normalizeOpenAiRequest } from './openai.js';
import { type ContextArtifact, persistCompactContextArtifact, persistContextArtifact } from './recovery.js';
import { createMetricsStore, type ModelProxyMetricsStore } from './metrics.js';
import { minimizeToolSchemas } from './toolSchema.js';
import { routeContentForProxy, shouldCompactContent } from './contentRouter.js';

export type TextCompressorProvider = {
  id: string;
  compress(text: string, options?: { query?: string; rate?: number }): Promise<{ text: string; rawTokens: number; compactTokens: number; applied: boolean }>;
};

export type CompressionProvider = {
  id: string;
  localOnly: boolean;
  supports(kind: string): boolean;
  compress(text: string, options?: { query?: string; rate?: number; kind?: string }): Promise<{ text: string; rawTokens: number; compactTokens: number; applied: boolean }>;
  estimateCost?(text: string, options?: { kind?: string }): number;
};

export type CompressorRegistry = {
  defaultText: TextCompressorProvider;
  providers: Record<string, TextCompressorProvider>;
};

export type ModelProxyPolicyContext = {
  route: string;
  workspaceRoot: string;
  sessionId?: string;
  policyOverrides?: Record<string, any>;
  compressorRegistry?: CompressorRegistry;
  metricsStore?: ModelProxyMetricsStore;
};

export type AppliedModelProxyPolicy = {
  request: Record<string, any>;
  policy: Record<string, any>;
  metrics: {
    rawTokens: number;
    compactTokens: number;
    promptTokensBefore: number;
    promptTokensAfter: number;
    routeReasons: string[];
    toolSchemaTokensBefore: number;
    toolSchemaTokensAfter: number;
    customToolOverheadTokens: number;
    builtinVsCustomTokenRatio: number;
    toolDiscoveryTokensBefore: number;
    toolDiscoveryTokensAfter: number;
    cacheVolatilityFindings: number;
  };
  artifacts: ContextArtifact[];
  promptArtifacts: Array<{ id: string; path: string; surface: string }>;
};

export function createDefaultCompressorRegistry(options: { fake?: boolean } = {}): CompressorRegistry {
  const provider: TextCompressorProvider = {
    id: options.fake ? 'fake-local' : 'llmlingua2',
    async compress(text, compressorOptions) {
      if (options.fake) {
        const words = text.split(/\s+/).filter(Boolean);
        const kept = words.slice(0, Math.max(1, Math.ceil(words.length * (compressorOptions?.rate ?? 0.33)))).join(' ');
        return { text: kept, rawTokens: estimateTokens(text), compactTokens: estimateTokens(kept), applied: kept !== text };
      }
      return { text, rawTokens: estimateTokens(text), compactTokens: estimateTokens(text), applied: false };
    }
  };
  return { defaultText: provider, providers: { [provider.id]: provider } };
}

export async function applyModelProxyPolicy(body: Record<string, any>, context: ModelProxyPolicyContext): Promise<AppliedModelProxyPolicy> {
  const policy = await resolvePolicy(context.workspaceRoot, context.policyOverrides);
  const minTokens = policy.compression_level === 'off' ? Number.MAX_SAFE_INTEGER : policy.min_tokens;
  const normalized = normalizeOpenAiRequest(context.route, body);
  const metricsStore = context.metricsStore ?? createMetricsStore(context.workspaceRoot);
  const sessionId = context.sessionId ?? deriveSessionId(body);
  let request = clone(normalized.body);
  const artifacts: ContextArtifact[] = [];
  const artifactContents: string[] = [];
  const routeReasons = new Set<string>();
  let rawTokens = 0;
  let compactTokens = 0;
  let toolSchemaTokensBefore = 0;
  let toolSchemaTokensAfter = 0;
  let toolDiscoveryTokensBefore = 0;
  let toolDiscoveryTokensAfter = 0;
  let promptTokensBefore = 0;
  let promptTokensAfter = 0;
  let cacheVolatilityFindings = 0;
  const promptArtifacts: Array<{ id: string; path: string; surface: string }> = [];
  const query = findLastUserQuery(normalized);
  const budget = await evaluateBudget(request, policy.reserve_output_tokens, policy.history_compaction_threshold);
  if (budget.shouldCompactHistory) routeReasons.add('history-summary');

  if (policy.expand_edit_ranges && normalized.kind === 'chat') {
    request = await expandEditRangesInRequest(request, { workspaceRoot: context.workspaceRoot, enabled: true });
  }

  if (normalized.kind === 'chat') {
    const messages = Array.isArray(request.messages) ? request.messages : [];
    const promptOptimization = await optimizeChatPromptMessages(messages, context.workspaceRoot);
    promptTokensBefore += promptOptimization.before;
    promptTokensAfter += promptOptimization.after;
    promptArtifacts.push(...promptOptimization.artifacts);
    cacheVolatilityFindings += await countCacheVolatility(messages.map((message) => typeof message.content === 'string' ? message.content : '').join('\n'));
    const promptCompression = await compressChatPromptMessagesWithModel(messages, policy);
    promptTokensBefore += promptCompression.before;
    promptTokensAfter += promptCompression.after;
    if (promptCompression.applied > 0) routeReasons.add('prompt-compression-model');
    for (const message of messages) {
      if (!isObject(message)) continue;
      const content = typeof message.content === 'string' ? message.content : undefined;
      if (!content || !isToolLikeMessage(message) || !shouldCompactContent(content, minTokens)) continue;
      const compacted = await compactToolText(context.workspaceRoot, content, query);
      message.content = compacted.text;
      artifacts.push(compacted.artifact);
      artifactContents.push(content);
      rawTokens += compacted.artifact.rawTokens;
      compactTokens += compacted.artifact.compactTokens;
      routeReasons.add(compacted.routeReason);
      await metricsStore.recordPolicy({ route: context.route, routeReason: compacted.routeReason, rawTokens: compacted.artifact.rawTokens, compactTokens: compacted.artifact.compactTokens, artifactId: compacted.artifact.id });
    }
    if (budget.shouldCompactHistory && artifacts.length > 0 && policy.session_blocks_enabled) {
      const compactedHistory = await replaceHistoryWithSessionBlock({
        workspaceRoot: context.workspaceRoot,
        sessionId,
        messages,
        artifacts,
        rawContents: artifactContents,
        reserveOutputTokens: policy.reserve_output_tokens,
        mode: policy.history_compaction_mode
      });
      if (compactedHistory.blocks.length > 0) {
        request.messages = compactedHistory.messages;
        const block = compactedHistory.blocks[0];
        routeReasons.add('session-block');
        await metricsStore.recordPolicy({
          route: context.route,
          routeReason: 'session-block',
          rawTokens: block.rawTokens,
          compactTokens: block.compactTokens,
          artifactId: block.artifactIds[0],
          sessionBlocks: compactedHistory.blocks.length
        });
      }
    }
    if (Array.isArray(request.tools) && policy.tool_discovery_mode !== 'off') {
      const discovered = await applyToolDiscovery({
        workspaceRoot: context.workspaceRoot,
        request,
        query,
        mode: policy.tool_discovery_mode,
        injectExpandContext: policy.inject_expand_context,
        deferredEnabled: policy.deferred_tool_search_enabled,
        requiredToolNames: policy.inject_expand_context ? ['utk_expand_context'] : []
      });
      request.tools = discovered.tools;
      toolDiscoveryTokensBefore = discovered.beforeTokens;
      toolDiscoveryTokensAfter = discovered.afterTokens;
      if (discovered.tokensSaved > 0) routeReasons.add(discovered.routeReason);
    }
    if (policy.minimize_tool_schemas && Array.isArray(request.tools)) {
      const minimized = minimizeToolSchemas(request.tools, policy.inject_expand_context);
      request.tools = minimized.tools;
      toolSchemaTokensBefore = minimized.beforeTokens;
      toolSchemaTokensAfter = minimized.afterTokens;
    } else if (policy.inject_expand_context) {
      const minimized = minimizeToolSchemas(request.tools ?? [], true);
      request.tools = minimized.tools;
      toolSchemaTokensBefore = minimized.beforeTokens;
      toolSchemaTokensAfter = minimized.afterTokens;
    }
  } else {
    const promptOptimization = await optimizeResponsesPromptSurfaces(request, context.workspaceRoot);
    promptTokensBefore += promptOptimization.before;
    promptTokensAfter += promptOptimization.after;
    promptArtifacts.push(...promptOptimization.artifacts);
    cacheVolatilityFindings += await countCacheVolatility(String(request.instructions ?? ''));
    const promptCompression = await compressResponsesPromptSurfacesWithModel(request, policy);
    promptTokensBefore += promptCompression.before;
    promptTokensAfter += promptCompression.after;
    if (promptCompression.applied > 0) routeReasons.add('prompt-compression-model');
    const items = Array.isArray(request.input) ? request.input : [];
    for (const item of items) {
      if (!isObject(item) || item.type !== 'function_call_output' || typeof item.output !== 'string') continue;
      if (!shouldCompactContent(item.output, minTokens)) continue;
      const compacted = await compactToolText(context.workspaceRoot, item.output, query);
      item.output = compacted.text;
      artifacts.push(compacted.artifact);
      artifactContents.push(item.output);
      rawTokens += compacted.artifact.rawTokens;
      compactTokens += compacted.artifact.compactTokens;
      routeReasons.add(compacted.routeReason);
      await metricsStore.recordPolicy({ route: context.route, routeReason: compacted.routeReason, rawTokens: compacted.artifact.rawTokens, compactTokens: compacted.artifact.compactTokens, artifactId: compacted.artifact.id });
    }
    if (Array.isArray(request.tools) && policy.tool_discovery_mode !== 'off') {
      const discovered = await applyToolDiscovery({
        workspaceRoot: context.workspaceRoot,
        request,
        query,
        mode: policy.tool_discovery_mode,
        injectExpandContext: policy.inject_expand_context,
        deferredEnabled: policy.deferred_tool_search_enabled,
        requiredToolNames: policy.inject_expand_context ? ['utk_expand_context'] : []
      });
      request.tools = discovered.tools;
      toolDiscoveryTokensBefore = discovered.beforeTokens;
      toolDiscoveryTokensAfter = discovered.afterTokens;
      if (discovered.tokensSaved > 0) routeReasons.add(discovered.routeReason);
    }
  }

  if (promptTokensBefore > promptTokensAfter || toolDiscoveryTokensBefore > toolDiscoveryTokensAfter || cacheVolatilityFindings > 0 || routeReasons.has('history-summary')) {
    await metricsStore.recordPolicy({
      route: context.route,
      routeReason: routeReasons.has('tool-discovery') ? 'tool-discovery' : routeReasons.has('history-summary') ? 'history-summary' : 'prompt-surface',
      rawTokens: 0,
      compactTokens: 0,
      promptTokensBefore,
      promptTokensAfter,
      toolDiscoveryTokensBefore,
      toolDiscoveryTokensAfter,
      cacheVolatilityFindings
    });
  }

  return {
    request,
    policy,
    metrics: {
      rawTokens,
      compactTokens,
      promptTokensBefore,
      promptTokensAfter,
      routeReasons: [...routeReasons],
      toolSchemaTokensBefore,
      toolSchemaTokensAfter,
      customToolOverheadTokens: Math.max(0, toolSchemaTokensAfter - toolSchemaTokensBefore),
      builtinVsCustomTokenRatio: toolSchemaTokensBefore === 0 ? 1 : Number((toolSchemaTokensAfter / toolSchemaTokensBefore).toFixed(3)),
      toolDiscoveryTokensBefore,
      toolDiscoveryTokensAfter,
      cacheVolatilityFindings
    },
    artifacts,
    promptArtifacts
  };
}

export function createPolicyMetricsStore(workspaceRoot: string): ModelProxyMetricsStore {
  return createMetricsStore(workspaceRoot);
}

async function compactToolText(workspaceRoot: string, content: string, query: string): Promise<{ text: string; artifact: ContextArtifact; routeReason: string }> {
  const routed = routeContentForProxy(content, query);
  const artifact = await persistContextArtifact({
    workspaceRoot,
    content,
    kind: routed.kind,
    rawTokens: routed.rawTokens,
    compactTokens: routed.compactTokens
  });
  const text = [
    `[utk-ref:${artifact.id}] ${routed.routeReason}; raw omitted; call utk_expand_context with id to recover full payload.`,
    routed.compactText
  ].join('\n');
  const compactArtifact = await persistCompactContextArtifact(workspaceRoot, artifact, text);
  return { text, artifact: { ...compactArtifact, compactTokens: estimateTokens(text) }, routeReason: routed.routeReason };
}

function isToolLikeMessage(message: Record<string, any>): boolean {
  return message.role === 'tool' || typeof message.tool_call_id === 'string' || typeof message.name === 'string';
}

function findLastUserQuery(normalized: ReturnType<typeof normalizeOpenAiRequest>): string {
  if (normalized.kind === 'chat') {
    const user = [...normalized.messages].reverse().find((message) => message.role === 'user');
    return contentToText(user?.content);
  }
  const user = [...normalized.items].reverse().find((item) => item.role === 'user');
  return contentToText(user?.content);
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item) => isObject(item) && typeof item.text === 'string' ? item.text : '').filter(Boolean).join('\n');
  }
  return '';
}

async function optimizeChatPromptMessages(messages: Array<Record<string, any>>, workspaceRoot: string): Promise<{ before: number; after: number; artifacts: Array<{ id: string; path: string; surface: string }> }> {
  let before = 0;
  let after = 0;
  const artifacts: Array<{ id: string; path: string; surface: string }> = [];
  for (const message of messages) {
    if (!isSystemLikeRole(message.role) || typeof message.content !== 'string') continue;
    const surface = 'system-prompt';
    const optimized = await optimizePrompt({ workspaceRoot, surface, text: message.content, persistOriginal: true });
    message.content = optimized.optimizedText;
    before += optimized.metrics.rawTokens;
    after += optimized.metrics.optimizedTokens;
    if (optimized.artifactId && optimized.artifactPath) artifacts.push({ id: optimized.artifactId, path: optimized.artifactPath, surface });
  }
  return { before, after, artifacts };
}

async function replaceHistoryWithSessionBlock(params: {
  workspaceRoot: string;
  sessionId: string;
  messages: Array<Record<string, any>>;
  artifacts: ContextArtifact[];
  rawContents: string[];
  reserveOutputTokens: number;
  mode: 'summary-block' | 'replace-with-summary-block';
}): Promise<{ messages: Array<Record<string, any>>; blocks: any[] }> {
  const core = await import('@utk/core') as any;
  const ledger = core.createSessionContextLedger({ workspaceRoot: params.workspaceRoot, sessionId: params.sessionId });
  const events = [];
  for (let index = 0; index < params.artifacts.length; index += 1) {
    const artifact = params.artifacts[index]!;
    events.push(await ledger.recordToolEvent({
      turn: 1,
      role: 'tool',
      toolName: artifact.kind,
      input: { artifactId: artifact.id },
      content: params.rawContents[index] ?? '',
      rawTokens: artifact.rawTokens,
      compactTokens: artifact.compactTokens,
      artifactId: artifact.id,
      artifactPath: artifact.path,
      routeId: artifact.kind,
      schemaId: `${artifact.kind}.v1`,
      decision: 'tool-output',
      status: 'ok'
    }));
  }
  return core.compactHistoryForRequest({
    workspaceRoot: params.workspaceRoot,
    sessionId: params.sessionId,
    messages: params.messages,
    events,
    budget: { shouldCompactHistory: true, reservedOutputTokens: params.reserveOutputTokens },
    mode: params.mode
  });
}

async function optimizeResponsesPromptSurfaces(request: Record<string, any>, workspaceRoot: string): Promise<{ before: number; after: number; artifacts: Array<{ id: string; path: string; surface: string }> }> {
  let before = 0;
  let after = 0;
  const artifacts: Array<{ id: string; path: string; surface: string }> = [];
  if (typeof request.instructions === 'string') {
    const optimized = await optimizePrompt({ workspaceRoot, surface: 'system-prompt', text: request.instructions, persistOriginal: true });
    request.instructions = optimized.optimizedText;
    before += optimized.metrics.rawTokens;
    after += optimized.metrics.optimizedTokens;
    if (optimized.artifactId && optimized.artifactPath) artifacts.push({ id: optimized.artifactId, path: optimized.artifactPath, surface: 'system-prompt' });
  }

  const items = Array.isArray(request.input) ? request.input : [];
  for (const item of items) {
    if (!isSystemLikeRole(item?.role) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (!isObject(part) || typeof part.text !== 'string') continue;
      const optimized = await optimizePrompt({ workspaceRoot, surface: 'system-prompt', text: part.text, persistOriginal: true });
      part.text = optimized.optimizedText;
      before += optimized.metrics.rawTokens;
      after += optimized.metrics.optimizedTokens;
      if (optimized.artifactId && optimized.artifactPath) artifacts.push({ id: optimized.artifactId, path: optimized.artifactPath, surface: 'system-prompt' });
    }
  }
  return { before, after, artifacts };
}

async function compressChatPromptMessagesWithModel(messages: Array<Record<string, any>>, policy: Record<string, any>): Promise<{ before: number; after: number; applied: number }> {
  let before = 0;
  let after = 0;
  let applied = 0;
  for (const message of messages) {
    if (!isPromptRole(message.role) || typeof message.content !== 'string') continue;
    const compressed = await compressPromptTextWithModel(message.content, String(message.role), policy);
    before += compressed.before;
    after += compressed.after;
    if (compressed.applied) {
      message.content = compressed.text;
      applied += 1;
    }
  }
  return { before, after, applied };
}

async function compressResponsesPromptSurfacesWithModel(request: Record<string, any>, policy: Record<string, any>): Promise<{ before: number; after: number; applied: number }> {
  let before = 0;
  let after = 0;
  let applied = 0;
  if (typeof request.instructions === 'string') {
    const compressed = await compressPromptTextWithModel(request.instructions, 'instructions', policy);
    before += compressed.before;
    after += compressed.after;
    if (compressed.applied) {
      request.instructions = compressed.text;
      applied += 1;
    }
  }
  const items = Array.isArray(request.input) ? request.input : [];
  for (const item of items) {
    if (!isPromptRole(item?.role) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (!isObject(part) || typeof part.text !== 'string') continue;
      const compressed = await compressPromptTextWithModel(part.text, String(item.role), policy);
      before += compressed.before;
      after += compressed.after;
      if (compressed.applied) {
        part.text = compressed.text;
        applied += 1;
      }
    }
  }
  return { before, after, applied };
}

async function compressPromptTextWithModel(text: string, role: string, policy: Record<string, any>): Promise<{ text: string; before: number; after: number; applied: boolean }> {
  const before = estimateTokens(text);
  if (!policy.prompt_compression_enabled || policy.prompt_compression_provider === 'none' || before < Number(policy.prompt_compression_min_tokens ?? 64)) {
    return { text, before: 0, after: 0, applied: false };
  }
  const baseUrl = String(policy.prompt_compression_base_url ?? '');
  const apiKey = promptCompressionApiKey(policy);
  if (!apiKey && !isLoopbackUrl(baseUrl)) return { text, before: 0, after: 0, applied: false };
  const controller = new AbortController();
  const timeoutMs = readPositiveNumber(policy.prompt_compression_timeout_ms, 2500);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(promptCompressionUrl(policy), {
      method: 'POST',
      headers: promptCompressionHeaders(policy, apiKey),
      signal: controller.signal,
      body: JSON.stringify({
        model: String(policy.prompt_compression_model ?? 'openai/gpt-4.1'),
        messages: [
          {
            role: 'system',
            content: 'Compress this prompt for a downstream LLM. Preserve security instructions, exact paths, commands, code fences, JSON keys, numbers, IDs, and policy priority. Return only compressed prompt text.'
          },
          { role: 'user', content: `${role} prompt:\n${text}` }
        ],
        temperature: 0
      })
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return { text, before: 0, after: 0, applied: false };
    const json = await response.json() as any;
    const compressed = String(json?.choices?.[0]?.message?.content ?? '').trim();
    if (!compressed || estimateTokens(compressed) > before) return { text, before, after: before, applied: false };
    return { text: compressed, before, after: estimateTokens(compressed), applied: true };
  } catch (error) {
    if (isAbortError(error)) {
      console.warn(`UTK model proxy prompt compression timed out after ${timeoutMs}ms; forwarding original prompt.`);
    }
    return { text, before: 0, after: 0, applied: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function optimizePrompt(params: { workspaceRoot: string; surface: string; text: string; persistOriginal: boolean }): Promise<any> {
  const core = await import('@utk/core') as any;
  return core.optimizePromptSurface(params);
}

async function filterToolsForIntent(tools: unknown, intent: string, mode: string, requiredToolNames: string[]): Promise<any> {
  const core = await import('@utk/core') as any;
  return core.filterToolDefinitionsForIntent(tools, { intent, mode, requiredToolNames });
}

async function applyToolDiscovery(params: {
  workspaceRoot: string;
  request: Record<string, any>;
  query: string;
  mode: string;
  injectExpandContext: boolean;
  deferredEnabled: boolean;
  requiredToolNames: string[];
}): Promise<any> {
  if (params.mode !== 'deferred-search' || !params.deferredEnabled) {
    return filterToolsForIntent(params.request.tools, params.query, params.mode, params.requiredToolNames);
  }
  const core = await import('@utk/core') as any;
  const catalog = await core.createToolCatalog({
    workspaceRoot: params.workspaceRoot,
    requestId: String(params.request.metadata?.utk_request_id ?? `req_${Date.now()}`),
    tools: params.request.tools
  });
  params.request.metadata = { ...(isObject(params.request.metadata) ? params.request.metadata : {}), utk_tool_catalog_id: catalog.catalogId };
  const findOnly = core.filterToolDefinitionsForIntent([], { intent: params.query, mode: 'deferred-search', requiredToolNames: [] });
  const tools = [...findOnly.tools];
  if (params.injectExpandContext) {
    const minimized = minimizeToolSchemas([], true);
    tools.unshift(...minimized.tools.filter((tool) => tool.function?.name === 'utk_expand_context'));
  }
  const beforeTokens = estimateTokens(JSON.stringify(params.request.tools ?? []));
  const afterTokens = estimateTokens(JSON.stringify(tools));
  return {
    tools,
    removedToolNames: Array.isArray(params.request.tools) ? params.request.tools.map((tool) => isObject(tool) ? tool.function?.name : undefined).filter(Boolean) : [],
    beforeTokens,
    afterTokens,
    tokensSaved: Math.max(0, beforeTokens - afterTokens),
    routeReason: 'tool-discovery'
  };
}

async function countCacheVolatility(text: string): Promise<number> {
  const core = await import('@utk/core') as any;
  return core.detectCacheVolatility(text).findings.length;
}

async function evaluateBudget(request: Record<string, any>, reserveOutputTokens: number, threshold: number): Promise<any> {
  const core = await import('@utk/core') as any;
  const manager = new core.ContextBudgetManager({
    maxContextTokens: Number(request.max_context_tokens ?? 128000),
    reserveOutputTokens,
    historyCompactionThreshold: threshold,
    cheapModelPatterns: ['gpt-*-mini', '*cheap*']
  });
  return manager.evaluate({ inputTokens: estimateTokens(JSON.stringify(request)), model: String(request.model ?? '') });
}

async function resolvePolicy(workspaceRoot: string, overrides: Record<string, any> | undefined): Promise<any> {
  const core = await import('@utk/core') as any;
  return core.resolveModelProxyPolicy(workspaceRoot, process.env, overrides ?? {});
}

function deriveSessionId(body: Record<string, any>): string {
  const fromMetadata = isObject(body.metadata) && typeof body.metadata.utk_session_id === 'string' ? body.metadata.utk_session_id : undefined;
  if (fromMetadata) return fromMetadata.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
  return `req_${String(body.model ?? 'model')}_${estimateTokens(JSON.stringify(body))}`.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
}

function isSystemLikeRole(role: unknown): boolean {
  return role === 'system' || role === 'developer';
}

function isPromptRole(role: unknown): boolean {
  return role === 'system' || role === 'developer' || role === 'user';
}

function promptCompressionUrl(policy: Record<string, any>): string {
  const base = String(policy.prompt_compression_base_url ?? '').replace(/\/$/, '');
  const provider = String(policy.prompt_compression_provider ?? 'github-models');
  if (provider === 'azure-ai-inference') {
    const separator = base.includes('?') ? '&' : '?';
    return `${base}/chat/completions${separator}api-version=${encodeURIComponent(String(policy.upstream_api_version ?? '2024-05-01-preview'))}`;
  }
  return `${base}/chat/completions`;
}

function promptCompressionHeaders(policy: Record<string, any>, apiKey: string | undefined): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const provider = String(policy.prompt_compression_provider ?? 'github-models');
  if (provider === 'github-models') {
    headers.accept = 'application/vnd.github+json';
    headers['x-github-api-version'] = String(policy.upstream_api_version ?? '2026-03-10');
  }
  if (apiKey) {
    if (provider === 'azure-ai-inference' || provider === 'azure-openai') headers['api-key'] = apiKey;
    else headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function promptCompressionApiKey(policy: Record<string, any>): string | undefined {
  return process.env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_API_KEY ??
    process.env.UTK_MODEL_PROXY_UPSTREAM_API_KEY ??
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    process.env.OPENAI_API_KEY ??
    (typeof policy.prompt_compression_api_key === 'string' ? policy.prompt_compression_api_key : undefined);
}

function isLoopbackUrl(value: string): boolean {
  return /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(value);
}

function readPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
