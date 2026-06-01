import {
  matchToolInvocation,
  mediateToolExecution,
  type LocalToolEmbeddingProvider,
  type LocalToolEmbeddingProviderAdapterEntry,
  type ToolInvocationMatch
} from '@utk/core';
import type { ModelProxyMetricsStore } from './metrics.js';
import { findLastUserText, isObject, jsonResponse, type JsonObject } from './openai.js';
import { toolBypassRouteAdapter, toolCallShape, type ToolBypassRouteAdapter } from './toolBypassRoutes.js';

export type LocalToolExecutionCall = {
  route: string;
  request: string;
  toolName: string;
  args: Record<string, unknown>;
  tool: Record<string, unknown>;
  reason: string;
};

export type LocalToolExecutor = (call: LocalToolExecutionCall) => Promise<unknown>;

export type ToolBypassOptions = {
  workspaceRoot: string;
  metricsStore?: ModelProxyMetricsStore;
  toolEmbeddingProvider?: LocalToolEmbeddingProvider;
  toolEmbeddingProviders?: LocalToolEmbeddingProvider[];
  toolEmbeddingProviderAdapters?: readonly LocalToolEmbeddingProviderAdapterEntry[];
  toolExecutor?: LocalToolExecutor;
  mediateLocalToolResults?: boolean;
  continueRequest(route: string, body: JsonObject): Promise<Response>;
};

type ToolMatch = Extract<ToolInvocationMatch, { kind: 'match' }>;

export async function maybeBypassToolCall(route: string, body: JsonObject, options: ToolBypassOptions): Promise<Response | undefined> {
  if (body.stream) return undefined;
  const adapter = toolBypassRouteAdapter(route);
  if (!adapter) return undefined;
  if (isObject(body.metadata) && body.metadata.utk_tool_bypass_executed === true) return undefined;
  const request = findLastUserText(route, body);
  if (!request) return undefined;

  const result = await matchToolInvocation({
    workspaceRoot: options.workspaceRoot,
    request,
    tools: Array.isArray(body.tools) ? body.tools : undefined,
    embeddingProvider: options.toolEmbeddingProvider,
    embeddingProviders: options.toolEmbeddingProviders,
    embeddingProviderAdapters: options.toolEmbeddingProviderAdapters
  });

  if (result.kind === 'match') {
    if (options.toolExecutor) return executeLocalToolAndForward(route, body, adapter, options, options.toolExecutor, request, result);
    await recordBypassMetrics(route, options.metricsStore, result);
    return jsonResponse(adapter.toolCallResponse(body, toolCallShape(result.toolName, result.args)), 200);
  }

  if (result.kind === 'clarify') {
    await options.metricsStore?.recordPolicy({ route, routeReason: result.metricReason, rawTokens: 0, compactTokens: 0, toolBypassFallbackCount: 1 });
    return jsonResponse(adapter.clarificationResponse(body, result.message), 200);
  }

  await recordMissMetrics(route, options.metricsStore, result);
  return undefined;
}

async function executeLocalToolAndForward(
  route: string,
  body: JsonObject,
  adapter: ToolBypassRouteAdapter,
  options: ToolBypassOptions,
  executor: LocalToolExecutor,
  request: string,
  match: ToolMatch
): Promise<Response> {
  const shape = toolCallShape(match.toolName, match.args);
  await recordBypassMetrics(route, options.metricsStore, match);
  let output: unknown;
  try {
    output = await executor({
      route,
      request,
      toolName: match.toolName,
      args: match.args,
      tool: match.tool,
      reason: match.reason
    });
  } catch (error) {
    await options.metricsStore?.recordPolicy({ route, routeReason: 'tool-bypass-local-execution-error', rawTokens: 0, compactTokens: 0, toolLocalExecutionErrorCount: 1 });
    throw error;
  }
  const content = await localToolResultContent(options.workspaceRoot, match.toolName, match.args, output, options.mediateLocalToolResults !== false);
  await options.metricsStore?.recordPolicy({ route, routeReason: 'tool-bypass-local-execution', rawTokens: 0, compactTokens: 0, toolLocalExecutionCount: 1 });
  return options.continueRequest(route, adapter.appendLocalExecution(body, shape, content));
}

async function recordBypassMetrics(route: string, metricsStore: ModelProxyMetricsStore | undefined, match: ToolMatch): Promise<void> {
  await metricsStore?.recordPolicy({
    route,
    routeReason: 'tool-bypass',
    rawTokens: 0,
    compactTokens: 0,
    toolBypassCount: 1,
    toolEmbeddingMatchCount: match.reason === 'embedding' ? 1 : 0
  });
  await metricsStore?.recordPolicy({ route, routeReason: match.metricReason, rawTokens: 0, compactTokens: 0 });
}

async function recordMissMetrics(route: string, metricsStore: ModelProxyMetricsStore | undefined, result: ToolInvocationMatch): Promise<void> {
  if (result.kind !== 'miss') return;
  if (result.reason === 'ambiguous') {
    await metricsStore?.recordPolicy({ route, routeReason: result.metricReason, rawTokens: 0, compactTokens: 0, toolBypassAmbiguousCount: 1, toolBypassFallbackCount: 1 });
    return;
  }
  if (result.reason === 'denied-tool' || result.reason === 'protected-tool') {
    await metricsStore?.recordPolicy({ route, routeReason: result.metricReason, rawTokens: 0, compactTokens: 0, toolBypassFallbackCount: 1 });
  }
}

async function localToolResultContent(workspaceRoot: string, toolName: string, args: Record<string, unknown>, output: unknown, mediate: boolean): Promise<string> {
  if (!mediate) return stringifyToolOutput(output);
  const result = await mediateToolExecution({
    workspaceRoot,
    toolId: toolName,
    input: args,
    execute: async () => output
  });
  return String(result.response);
}

function stringifyToolOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  const json = JSON.stringify(output);
  return json === undefined ? String(output) : json;
}
