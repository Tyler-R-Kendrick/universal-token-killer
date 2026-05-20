/* c8 ignore file -- covered by model-proxy behavior tests; fetch/stream branches depend on upstream shape. */
import { applyModelProxyPolicy, createDefaultCompressorRegistry, type CompressorRegistry } from './contextGateway.js';
import type { ModelProxyMetricsStore } from './metrics.js';
import { expandContextArtifact } from './recovery.js';

export type ProxyOpenAiRequestOptions = {
  workspaceRoot: string;
  upstreamBaseUrl: string;
  upstreamProvider?: 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference';
  upstreamApiVersion?: string;
  upstreamOrganization?: string;
  upstreamApiKey?: string;
  compressorRegistry?: CompressorRegistry;
  metricsStore?: ModelProxyMetricsStore;
  sessionId?: string;
  policyOverrides?: Record<string, any>;
};

export async function proxyOpenAiRequest(route: string, body: Record<string, any>, options: ProxyOpenAiRequestOptions): Promise<Response> {
  const policy = await applyModelProxyPolicy(body, {
    route,
    workspaceRoot: options.workspaceRoot,
    sessionId: options.sessionId,
    policyOverrides: options.policyOverrides,
    compressorRegistry: options.compressorRegistry ?? createDefaultCompressorRegistry(),
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

async function forward(route: string, body: Record<string, any>, options: ProxyOpenAiRequestOptions): Promise<Response> {
  const provider = options.upstreamProvider ?? 'openai';
  const headers = upstreamHeaders(provider, options);
  return fetch(joinUpstreamUrl(options.upstreamBaseUrl, route, { provider, apiVersion: options.upstreamApiVersion, organization: options.upstreamOrganization }), {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
}

export function joinUpstreamUrl(baseUrl: string, route: string, options: {
  provider?: 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference';
  apiVersion?: string;
  organization?: string;
} = {}): string {
  const base = baseUrl.replace(/\/$/, '');
  const provider = options.provider ?? 'openai';
  if (provider === 'github-models') {
    const root = base.replace(/\/inference$/, '');
    if (route === '/v1/models') return `${root}/catalog/models`;
    if (route === '/v1/chat/completions') {
      return options.organization
        ? `${root}/orgs/${encodeURIComponent(options.organization)}/inference/chat/completions`
        : `${base}/chat/completions`;
    }
    return `${base}${route.replace(/^\/v1/, '')}`;
  }
  if (provider === 'azure-ai-inference') {
    const separator = base.includes('?') ? '&' : '?';
    const apiVersion = encodeURIComponent(options.apiVersion ?? '2024-05-01-preview');
    if (route === '/v1/chat/completions') return `${base}/chat/completions${separator}api-version=${apiVersion}`;
    if (route === '/v1/models') return `${base}${separator}api-version=${apiVersion}`;
    return `${base}${route.replace(/^\/v1/, '')}${separator}api-version=${apiVersion}`;
  }
  const normalizedRoute = base.endsWith('/v1') && route.startsWith('/v1/') ? route.slice(3) : route;
  return `${base}${normalizedRoute.startsWith('/') ? '' : '/'}${normalizedRoute}`;
}

export function upstreamHeaders(provider: 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference', options: {
  upstreamApiKey?: string;
  upstreamApiVersion?: string;
} = {}): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const apiKey = options.upstreamApiKey ?? process.env.UTK_MODEL_PROXY_UPSTREAM_API_KEY ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.OPENAI_API_KEY;
  if (provider === 'github-models') {
    headers.accept = 'application/vnd.github+json';
    headers['x-github-api-version'] = options.upstreamApiVersion ?? '2026-03-10';
  }
  if (apiKey) {
    if (provider === 'azure-ai-inference' || provider === 'azure-openai') headers['api-key'] = apiKey;
    else headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function findExpandRequest(value: unknown): { callId: string; id: string; range?: string; query?: string; blockId?: string; handle?: Record<string, unknown> } | undefined {
  const choices = isObject(value) && Array.isArray(value.choices) ? value.choices : [];
  for (const choice of choices) {
    const calls = isObject(choice) && isObject(choice.message) && Array.isArray(choice.message.tool_calls) ? choice.message.tool_calls : [];
    for (const call of calls) {
      if (!isObject(call) || !isObject(call.function) || call.function.name !== 'utk_expand_context') continue;
      const args = typeof call.function.arguments === 'string' ? parseJson(call.function.arguments) : undefined;
      if (typeof args?.id === 'string' && typeof call.id === 'string') {
        return {
          callId: call.id,
          id: args.id,
          range: typeof args.range === 'string' ? args.range : undefined,
          query: typeof args.query === 'string' ? args.query : undefined,
          blockId: typeof args.blockId === 'string' ? args.blockId : undefined,
          handle: isObject(args.handle) ? args.handle : undefined
        };
      }
    }
  }
  return undefined;
}

function findToolRequest(value: unknown): { callId: string; query: string } | undefined {
  const choices = isObject(value) && Array.isArray(value.choices) ? value.choices : [];
  for (const choice of choices) {
    const calls = isObject(choice) && isObject(choice.message) && Array.isArray(choice.message.tool_calls) ? choice.message.tool_calls : [];
    for (const call of calls) {
      if (!isObject(call) || !isObject(call.function) || call.function.name !== 'utk_find_tool') continue;
      const args = typeof call.function.arguments === 'string' ? parseJson(call.function.arguments) : undefined;
      if (typeof args?.query === 'string' && typeof call.id === 'string') return { callId: call.id, query: args.query };
    }
  }
  return undefined;
}

async function resolveFindTool(workspaceRoot: string, request: Record<string, any>, query: string): Promise<string> {
  const catalogId = isObject(request.metadata) && typeof request.metadata.utk_tool_catalog_id === 'string' ? request.metadata.utk_tool_catalog_id : undefined;
  if (!catalogId) return JSON.stringify({ tool: null, reason: 'tool-catalog-unavailable' });
  const core = await import('@utk/core') as any;
  const result = await core.findToolDefinition(workspaceRoot, { catalogId, query });
  if (!result.tool) return JSON.stringify({ catalogId, query, tool: null, reason: result.reason });
  return JSON.stringify({ catalogId, query, tool: result.tool, reason: result.reason });
}

function appendToolResult(request: Record<string, any>, callId: string, name: string, content: string): Record<string, any> {
  const next = JSON.parse(JSON.stringify(request)) as Record<string, any>;
  if (Array.isArray(next.messages)) {
    next.messages.push({ role: 'tool', tool_call_id: callId, name, content });
  }
  if (Array.isArray(next.input)) {
    next.input.push({ type: 'function_call_output', call_id: callId, output: content });
  }
  return next;
}

function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function parseJson(value: string): Record<string, any> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
