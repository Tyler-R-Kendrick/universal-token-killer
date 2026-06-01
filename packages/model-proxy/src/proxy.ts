/* c8 ignore file -- covered by model-proxy behavior tests; fetch/stream branches depend on upstream shape. */
import {
  findToolDefinition,
  type ArtifactHandle,
  type LocalToolEmbeddingProvider,
  type LocalToolEmbeddingProviderAdapterEntry,
  type ModelProxyPolicy
} from '@utk/core';
import { applyModelProxyPolicy, createDefaultCompressorRegistry, type CompressorRegistry } from './contextGateway.js';
import type { ModelProxyMetricsStore } from './metrics.js';
import { cloneJson, isObject, jsonResponse, parseJsonObject, type JsonObject } from './openai.js';
import { expandContextArtifact } from './recovery.js';
import { maybeBypassToolCall, type LocalToolExecutor } from './toolBypass.js';
import {
  createUpstreamRequest,
  resolveUpstreamProviderAdapter,
  type UpstreamProvider,
  type UpstreamProviderAdapter,
  type UpstreamProviderOptions
} from './upstreamProvider.js';

export type { LocalToolExecutionCall, LocalToolExecutor } from './toolBypass.js';
export { joinUpstreamUrl, upstreamHeaders } from './upstreamProvider.js';

export type ProxyOpenAiRequestOptions = {
  workspaceRoot: string;
  upstreamBaseUrl: string;
  upstreamProvider?: UpstreamProvider;
  upstreamProviderAdapter?: UpstreamProviderAdapter;
  upstreamProviderAdapters?: readonly UpstreamProviderAdapter[];
  upstreamProviderOptions?: UpstreamProviderOptions;
  promptCompressionProviderAdapters?: readonly UpstreamProviderAdapter[];
  promptCompressionProviderOptions?: UpstreamProviderOptions;
  upstreamApiVersion?: string;
  upstreamOrganization?: string;
  upstreamApiKey?: string;
  compressorRegistry?: CompressorRegistry;
  metricsStore?: ModelProxyMetricsStore;
  sessionId?: string;
  policyOverrides?: Partial<ModelProxyPolicy>;
  toolEmbeddingProvider?: LocalToolEmbeddingProvider;
  toolEmbeddingProviders?: LocalToolEmbeddingProvider[];
  toolEmbeddingProviderAdapters?: readonly LocalToolEmbeddingProviderAdapterEntry[];
  toolExecutor?: LocalToolExecutor;
  mediateLocalToolResults?: boolean;
  signal?: AbortSignal;
};

export async function proxyOpenAiRequest(route: string, body: JsonObject, options: ProxyOpenAiRequestOptions): Promise<Response> {
  const bypass = await maybeBypassToolCall(route, body, {
    workspaceRoot: options.workspaceRoot,
    metricsStore: options.metricsStore,
    toolEmbeddingProvider: options.toolEmbeddingProvider,
    toolEmbeddingProviders: options.toolEmbeddingProviders,
    toolEmbeddingProviderAdapters: options.toolEmbeddingProviderAdapters,
    toolExecutor: options.toolExecutor,
    mediateLocalToolResults: options.mediateLocalToolResults,
    continueRequest: (nextRoute, nextBody) => proxyOpenAiRequest(nextRoute, nextBody, options)
  });
  if (bypass) return bypass;

  const policy = await applyModelProxyPolicy(body, {
    route,
    workspaceRoot: options.workspaceRoot,
    sessionId: options.sessionId,
    policyOverrides: options.policyOverrides,
    compressorRegistry: options.compressorRegistry ?? createDefaultCompressorRegistry(),
    promptCompressionProviderAdapters: options.promptCompressionProviderAdapters ?? options.upstreamProviderAdapters,
    promptCompressionProviderOptions: options.promptCompressionProviderOptions,
    metricsStore: options.metricsStore
  });
  const response = await forward(route, policy.request, options);
  if (body.stream || !response.headers.get('content-type')?.includes('application/json')) {
    return response;
  }
  const json = await response.json() as unknown;
  const expansion = findExpandRequest(json);
  if (!expansion) {
    const findTool = findToolRequest(json);
    if (findTool) {
      const content = await resolveFindTool(options.workspaceRoot, policy.request, findTool.query);
      await options.metricsStore?.recordPolicy({ route, routeReason: 'tool-discovery', rawTokens: 0, compactTokens: 0 });
      return forward(route, appendToolResult(policy.request, findTool.callId, 'utk_find_tool', content), options);
    }
    return jsonResponse(json, response.status);
  }
  const expanded = await expandContextArtifact(options.workspaceRoot, expansion.id, { range: expansion.range, query: expansion.query, blockId: expansion.blockId, handle: expansion.handle });
  await options.metricsStore?.recordPolicy({ route, routeReason: 'recovery-tool', rawTokens: 0, compactTokens: 0, recoveryExpansions: 1 });
  const followUp = appendToolResult(policy.request, expansion.callId, 'utk_expand_context', expanded.content);
  return forward(route, followUp, options);
}

