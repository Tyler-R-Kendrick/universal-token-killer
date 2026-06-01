import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CompressorRegistry } from './contextGateway.js';
import {
  ClientClosedRequestError,
  isBadRequestBodyError,
  isPayloadTooLargeError,
  sendJson
} from './httpJson.js';
import type { ModelProxyMetricsStore } from './metrics.js';
import type { LocalToolExecutor } from './proxy.js';
import { handleLocalRoute } from './serverLocalRoutes.js';
import { handleUpstreamRoute } from './serverUpstreamRoutes.js';
import type {
  UpstreamProvider,
  UpstreamProviderAdapter,
  UpstreamProviderOptions
} from './upstreamProvider.js';

export type ModelProxyRequestContext = {
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

export async function handleModelProxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  context: ModelProxyRequestContext
): Promise<void> {
  const route = req.url?.split('?')[0] ?? '/';
  const clientAbort = createClientAbortController(req, res);
  try {
    if (await handleLocalRoute(req, res, route, context)) return;
    if (await handleUpstreamRoute(req, res, route, context, clientAbort.signal)) return;
    sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    handleRequestError(error, res, clientAbort.signal);
  } finally {
    clientAbort.cleanup();
  }
}

function handleRequestError(error: unknown, res: ServerResponse, clientSignal: AbortSignal): void {
  if (clientSignal.aborted || isClientClosedRequestError(error)) {
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
  if (isBadRequestBodyError(error)) {
    sendJson(res, 400, { error: error.message });
    return;
  }
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  sendJson(res, 500, { error: 'Internal server error' });
}

function createClientAbortController(req: IncomingMessage, res: ServerResponse): { signal: AbortSignal; cleanup(): void } {
  const controller = new AbortController();
  const abort = (): void => {
    if (!res.writableEnded && !controller.signal.aborted) controller.abort(new ClientClosedRequestError());
  };
  req.once('aborted', abort);
  res.once('close', abort);
  return {
    signal: controller.signal,
    cleanup() {
      req.off('aborted', abort);
      res.off('close', abort);
    }
  };
}

function isClientClosedRequestError(error: unknown): boolean {
  return error instanceof ClientClosedRequestError || error instanceof Error && error.name === 'ClientClosedRequestError';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
