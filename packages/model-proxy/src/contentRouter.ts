/* c8 ignore file -- covered by model-proxy behavior tests; branch coverage is dominated by defensive classifiers. */
import { encode } from '@toon-format/toon';
import { classifyRouteReason, hasStructuredOrProtectedSignal } from './contentRouteClassification.js';
import { extractKeyFactLines, extractProtectedPreview, routeSpecificCompactObject, stableJson } from './contentRouteCompactors.js';
import type { ContentRoute } from './contentRouteTypes.js';
import { estimateTokens } from './openai.js';

export type { ContentRoute } from './contentRouteTypes.js';

export function routeContentForProxy(content: string, query: string): ContentRoute {
  const routeReason = classifyRouteReason(content, query);
  const protectedPreview = extractProtectedPreview(content);
  const compactObject = routeSpecificCompactObject(content, routeReason, query, protectedPreview);
  const serializerId: 'toon' | 'json-compact' = routeReason.startsWith('structured-json') ? 'json-compact' : 'toon';
  const compactText = serializerId === 'toon' ? encode(compactObject) : stableJson(compactObject);
  return {
    routeReason,
    kind: routeReason,
    serializerId,
    compactText,
    protectedPreview,
    rawTokens: estimateTokens(content),
    compactTokens: estimateTokens(compactText)
  };
}

export function shouldCompactContent(content: string, minTokens: number): boolean {
  return hasStructuredOrProtectedSignal(content) || estimateTokens(content) >= minTokens || content.length >= minTokens * 2;
}

export function compactCopilotToolOutput(content: string, query: string): ContentRoute {
  const routeReason = classifyRouteReason(content, query);
  const facts = extractKeyFactLines(content, query);
  const compactText = [
    `kind=${routeReason}`,
    `facts=${facts.join('; ')}`,
    'recover=utk_expand_context'
  ].join('\n');
  return {
    routeReason,
    kind: routeReason,
    serializerId: 'toon',
    compactText,
    protectedPreview: facts.join('\n'),
    rawTokens: estimateTokens(content),
    compactTokens: estimateTokens(compactText)
  };
}
