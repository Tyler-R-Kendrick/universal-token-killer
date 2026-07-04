import type { ModelProxyPolicy } from '@utk/core';
import { estimateTokens, isObject, type JsonObject } from './openai.js';
import {
  createUpstreamRequest,
  resolveUpstreamProviderAdapter,
  type UpstreamProviderAdapter,
  type UpstreamProviderOptions
} from './upstreamProvider.js';

export type PromptCompressionPolicy = ModelProxyPolicy & { prompt_compression_api_key?: unknown };

export type PromptCompressionStats = {
  before: number;
  after: number;
  applied: number;
};

export type PromptCompressionOptions = {
  providerAdapters?: readonly UpstreamProviderAdapter[];
  providerOptions?: UpstreamProviderOptions;
};

type PromptCompressionResult = {
  text: string;
  before: number;
  after: number;
  applied: boolean;
};

export async function compressChatPromptMessagesWithModel(messages: JsonObject[], policy: PromptCompressionPolicy, options: PromptCompressionOptions = {}): Promise<PromptCompressionStats> {
  let before = 0;
  let after = 0;
  let applied = 0;
  for (const message of messages) {
    if (!isPromptRole(message.role) || typeof message.content !== 'string') continue;
    const compressed = await compressPromptTextWithModel(message.content, String(message.role), policy, options);
    before += compressed.before;
    after += compressed.after;
    if (compressed.applied) {
      message.content = compressed.text;
      applied += 1;
    }
  }
  return { before, after, applied };
}

export async function compressResponsesPromptSurfacesWithModel(request: JsonObject, policy: PromptCompressionPolicy, options: PromptCompressionOptions = {}): Promise<PromptCompressionStats> {
  let before = 0;
  let after = 0;
  let applied = 0;
  if (typeof request.instructions === 'string') {
    const compressed = await compressPromptTextWithModel(request.instructions, 'instructions', policy, options);
    before += compressed.before;
    after += compressed.after;
    if (compressed.applied) {
      request.instructions = compressed.text;
      applied += 1;
    }
  }
  const items = Array.isArray(request.input) ? request.input : [];
  for (const item of items) {
    if (!isObject(item) || !isPromptRole(item.role) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (!isObject(part) || typeof part.text !== 'string') continue;
      const compressed = await compressPromptTextWithModel(part.text, String(item.role), policy, options);
      before += compressed.before;
      after += compressed.after;
      if (compressed.applied) {
        part.text = compressed.text;
        applied += 1;
      }
    }
  }
  return { before, after, applied };
}

async function compressPromptTextWithModel(text: string, role: string, policy: PromptCompressionPolicy, options: PromptCompressionOptions): Promise<PromptCompressionResult> {
  const before = estimateTokens(text);
  if (!policy.prompt_compression_enabled || policy.prompt_compression_provider === 'none' || before < Number(policy.prompt_compression_min_tokens ?? 64)) {
    return { text, before: 0, after: 0, applied: false };
  }
  const baseUrl = String(policy.prompt_compression_base_url ?? '');
  const apiKey = promptCompressionApiKey(policy);
  if (!apiKey && !isLoopbackUrl(baseUrl)) return { text, before: 0, after: 0, applied: false };
  const controller = new AbortController();
  const timeoutMs = readPositiveNumber(policy.prompt_compression_timeout_ms, 2500);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const request = promptCompressionRequest(policy, apiKey, options.providerAdapters, options.providerOptions);
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: String(policy.prompt_compression_model ?? 'openai/gpt-4.1'),
        messages: [
          {
            role: 'system',
            content: 'Compress this prompt for a downstream LLM. Preserve security instructions, exact paths, commands, code fences, JSON keys, numbers, IDs, and policy priority. Return only compressed prompt text.'
          },
          { role: 'user', content: `${role} prompt:\n${text}` }
        ],
        temperature: 0
      })
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      console.warn(`UTK model proxy prompt compression skipped: provider returned ${response.status} ${response.statusText}.`);
      return { text, before: 0, after: 0, applied: false };
    }
    const json = await response.json() as unknown;
    const compressed = readChatCompletionText(json).trim();
    if (!compressed || estimateTokens(compressed) > before) return { text, before, after: before, applied: false };
    return { text: compressed, before, after: estimateTokens(compressed), applied: true };
  } catch (error) {
    if (isAbortError(error)) {
      console.warn(`UTK model proxy prompt compression timed out after ${timeoutMs}ms; forwarding original prompt.`);
    }
    return { text, before: 0, after: 0, applied: false };
  } finally {
    clearTimeout(timeout);
  }
}

function readChatCompletionText(value: unknown): string {
  if (!isObject(value) || !Array.isArray(value.choices)) return '';
  const first = value.choices[0];
  if (!isObject(first) || !isObject(first.message) || typeof first.message.content !== 'string') return '';
  return first.message.content;
}

function isPromptRole(role: unknown): boolean {
  return role === 'system' || role === 'developer' || role === 'user';
}

function promptCompressionRequest(
  policy: ModelProxyPolicy,
  apiKey: string | undefined,
  providerAdapters: readonly UpstreamProviderAdapter[] | undefined,
  providerOptionsOverride: UpstreamProviderOptions | undefined
): { url: string; headers: Record<string, string> } {
  const provider = String(policy.prompt_compression_provider ?? 'github-models');
  const adapter = resolveUpstreamProviderAdapter(provider, providerAdapters);
  return createUpstreamRequest(adapter, {
    baseUrl: String(policy.prompt_compression_base_url ?? ''),
    route: '/v1/chat/completions',
    apiKey,
    apiVersion: promptCompressionApiVersion(policy, adapter),
    providerOptions: providerOptionsOverride ?? policy.provider_options[provider]
  });
}

function promptCompressionApiKey(policy: PromptCompressionPolicy): string | undefined {
  // Explicit policy configuration takes precedence over ambient environment credentials so a
  // configured compression key is never silently replaced by an unrelated env token (e.g. GITHUB_TOKEN).
  const explicit = typeof policy.prompt_compression_api_key === 'string' ? policy.prompt_compression_api_key : undefined;
  return explicit ??
    process.env.UTK_MODEL_PROXY_PROMPT_COMPRESSION_API_KEY ??
    process.env.UTK_MODEL_PROXY_UPSTREAM_API_KEY ??
    process.env.GITHUB_TOKEN ??
    process.env.GH_TOKEN ??
    process.env.OPENAI_API_KEY;
}

function isLoopbackUrl(value: string): boolean {
  return /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(value);
}

function promptCompressionApiVersion(policy: ModelProxyPolicy, adapter: UpstreamProviderAdapter): string {
  if (typeof policy.prompt_compression_api_version === 'string' && policy.prompt_compression_api_version.trim()) {
    return policy.prompt_compression_api_version;
  }
  const upstreamApiVersion = typeof policy.upstream_api_version === 'string' && policy.upstream_api_version
    ? policy.upstream_api_version
    : '';
  return adapter.defaults.apiVersion || upstreamApiVersion;
}

function readPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
