/* c8 ignore file -- Context gateway fail-open branches are covered through integration behavior tests. */
import {
  resolveModelProxyPolicy,
  type ModelProxyPolicy
} from '@utk/core';
import { expandEditRangesInRequest } from './editRanges.js';
import { cloneJson, normalizeOpenAiRequest, type JsonObject } from './openai.js';
import type { ContextArtifact } from './recovery.js';
import { createMetricsStore, type ModelProxyMetricsStore } from './metrics.js';
import type { UpstreamProviderAdapter, UpstreamProviderOptions } from './upstreamProvider.js';
import {
  compactChatToolMessages,
  compactResponseToolOutputs,
  replaceHistoryWithSessionBlock
} from './toolOutputCompaction.js';
import { deriveSessionId, evaluateBudget, findLastUserQuery } from './contextPolicyRequest.js';
import {
  createPolicyState,
  mergePromptSurfacePolicy,
  mergeToolCompaction,
  mergeToolDiscovery,
  mergeToolSchemaMetrics,
  policyStateMetrics,
  shouldRecordSurfaceMetrics,
  surfaceMetricsRouteReason,
  type PolicyStateMetrics
} from './contextPolicyState.js';
import type { CompressorRegistry } from './compressorRegistry.js';
import { applyChatPromptSurfacePolicy, applyResponsesPromptSurfacePolicy } from './contextPromptPolicy.js';
import { applyToolDiscoveryPolicy, applyToolSchemaPolicy, recordRetentionMetrics } from './contextToolPolicy.js';

export { createDefaultCompressorRegistry } from './compressorRegistry.js';
export type { CompressionProvider, CompressorRegistry, TextCompressorProvider } from './compressorRegistry.js';

export type ModelProxyPolicyContext = {
  route: string;
  workspaceRoot: string;
  sessionId?: string;
  policyOverrides?: Partial<ModelProxyPolicy>;
  compressorRegistry?: CompressorRegistry;
  metricsStore?: ModelProxyMetricsStore;
  promptCompressionProviderAdapters?: readonly UpstreamProviderAdapter[];
  promptCompressionProviderOptions?: UpstreamProviderOptions;
};

export type AppliedModelProxyPolicy = {
  request: JsonObject;
  policy: ModelProxyPolicy;
  metrics: PolicyStateMetrics;
  artifacts: ContextArtifact[];
  promptArtifacts: Array<{ id: string; path: string; surface: string }>;
};

export async function applyModelProxyPolicy(body: JsonObject, context: ModelProxyPolicyContext): Promise<AppliedModelProxyPolicy> {
  const policy = await resolvePolicy(context.workspaceRoot, context.policyOverrides);
  const minTokens = policy.compression_level === 'off' ? Number.MAX_SAFE_INTEGER : policy.min_tokens;
  const normalized = normalizeOpenAiRequest(context.route, body);
  const metricsStore = context.metricsStore ?? createMetricsStore(context.workspaceRoot);
  const sessionId = context.sessionId ?? deriveSessionId(body);
  let request = cloneJson(normalized.body);
  const state = createPolicyState();
  const query = findLastUserQuery(normalized);
  const budget = evaluateBudget(request, policy.reserve_output_tokens, policy.history_compaction_threshold, policy.history_compaction_enabled);
  if (budget.shouldCompactHistory) state.routeReasons.add('history-summary');

  if (policy.expand_edit_ranges && normalized.kind === 'chat') {
    request = await expandEditRangesInRequest(request, { workspaceRoot: context.workspaceRoot, enabled: true });
  }

  if (normalized.kind === 'chat') {
    const messages = Array.isArray(request.messages) ? request.messages : [];
    mergePromptSurfacePolicy(state, await applyChatPromptSurfacePolicy(messages, context, policy));
    const toolCompaction = await compactChatToolMessages(messages, {
      workspaceRoot: context.workspaceRoot,
      route: context.route,
      query,
      minTokens,
      metricsStore
    });
    mergeToolCompaction(state, toolCompaction);
    if (budget.shouldCompactHistory && state.artifacts.length > 0 && policy.session_blocks_enabled) {
      const compactedHistory = await replaceHistoryWithSessionBlock({
        workspaceRoot: context.workspaceRoot,
        sessionId,
        messages,
        artifacts: state.artifacts,
        rawContents: state.artifactContents,
        eventSources: toolCompaction.eventSources,
        reserveOutputTokens: policy.reserve_output_tokens,
        mode: policy.history_compaction_mode,
        dedupePolicy: policy.dedupe_policy,
        staleErrorPolicy: policy.stale_error_policy,
        purgeErrorAfterTurns: policy.purge_error_after_turns,
        protectedToolNames: policy.protected_tools
      });
      const [block] = compactedHistory.blocks;
      if (block) {
        request.messages = compactedHistory.messages;
        state.routeReasons.add('session-block');
        await metricsStore.recordPolicy({
          route: context.route,
          routeReason: 'session-block',
          rawTokens: block.rawTokens,
          compactTokens: block.compactTokens,
          artifactId: block.artifactIds[0],
          sessionBlocks: compactedHistory.blocks.length
        });
      }
      await recordRetentionMetrics(context.route, metricsStore, state.routeReasons, compactedHistory);
    }
    mergeToolDiscovery(state, await applyToolDiscoveryPolicy(context.workspaceRoot, request, query, policy));
    mergeToolSchemaMetrics(state, applyToolSchemaPolicy(request, policy));
  } else {
    mergePromptSurfacePolicy(state, await applyResponsesPromptSurfacePolicy(request, context, policy));
    const toolCompaction = await compactResponseToolOutputs(request, {
      workspaceRoot: context.workspaceRoot,
      route: context.route,
      query,
      minTokens,
      metricsStore
    });
    mergeToolCompaction(state, toolCompaction);
    mergeToolDiscovery(state, await applyToolDiscoveryPolicy(context.workspaceRoot, request, query, policy));
  }

  if (shouldRecordSurfaceMetrics(state)) {
    await metricsStore.recordPolicy({
      route: context.route,
      routeReason: surfaceMetricsRouteReason(state),
      rawTokens: 0,
      compactTokens: 0,
      promptTokensBefore: state.promptTokensBefore,
      promptTokensAfter: state.promptTokensAfter,
      toolDiscoveryTokensBefore: state.toolDiscoveryTokensBefore,
      toolDiscoveryTokensAfter: state.toolDiscoveryTokensAfter,
      cacheVolatilityFindings: state.cacheVolatilityFindings
    });
  }

  return {
    request,
    policy,
    metrics: policyStateMetrics(state),
    artifacts: state.artifacts,
    promptArtifacts: state.promptArtifacts
  };
}

export function createPolicyMetricsStore(workspaceRoot: string): ModelProxyMetricsStore {
  return createMetricsStore(workspaceRoot);
}

async function resolvePolicy(workspaceRoot: string, overrides: Partial<ModelProxyPolicy> | undefined): Promise<ModelProxyPolicy> {
  return resolveModelProxyPolicy(workspaceRoot, process.env, overrides ?? {});
}
