#!/usr/bin/env node
/* c8 ignore file -- covered by model-proxy behavior tests; HTTP server branches are integration-tested. */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import path from 'node:path';
import { createDefaultCompressorRegistry, type CompressorRegistry } from './contextGateway.js';
import { createMetricsStore, type ModelProxyMetricsStore } from './metrics.js';
import { proxyOpenAiRequest } from './proxy.js';
import { expandContextArtifact } from './recovery.js';
import { joinUpstreamUrl, upstreamHeaders } from './proxy.js';

export type ModelProxyServerOptions = {
  workspaceRoot?: string;
  host?: string;
  port?: number;
  upstreamBaseUrl?: string;
  upstreamProvider?: 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference';
  upstreamApiVersion?: string;
  upstreamOrganization?: string;
  upstreamApiKey?: string;
  upstreamTimeoutMs?: number;
  compressorRegistry?: CompressorRegistry;
};

export type ModelProxyServer = {
  server: Server;
  url: string;
  metricsStore: ModelProxyMetricsStore;
  close(): Promise<void>;
};

export async function createModelProxyServer(options: ModelProxyServerOptions = {}): Promise<ModelProxyServer> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.env.UTK_MODEL_PROXY_WORKSPACE_ROOT ?? process.cwd());
  const host = options.host ?? process.env.UTK_MODEL_PROXY_HOST ?? '127.0.0.1';
  const port = options.port ?? Number(process.env.UTK_MODEL_PROXY_PORT ?? 8787);
  const upstreamProvider = options.upstreamProvider ?? readUpstreamProvider(process.env.UTK_MODEL_PROXY_UPSTREAM_PROVIDER);
  const upstreamBaseUrl = options.upstreamBaseUrl ?? process.env.UTK_MODEL_PROXY_UPSTREAM_BASE_URL ?? defaultUpstreamBaseUrl(upstreamProvider);
  const upstreamApiVersion = options.upstreamApiVersion ?? process.env.UTK_MODEL_PROXY_UPSTREAM_API_VERSION ?? defaultUpstreamApiVersion(upstreamProvider);
  const upstreamOrganization = options.upstreamOrganization ?? process.env.UTK_MODEL_PROXY_UPSTREAM_ORGANIZATION;
  const upstreamApiKey = options.upstreamApiKey ?? process.env.UTK_MODEL_PROXY_UPSTREAM_API_KEY ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.OPENAI_API_KEY;
  const upstreamTimeoutMs = readPositiveNumber(options.upstreamTimeoutMs ?? process.env.UTK_MODEL_PROXY_UPSTREAM_TIMEOUT_MS, 10000);
  const compressorRegistry = options.compressorRegistry ?? createDefaultCompressorRegistry();
  const metricsStore = createMetricsStore(workspaceRoot);

  const server = createServer((req, res) => {
    void handleRequest(req, res, { workspaceRoot, upstreamBaseUrl, upstreamProvider, upstreamApiVersion, upstreamOrganization, upstreamApiKey, upstreamTimeoutMs, compressorRegistry, metricsStore });
  });
  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('model proxy did not bind to a TCP port');
  return {
    server,
    url: `http://${host}:${address.port}`,
    metricsStore,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  context: Required<Pick<ModelProxyServerOptions, 'upstreamBaseUrl' | 'compressorRegistry'>> & {
    workspaceRoot: string;
    upstreamProvider: 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference';
    upstreamApiVersion: string;
    upstreamOrganization?: string;
    upstreamApiKey?: string;
    upstreamTimeoutMs: number;
    metricsStore: ModelProxyMetricsStore;
  }
): Promise<void> {
  const route = req.url?.split('?')[0] ?? '/';
  const clientAbort = createClientAbortController(req);
  try {
    if (req.method === 'GET' && route === '/healthz') {
      await context.metricsStore.recordRequest(route);
      sendJson(res, 200, { ok: true, service: '@utk/model-proxy' });
      return;
    }
    if (req.method === 'GET' && route === '/metrics') {
      sendJson(res, 200, await context.metricsStore.snapshot());
      return;
    }
    if (req.method === 'GET' && route === '/v1/models') {
      await context.metricsStore.recordRequest(route);
      const upstream = await fetchModelsWithTimeout(context, route, clientAbort.signal);
      await pipeFetchResponse(upstream, res);
      return;
    }
    if (req.method === 'POST' && route === '/v1/utk/expand_context') {
      await context.metricsStore.recordRequest(route);
      const body = JSON.parse(await readBody(req)) as { id?: string; range?: string; query?: string; blockId?: string; handle?: { artifactId?: string } };
      const id = body.id ?? body.handle?.artifactId;
      if (typeof id !== 'string') {
        sendJson(res, 400, { error: 'id or handle.artifactId required' });
        return;
      }
      await context.metricsStore.recordPolicy({ route, routeReason: 'recovery-tool', rawTokens: 0, compactTokens: 0, recoveryExpansions: 1 });
      sendJson(res, 200, await expandContextArtifact(context.workspaceRoot, id, { range: body.range, query: body.query, blockId: body.blockId, handle: body.handle }));
      return;
    }
    if (req.method === 'POST' && route === '/v1/utk/find_tool') {
      await context.metricsStore.recordRequest(route);
      const body = JSON.parse(await readBody(req)) as { catalogId?: string; query?: string; intent?: string; requiredToolNames?: string[] };
      if (typeof body.catalogId !== 'string' || typeof body.query !== 'string') {
        sendJson(res, 400, { error: 'catalogId and query required' });
        return;
      }
      await context.metricsStore.recordPolicy({ route, routeReason: 'tool-discovery', rawTokens: 0, compactTokens: 0 });
      sendJson(res, 200, await findToolDefinition(context.workspaceRoot, body.catalogId, body.query, body.intent, body.requiredToolNames));
      return;
    }
    if (req.method === 'POST' && route === '/v1/utk/proof') {
      await context.metricsStore.recordRequest(route);
      const body = JSON.parse(await readBody(req)) as { id?: string; artifactId?: string; compactText?: string; requiredFacts?: string[] };
      const id = body.artifactId ?? body.id;
      if (typeof id !== 'string') {
        sendJson(res, 400, { error: 'id or artifactId required' });
        return;
      }
      await context.metricsStore.recordPolicy({ route, routeReason: 'context-proof', rawTokens: 0, compactTokens: 0 });
      sendJson(res, 200, await createContextProof(context.workspaceRoot, id, body.compactText, body.requiredFacts));
      return;
    }
    if (req.method === 'POST' && (route === '/v1/chat/completions' || route === '/v1/responses')) {
      const body = JSON.parse(await readBody(req)) as Record<string, any>;
      await context.metricsStore.recordRequest(route, Boolean(body.stream));
      const upstream = await proxyOpenAiRequest(route, body, {
        workspaceRoot: context.workspaceRoot,
        upstreamBaseUrl: context.upstreamBaseUrl,
        upstreamProvider: context.upstreamProvider,
        upstreamApiVersion: context.upstreamApiVersion,
        upstreamOrganization: context.upstreamOrganization,
        upstreamApiKey: context.upstreamApiKey,
        compressorRegistry: context.compressorRegistry,
        metricsStore: context.metricsStore,
        sessionId: deriveSessionId(req, body),
        signal: clientAbort.signal
      });
      await pipeFetchResponse(upstream, res);
      return;
    }
    sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    if (clientAbort.signal.aborted || isClientClosedRequestError(error)) {
      if (!res.writableEnded) res.destroy();
      return;
    }
    if (res.headersSent || res.writableEnded) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    if (isPayloadTooLargeError(error)) {
      sendJson(res, 413, { error: 'Payload too large' });
      return;
    }
    if (isAbortError(error)) {
      sendJson(res, 504, { error: 'Upstream request timed out' });
      return;
    }
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    sendJson(res, 500, { error: 'Internal server error' });
  } finally {
    clientAbort.cleanup();
  }
}

