/* c8 ignore file -- exercised through server integration tests. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  createContextProof as createCoreContextProof,
  findToolDefinition as findCoreToolDefinition,
  verifyContextProof,
  type ArtifactHandle
} from '@utk/core';
import { readJsonObjectBody, sendJson } from './httpJson.js';
import type { ModelProxyMetricsStore } from './metrics.js';
import { isObject } from './openai.js';
import { expandContextArtifact } from './recovery.js';

export type LocalRouteContext = {
  workspaceRoot: string;
  metricsStore: ModelProxyMetricsStore;
};

export async function handleLocalRoute(
  req: IncomingMessage,
  res: ServerResponse,
  route: string,
  context: LocalRouteContext
): Promise<boolean> {
  if (req.method === 'GET' && route === '/healthz') {
    await context.metricsStore.recordRequest(route);
    sendJson(res, 200, { ok: true, service: '@utk/model-proxy' });
    return true;
  }
  if (req.method === 'GET' && route === '/metrics') {
    sendJson(res, 200, await context.metricsStore.snapshot());
    return true;
  }
  if (req.method !== 'POST') return false;
  if (route === '/v1/utk/expand_context') {
    await handleExpandContext(req, res, route, context);
    return true;
  }
  if (route === '/v1/utk/find_tool') {
    await handleFindTool(req, res, route, context);
    return true;
  }
  if (route === '/v1/utk/proof') {
    await handleContextProof(req, res, route, context);
    return true;
  }
  return false;
}

async function handleExpandContext(req: IncomingMessage, res: ServerResponse, route: string, context: LocalRouteContext): Promise<void> {
  await context.metricsStore.recordRequest(route);
  const body = await readJsonObjectBody(req);
  const handle = readArtifactHandle(body.handle);
  const id = readString(body.id) ?? handle?.artifactId;
  if (typeof id !== 'string') {
    sendJson(res, 400, { error: 'id or handle.artifactId required' });
    return;
  }
  await context.metricsStore.recordPolicy({ route, routeReason: 'recovery-tool', rawTokens: 0, compactTokens: 0, recoveryExpansions: 1 });
  sendJson(res, 200, await expandContextArtifact(context.workspaceRoot, id, {
    range: readString(body.range),
    query: readString(body.query),
    blockId: readString(body.blockId),
    handle
  }));
}

async function handleFindTool(req: IncomingMessage, res: ServerResponse, route: string, context: LocalRouteContext): Promise<void> {
  await context.metricsStore.recordRequest(route);
  const body = await readJsonObjectBody(req);
  const catalogId = readString(body.catalogId);
  const query = readString(body.query);
  if (!catalogId || !query) {
    sendJson(res, 400, { error: 'catalogId and query required' });
    return;
  }
  await context.metricsStore.recordPolicy({ route, routeReason: 'tool-discovery', rawTokens: 0, compactTokens: 0 });
  sendJson(res, 200, await findToolDefinition(context.workspaceRoot, catalogId, query, readString(body.intent), readStringArray(body.requiredToolNames)));
}

async function handleContextProof(req: IncomingMessage, res: ServerResponse, route: string, context: LocalRouteContext): Promise<void> {
  await context.metricsStore.recordRequest(route);
  const body = await readJsonObjectBody(req);
  const id = readString(body.artifactId) ?? readString(body.id);
  if (typeof id !== 'string') {
    sendJson(res, 400, { error: 'id or artifactId required' });
    return;
  }
  await context.metricsStore.recordPolicy({ route, routeReason: 'context-proof', rawTokens: 0, compactTokens: 0 });
  sendJson(res, 200, await createContextProof(context.workspaceRoot, id, readString(body.compactText), readStringArray(body.requiredFacts)));
}

async function createContextProof(workspaceRoot: string, id: string, compactText: string | undefined, requiredFacts: string[] = []): Promise<unknown> {
  if (compactText !== undefined) return createCoreContextProof({ workspaceRoot, artifactId: id, compactText, requiredFacts });
  return verifyContextProof({ workspaceRoot, artifactId: id, requiredFacts });
}

async function findToolDefinition(workspaceRoot: string, catalogId: string, query: string, intent?: string, requiredToolNames?: string[]): Promise<unknown> {
  return findCoreToolDefinition(workspaceRoot, { catalogId, query, intent, requiredToolNames });
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? [...value] : undefined;
}

function readArtifactHandle(value: unknown): ArtifactHandle | undefined {
  if (!isObject(value) || typeof value.artifactId !== 'string') return undefined;
  return {
    artifactId: value.artifactId,
    routeId: readString(value.routeId),
    schemaId: readString(value.schemaId),
    relativePath: readString(value.relativePath),
    range: readString(value.range),
    snippet: readString(value.snippet)
  };
}