async function forward(route: string, body: JsonObject, options: ProxyOpenAiRequestOptions): Promise<Response> {
  const adapter = options.upstreamProviderAdapter ??
    resolveUpstreamProviderAdapter(options.upstreamProvider ?? 'openai', options.upstreamProviderAdapters);
  const request = createUpstreamRequest(adapter, {
    baseUrl: options.upstreamBaseUrl,
    route,
    apiKey: options.upstreamApiKey,
    apiVersion: options.upstreamApiVersion,
    organization: options.upstreamOrganization,
    providerOptions: options.upstreamProviderOptions
  });
  return fetch(request.url, {
    method: 'POST',
    headers: request.headers,
    signal: options.signal,
    body: JSON.stringify(body)
  });
}

function findExpandRequest(value: unknown): { callId: string; id: string; range?: string; query?: string; blockId?: string; handle?: ArtifactHandle } | undefined {
  const request = findFunctionCall(value, 'utk_expand_context');
  const args = request?.args;
  if (!request || typeof args?.id !== 'string') return undefined;
  return {
    callId: request.callId,
    id: args.id,
    range: typeof args.range === 'string' ? args.range : undefined,
    query: typeof args.query === 'string' ? args.query : undefined,
    blockId: typeof args.blockId === 'string' ? args.blockId : undefined,
    handle: readArtifactHandle(args.handle)
  };
}

function findToolRequest(value: unknown): { callId: string; query: string } | undefined {
  const request = findFunctionCall(value, 'utk_find_tool');
  return request && typeof request.args.query === 'string' ? { callId: request.callId, query: request.args.query } : undefined;
}

function findFunctionCall(value: unknown, name: string): { callId: string; args: JsonObject } | undefined {
  const choices = isObject(value) && Array.isArray(value.choices) ? value.choices : [];
  for (const choice of choices) {
    const calls = isObject(choice) && isObject(choice.message) && Array.isArray(choice.message.tool_calls) ? choice.message.tool_calls : [];
    for (const call of calls) {
      if (!isObject(call) || !isObject(call.function) || call.function.name !== name || typeof call.id !== 'string') continue;
      const args = typeof call.function.arguments === 'string' ? parseJsonObject(call.function.arguments) : undefined;
      if (args) return { callId: call.id, args };
    }
  }
  return undefined;
}

async function resolveFindTool(workspaceRoot: string, request: JsonObject, query: string): Promise<string> {
  const catalogId = isObject(request.metadata) && typeof request.metadata.utk_tool_catalog_id === 'string' ? request.metadata.utk_tool_catalog_id : undefined;
  if (!catalogId) return JSON.stringify({ tool: null, reason: 'tool-catalog-unavailable' });
  const result = await findToolDefinition(workspaceRoot, { catalogId, query });
  if (!result.tool) return JSON.stringify({ catalogId, query, tool: null, reason: result.reason });
  return JSON.stringify({ catalogId, query, tool: result.tool, reason: result.reason });
}

function readArtifactHandle(value: unknown): ArtifactHandle | undefined {
  if (!isObject(value) || typeof value.artifactId !== 'string') return undefined;
  return {
    artifactId: value.artifactId,
    routeId: typeof value.routeId === 'string' ? value.routeId : undefined,
    schemaId: typeof value.schemaId === 'string' ? value.schemaId : undefined,
    relativePath: typeof value.relativePath === 'string' ? value.relativePath : undefined,
    range: typeof value.range === 'string' ? value.range : undefined,
    snippet: typeof value.snippet === 'string' ? value.snippet : undefined
  };
}

function appendToolResult(request: JsonObject, callId: string, name: string, content: string): JsonObject {
  const next = cloneJson(request);
  if (Array.isArray(next.messages)) {
    next.messages.push({ role: 'tool', tool_call_id: callId, name, content });
  }
  if (Array.isArray(next.input)) {
    next.input.push({ type: 'function_call_output', call_id: callId, output: content });
  }
  return next;
}
