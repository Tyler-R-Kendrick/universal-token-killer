import {
  detectCacheVolatility,
  type ModelProxyPolicy
} from '@utk/core';
import type { JsonObject } from './openai.js';
import {
  compressChatPromptMessagesWithModel,
  compressResponsesPromptSurfacesWithModel,
  type PromptCompressionPolicy
} from './promptCompression.js';
import { optimizeChatPromptMessages, optimizeResponsesPromptSurfaces } from './promptSurfaces.js';
import type { UpstreamProviderAdapter, UpstreamProviderOptions } from './upstreamProvider.js';
import type { PromptSurfacePolicyResult } from './contextPolicyState.js';

export type PromptPolicyContext = {
  workspaceRoot: string;
  promptCompressionProviderAdapters?: readonly UpstreamProviderAdapter[];
  promptCompressionProviderOptions?: UpstreamProviderOptions;
};

export async function applyChatPromptSurfacePolicy(
  messages: JsonObject[],
  context: PromptPolicyContext,
  policy: PromptCompressionPolicy
): Promise<PromptSurfacePolicyResult> {
  const promptOptimization = await optimizeChatPromptMessages(messages, context.workspaceRoot);
  const cacheVolatilityFindings = countCacheVolatility(messages.map((message) => typeof message.content === 'string' ? message.content : '').join('\n'));
  const promptCompression = await compressChatPromptMessagesWithModel(messages, policy, {
    providerAdapters: context.promptCompressionProviderAdapters,
    providerOptions: context.promptCompressionProviderOptions
  });
  return {
    before: promptOptimization.before + promptCompression.before,
    after: promptOptimization.after + promptCompression.after,
    applied: promptCompression.applied,
    cacheVolatilityFindings,
    artifacts: promptOptimization.artifacts
  };
}

export async function applyResponsesPromptSurfacePolicy(
  request: JsonObject,
  context: PromptPolicyContext,
  policy: ModelProxyPolicy
): Promise<PromptSurfacePolicyResult> {
  const promptOptimization = await optimizeResponsesPromptSurfaces(request, context.workspaceRoot);
  const cacheVolatilityFindings = countCacheVolatility(String(request.instructions ?? ''));
  const promptCompression = await compressResponsesPromptSurfacesWithModel(request, policy, {
    providerAdapters: context.promptCompressionProviderAdapters,
    providerOptions: context.promptCompressionProviderOptions
  });
  return {
    before: promptOptimization.before + promptCompression.before,
    after: promptOptimization.after + promptCompression.after,
    applied: promptCompression.applied,
    cacheVolatilityFindings,
    artifacts: promptOptimization.artifacts
  };
}

function countCacheVolatility(text: string): number {
  return detectCacheVolatility(text).findings.length;
}
