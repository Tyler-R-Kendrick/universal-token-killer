import type { ModelProxyPolicy } from '@utk/core';
import type { JsonObject } from './openai.js';
import type { ModelProxyMetricsStore } from './metrics.js';
import { minimizeToolSchemas } from './toolSchema.js';
import { applyToolDiscoveryToRequest } from './toolDiscoveryGateway.js';
import type { TokenDelta, ToolDiscoveryPolicyResult } from './contextPolicyState.js';

export function applyToolSchemaPolicy(request: JsonObject, policy: ModelProxyPolicy): TokenDelta {
  if (policy.minimize_tool_schemas && Array.isArray(request.tools)) {
    const minimized = minimizeToolSchemas(request.tools, policy.inject_expand_context);
    request.tools = minimized.tools;
    return { beforeTokens: minimized.beforeTokens, afterTokens: minimized.afterTokens };
  }
  if (policy.inject_expand_context) {
    const minimized = minimizeToolSchemas(request.tools ?? [], true);
    request.tools = minimized.tools;
    return { beforeTokens: minimized.beforeTokens, afterTokens: minimized.afterTokens };
  }
  return { beforeTokens: 0, afterTokens: 0 };
}

export async function applyToolDiscoveryPolicy(
  workspaceRoot: string,
  request: JsonObject,
  query: string,
  policy: ModelProxyPolicy
): Promise<ToolDiscoveryPolicyResult> {
  if (!Array.isArray(request.tools) || policy.tool_discovery_mode === 'off') {
    return { beforeTokens: 0, afterTokens: 0 };
  }
  const discovered = await applyToolDiscoveryToRequest({
    workspaceRoot,
    request,
    query,
    mode: policy.tool_discovery_mode,
    injectExpandContext: policy.inject_expand_context,
    deferredEnabled: policy.deferred_tool_search_enabled,
    requiredToolNames: policy.inject_expand_context ? ['utk_expand_context'] : []
  });
  request.tools = discovered.tools;
  return {
    beforeTokens: discovered.beforeTokens,
    afterTokens: discovered.afterTokens,
    routeReason: discovered.tokensSaved > 0 ? discovered.routeReason : undefined
  };
}

export async function recordRetentionMetrics(
  route: string,
  metricsStore: ModelProxyMetricsStore,
  routeReasons: Set<string>,
  retention: { dedupedCount: number; staleErrorCount: number }
): Promise<void> {
  if (retention.dedupedCount > 0) {
    routeReasons.add('dedupe');
    await metricsStore.recordPolicy({ route, routeReason: 'dedupe', rawTokens: 0, compactTokens: 0, dedupeCount: retention.dedupedCount });
  }
  if (retention.staleErrorCount > 0) {
    routeReasons.add('stale-error');
    await metricsStore.recordPolicy({ route, routeReason: 'stale-error', rawTokens: 0, compactTokens: 0, staleErrorCount: retention.staleErrorCount });
  }
}
