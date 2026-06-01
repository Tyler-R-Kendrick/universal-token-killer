/* c8 ignore file -- exercised through server integration tests. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CompressorRegistry } from './contextGateway.js';
import { ClientClosedRequestError, readJsonObjectBody } from './httpJson.js';
import type { ModelProxyMetricsStore } from './metrics.js';
import { isObject, type JsonObject } from './openai.js';
import { proxyOpenAiRequest, type LocalToolExecutor } from './proxy.js';
import {
  createUpstreamRequest,
  type UpstreamProvider,
  type UpstreamProviderAdapter,
  type UpstreamProviderOptions
} from './upstreamProvider.js';

export type UpstreamRouteContext = {
  workspaceRoot: string;
  upstreamBaseUrl: string;
  upstreamProvider: UpstreamProvider;
  upstreamProviderAdapter: UpstreamProviderAdapter;
  upstreamProviderOptions?: UpstreamProviderOptions;
  upstreamApiVersion: string;
  upstreamOrganization?: string;
  upstreamApiKey?: string;
  upstreamTimeoutMs: number;
  compressorRegistry: CompressorRegistry;
  metricsStore: ModelProxyMetricsStore;
  toolExecutor?: LocalToolExecutor;
  mediateLocalToolResults?: boolean;
  promptCompressionProviderAdapters?: readonly UpstreamProviderAdapter[];
  promptCompressionProviderOptions?: UpstreamProviderOptions;
};

export async function handleUpstreamRoute(
  req: IncomingMessage,
  res: ServerResponse,
  route: string,
  context: UpstreamRouteContext,
  clientSignal?: AbortSignal
): Promise<boolean> {
  if (req.method === 'GET' && route === '/v1/models') {
    await context.metricsStore.recordRequest(route);
    const upstream = await fetchModelsWithTimeout(context, route, clientSignal);
    try {
      await pipeFetchResponse(upstream.response, res);
    } finally {
      upstream.cleanup();
    }
    return true;
  }
  if (req.method === 'POST' && (route === '/v1/chat/completions' || route === '/v1/responses')) {
    const body = await readJsonObjectBody(req);
    await context.metricsStore.recordRequest(route, Boolean(body.stream));
    await pipeFetchResponse(await proxyOpenAiRequest(route, body, {
      workspaceRoot: context.workspaceRoot,
      upstreamBaseUrl: context.upstreamBaseUrl,
      upstreamProvider: context.upstreamProvider,
      upstreamProviderAdapter: context.upstreamProviderAdapter,
      upstreamProviderOptions: context.upstreamProviderOptions,
      upstreamApiVersion: context.upstreamApiVersion,
      upstreamOrganization: context.upstreamOrganization,
      upstreamApiKey: context.upstreamApiKey,
      compressorRegistry: context.compressorRegistry,
      promptCompressionProviderAdapters: context.promptCompressionProviderAdapters,
      promptCompressionProviderOptions: context.promptCompressionProviderOptions,
      metricsStore: context.metricsStore,
      toolExecutor: context.toolExecutor,
      mediateLocalToolResults: context.mediateLocalToolResults,
      sessionId: deriveSessionId(req, body),
      signal: clientSignal
    }), res);
    return true;
  }
  return false;
}

async function fetchModelsWithTimeout(
  context: {
    upstreamBaseUrl: string;
    upstreamProviderAdapter: UpstreamProviderAdapter;
    upstreamProviderOptions?: UpstreamProviderOptions;
    upstreamApiVersion: string;
    upstreamOrganization?: string;
    upstreamApiKey?: string;
    upstreamTimeoutMs: number;
  },
  route: string,
  clientSignal?: AbortSignal
): Promise<{ response: Response; cleanup(): void }> {
  const controller = new AbortController();
  const unlinkClientSignal = linkAbortSignal(clientSignal, controller);
  const timeout = setTimeout(() => controller.abort(), context.upstreamTimeoutMs);
  try {
    const request = createUpstreamRequest(context.upstreamProviderAdapter, {
      baseUrl: context.upstreamBaseUrl,
      route,
      apiKey: context.upstreamApiKey,
      apiVersion: context.upstreamApiVersion,
      organization: context.upstreamOrganization,
      providerOptions: context.upstreamProviderOptions
    });
    const response = await fetch(request.url, {
      signal: controller.signal,
      headers: request.headers
    });
    return {
      response,
      cleanup() {
        clearTimeout(timeout);
        unlinkClientSignal();
      }
    };
  } catch (error) {
    clearTimeout(timeout);
    unlinkClientSignal();
    throw error;
  }
}

function linkAbortSignal(source: AbortSignal | undefined, target: AbortController): () => void {
  if (!source) return () => {};
  const abort = (): void => {
    if (!target.signal.aborted) {
      target.abort(source.reason instanceof Error ? source.reason : new ClientClosedRequestError());
    }
  };
  if (source.aborted) {
    abort();
    return () => {};
  }
  source.addEventListener('abort', abort, { once: true });
  return () => source.removeEventListener('abort', abort);
}

async function pipeFetchResponse(response: Response, res: ServerResponse): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      res.write(Buffer.from(chunk.value));
    }
    res.end();
  } finally {
    reader.releaseLock();
  }
}

function deriveSessionId(req: IncomingMessage, body: JsonObject): string | undefined {
  const header = req.headers['x-utk-session-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (Array.isArray(header) && typeof header[0] === 'string') return header[0];
  return isObject(body.metadata) && typeof body.metadata.utk_session_id === 'string' ? body.metadata.utk_session_id : undefined;
}