async function fetchModelsWithTimeout(
  context: {
    upstreamBaseUrl: string;
    upstreamProvider: 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference';
    upstreamApiVersion: string;
    upstreamOrganization?: string;
    upstreamApiKey?: string;
    upstreamTimeoutMs: number;
  },
  route: string,
  clientSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const unlinkClientSignal = linkAbortSignal(clientSignal, controller);
  const timeout = setTimeout(() => controller.abort(), context.upstreamTimeoutMs);
  try {
    return await fetch(joinUpstreamUrl(context.upstreamBaseUrl, route, {
      provider: context.upstreamProvider,
      apiVersion: context.upstreamApiVersion,
      organization: context.upstreamOrganization
    }), {
      signal: controller.signal,
      headers: upstreamHeaders(context.upstreamProvider, {
        upstreamApiKey: context.upstreamApiKey,
        upstreamApiVersion: context.upstreamApiVersion
      })
    });
  } finally {
    clearTimeout(timeout);
    unlinkClientSignal();
  }
}

function createClientAbortController(req: IncomingMessage): { signal: AbortSignal; cleanup(): void } {
  const controller = new AbortController();
  const abort = (): void => {
    if (!req.complete && !controller.signal.aborted) controller.abort(new ClientClosedRequestError());
  };
  req.once('aborted', abort);
  req.once('close', abort);
  return {
    signal: controller.signal,
    cleanup() {
      req.off('aborted', abort);
      req.off('close', abort);
    }
  };
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

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

function readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const cleanup = (): void => {
      req.off('data', onData);
      req.off('error', onError);
      req.off('end', onEnd);
      req.off('close', onClose);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      req.resume();
      reject(error);
    };
    const onData = (chunk: Buffer | string): void => {
      const buffer = Buffer.from(chunk);
      total += buffer.byteLength;
      if (total > maxBytes) {
        fail(new PayloadTooLargeError(maxBytes));
        return;
      }
      chunks.push(buffer);
    };
    const onError = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onEnd = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    const onClose = (): void => {
      if (!req.complete) fail(new ClientClosedRequestError());
    };
    req.on('data', onData);
    req.on('error', onError);
    req.on('end', onEnd);
    req.on('close', onClose);
  });
}

class PayloadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = 'PayloadTooLargeError';
  }
}

class ClientClosedRequestError extends Error {
  constructor() {
    super('Request closed before body completed');
    this.name = 'ClientClosedRequestError';
  }
}

function isPayloadTooLargeError(error: unknown): boolean {
  return error instanceof PayloadTooLargeError || error instanceof Error && error.name === 'PayloadTooLargeError';
}

function isClientClosedRequestError(error: unknown): boolean {
  return error instanceof ClientClosedRequestError || error instanceof Error && error.name === 'ClientClosedRequestError';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function readPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readUpstreamProvider(value: string | undefined): 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference' {
  return value === 'openai' || value === 'github-models' || value === 'azure-openai' || value === 'azure-ai-inference' ? value : 'github-models';
}

function defaultUpstreamBaseUrl(provider: 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference'): string {
  if (provider === 'github-models') return 'https://models.github.ai/inference';
  if (provider === 'azure-ai-inference') return 'https://<resource>.services.ai.azure.com/models';
  if (provider === 'azure-openai') return 'https://<resource>.openai.azure.com/openai/v1';
  return 'https://api.openai.com/v1';
}

function defaultUpstreamApiVersion(provider: 'openai' | 'github-models' | 'azure-openai' | 'azure-ai-inference'): string {
  if (provider === 'github-models') return '2026-03-10';
  if (provider === 'azure-ai-inference') return '2024-05-01-preview';
  return '';
}

async function createContextProof(workspaceRoot: string, id: string, compactText: string | undefined, requiredFacts: string[] = []): Promise<unknown> {
  const core = await import('@utk/core') as any;
  if (compactText !== undefined) return core.createContextProof({ workspaceRoot, artifactId: id, compactText, requiredFacts });
  return core.verifyContextProof({ workspaceRoot, artifactId: id, requiredFacts });
}

async function findToolDefinition(workspaceRoot: string, catalogId: string, query: string, intent?: string, requiredToolNames?: string[]): Promise<unknown> {
  const core = await import('@utk/core') as any;
  return core.findToolDefinition(workspaceRoot, { catalogId, query, intent, requiredToolNames });
}

function deriveSessionId(req: IncomingMessage, body: Record<string, any>): string | undefined {
  const header = req.headers['x-utk-session-id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (Array.isArray(header) && typeof header[0] === 'string') return header[0];
  return body.metadata && typeof body.metadata.utk_session_id === 'string' ? body.metadata.utk_session_id : undefined;
}

/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  const proxy = await createModelProxyServer();
  process.stderr.write(`utk-model-proxy listening on ${proxy.url}\n`);
  const close = async (): Promise<void> => {
    await proxy.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
}
/* c8 ignore stop */
