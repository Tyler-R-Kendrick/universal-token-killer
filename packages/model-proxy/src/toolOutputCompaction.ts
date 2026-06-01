/* c8 ignore file -- covered through model-proxy policy integration tests. */
import {
  compactHistoryForRequest,
  createSessionContextLedger,
  type DedupePolicy,
  type StaleErrorPolicy,
  type SessionBlock
} from '@utk/core';
import { shouldCompactContent } from './contentRouter.js';
import { isObject, type JsonObject } from './openai.js';
import { type ContextArtifact } from './recovery.js';
import type { ModelProxyMetricsStore } from './metrics.js';
import {
  chatEventSource,
  isToolLikeMessage,
  responseEventSource,
  type ToolOutputEventSource
} from './toolOutputEventSources.js';
import { compactToolText, type CompactedToolText } from './toolOutputTextCompaction.js';

export type ToolOutputCompactionResult = {
  artifacts: ContextArtifact[];
  rawContents: string[];
  eventSources: ToolOutputEventSource[];
  rawTokens: number;
  compactTokens: number;
  routeReasons: string[];
};

export type { ToolOutputEventSource } from './toolOutputEventSources.js';

export type ToolOutputCompactionOptions = {
  workspaceRoot: string;
  route: string;
  query: string;
  minTokens: number;
  metricsStore: ModelProxyMetricsStore;
};

export async function compactChatToolMessages(messages: JsonObject[], options: ToolOutputCompactionOptions): Promise<ToolOutputCompactionResult> {
  const result = emptyCompactionResult();
  for (const message of messages) {
    if (!isObject(message)) continue;
    const content = typeof message.content === 'string' ? message.content : undefined;
    if (!content || !isToolLikeMessage(message) || !shouldCompactContent(content, options.minTokens)) continue;
    const source = chatEventSource(message, content, result.eventSources.length + 1);
    const compacted = await compactToolText(options.workspaceRoot, content, options.query);
    message.content = compacted.text;
    await collectCompaction(result, compacted, content, source, options);
  }
  return result;
}

export async function compactResponseToolOutputs(request: JsonObject, options: ToolOutputCompactionOptions): Promise<ToolOutputCompactionResult> {
  const result = emptyCompactionResult();
  const items = Array.isArray(request.input) ? request.input : [];
  for (const item of items) {
    if (!isObject(item) || item.type !== 'function_call_output' || typeof item.output !== 'string') continue;
    if (!shouldCompactContent(item.output, options.minTokens)) continue;
    const rawOutput = item.output;
    const source = responseEventSource(item, rawOutput, result.eventSources.length + 1);
    const compacted = await compactToolText(options.workspaceRoot, item.output, options.query);
    item.output = compacted.text;
    await collectCompaction(result, compacted, rawOutput, source, options);
  }
  return result;
}

export async function replaceHistoryWithSessionBlock(params: {
  workspaceRoot: string;
  sessionId: string;
  messages: JsonObject[];
  artifacts: ContextArtifact[];
  rawContents: string[];
  eventSources?: ToolOutputEventSource[];
  reserveOutputTokens: number;
  mode: 'summary-block' | 'replace-with-summary-block';
  dedupePolicy?: DedupePolicy;
  staleErrorPolicy?: StaleErrorPolicy;
  purgeErrorAfterTurns?: number;
  protectedToolNames?: string[];
}): Promise<{ messages: JsonObject[]; blocks: SessionBlock[]; dedupedCount: number; staleErrorCount: number }> {
  const ledger = createSessionContextLedger({ workspaceRoot: params.workspaceRoot, sessionId: params.sessionId });
  const events = [];
  for (let index = 0; index < params.artifacts.length; index += 1) {
    const artifact = params.artifacts[index]!;
    const source = params.eventSources?.[index];
    events.push(await ledger.recordToolEvent({
      turn: source?.turn ?? index + 1,
      role: source?.role ?? 'tool',
      toolName: source?.toolName ?? artifact.kind,
      input: source?.input ?? { artifactId: artifact.id },
      content: params.rawContents[index] ?? '',
      rawTokens: artifact.rawTokens,
      compactTokens: artifact.compactTokens,
      artifactId: artifact.id,
      artifactPath: artifact.path,
      routeId: artifact.kind,
      schemaId: `${artifact.kind}.v1`,
      decision: 'tool-output',
      status: source?.status ?? 'ok'
    }));
  }
  const retention = ledger.applyRetentionPolicy(events, {
    currentTurn: events.length + 1,
    dedupePolicy: params.dedupePolicy,
    staleErrorPolicy: params.staleErrorPolicy,
    purgeErrorAfterTurns: params.purgeErrorAfterTurns,
    protectedToolNames: params.protectedToolNames
  });
  const blockEvents = params.dedupePolicy === 'compact' || params.staleErrorPolicy === 'compact'
    ? retention.retained
    : events;
  if (blockEvents.length === 0) return { messages: params.messages, blocks: [], dedupedCount: retention.deduped.length, staleErrorCount: retention.purgedErrors.length };
  const compacted = await compactHistoryForRequest({
    workspaceRoot: params.workspaceRoot,
    sessionId: params.sessionId,
    messages: params.messages,
    events: blockEvents,
    budget: { shouldCompactHistory: true, reservedOutputTokens: params.reserveOutputTokens },
    mode: params.mode
  });
  return {
    ...compacted,
    dedupedCount: retention.deduped.length,
    staleErrorCount: retention.purgedErrors.length
  };
}

async function collectCompaction(
  result: ToolOutputCompactionResult,
  compacted: CompactedToolText,
  rawContent: string,
  source: ToolOutputEventSource,
  options: ToolOutputCompactionOptions
): Promise<void> {
  result.artifacts.push(compacted.artifact);
  result.rawContents.push(rawContent);
  result.eventSources.push(source);
  result.rawTokens += compacted.artifact.rawTokens;
  result.compactTokens += compacted.artifact.compactTokens;
  result.routeReasons.push(compacted.routeReason);
  await options.metricsStore.recordPolicy({
    route: options.route,
    routeReason: compacted.routeReason,
    rawTokens: compacted.artifact.rawTokens,
    compactTokens: compacted.artifact.compactTokens,
    artifactId: compacted.artifact.id
  });
}

function emptyCompactionResult(): ToolOutputCompactionResult {
  return { artifacts: [], rawContents: [], eventSources: [], rawTokens: 0, compactTokens: 0, routeReasons: [] };
}
