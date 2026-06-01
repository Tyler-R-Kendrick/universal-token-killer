import { ContextBudgetManager, type ContextBudgetDecision } from '@utk/core';
import { estimateTokens, isObject, normalizeOpenAiRequest, type JsonObject } from './openai.js';

export function findLastUserQuery(normalized: ReturnType<typeof normalizeOpenAiRequest>): string {
  if (normalized.kind === 'chat') {
    const user = [...normalized.messages].reverse().find((message) => message.role === 'user');
    return contentToText(user?.content);
  }
  const user = [...normalized.items].reverse().find((item) => item.role === 'user');
  return contentToText(user?.content);
}

export function evaluateBudget(request: JsonObject, reserveOutputTokens: number, threshold: number, enabled: boolean): ContextBudgetDecision {
  const inputTokens = estimateTokens(JSON.stringify(request));
  if (!enabled) {
    return {
      inputTokens,
      reservedOutputTokens: reserveOutputTokens,
      availableInputTokens: Math.max(0, Number(request.max_context_tokens ?? 128000) - reserveOutputTokens),
      pressure: 0,
      shouldCompactHistory: false,
      routeReason: 'budget-ok'
    };
  }
  const manager = new ContextBudgetManager({
    maxContextTokens: Number(request.max_context_tokens ?? 128000),
    reserveOutputTokens,
    historyCompactionThreshold: threshold,
    cheapModelPatterns: ['gpt-*-mini', '*cheap*']
  });
  return manager.evaluate({ inputTokens, model: String(request.model ?? '') });
}

export function deriveSessionId(body: JsonObject): string {
  const fromMetadata = isObject(body.metadata) && typeof body.metadata.utk_session_id === 'string' ? body.metadata.utk_session_id : undefined;
  if (fromMetadata) return fromMetadata.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
  return `req_${String(body.model ?? 'model')}_${estimateTokens(JSON.stringify(body))}`.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 80);
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item) => isObject(item) && typeof item.text === 'string' ? item.text : '').filter(Boolean).join('\n');
  }
  return '';
}
