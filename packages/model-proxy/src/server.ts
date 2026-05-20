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
  const compressorRegistry = options.compressorRegistry ?? createDefaultCompressorRegistry();
  const metricsStore = createMetricsStore(workspaceRoot);

  const server = createServer((req, res) => {
    void handleRequest(req, res, { workspaceRoot, upstreamBaseUrl, upstreamProvider, upstreamApiVersion, upstreamOrganization, upstreamApiKey, compressorRegistry, metricsStore });
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
    metricsStore: ModelProxyMetricsStore;
  }
): Promise<void> {
  const route = req.url?.split('?')[0] ?? '/';
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
      const upstream = await fetch(joinUpstreamUrl(context.upstreamBaseUrl, route, {
        provider: context.upstreamProvider,
        apiVersion: context.upstreamApiVersion,
        organization: context.upstreamOrganization
      }), {
        headers: upstreamHeaders(context.upstreamProvider, {
          upstreamApiKey: context.upstreamApiKey,
          upstreamApiVersion: context.upstreamApiVersion
        })
      });
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
        sessionId: deriveSessionId(req, body)
      });
      await pipeFetchResponse(upstream, res);
      return;
    }
    sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
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
