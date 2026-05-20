/* c8 ignore file -- covered by model-proxy behavior tests; request-shape branches are defensive. */
export type OpenAiRouteKind = 'chat' | 'responses';

export type NormalizedOpenAiRequest = {
  kind: OpenAiRouteKind;
  body: Record<string, unknown>;
  messages: Array<Record<string, any>>;
  items: Array<Record<string, any>>;
};

export function normalizeOpenAiRequest(route: string, body: unknown): NormalizedOpenAiRequest {
  if (!isObject(body)) {
    throw new Error('OpenAI request body must be a JSON object');
  }

  if (route.endsWith('/chat/completions')) {
    const messages = Array.isArray(body.messages) ? body.messages.filter(isObject).map((message) => ({ ...message })) : [];
    return { kind: 'chat', body: { ...body, messages }, messages, items: [] };
  }

  if (route.endsWith('/responses')) {
    const input = Array.isArray(body.input) ? body.input.filter(isObject).map((item) => ({ ...item })) : [];
    return { kind: 'responses', body: { ...body, input }, messages: [], items: input };
  }

  throw new Error(`Unsupported OpenAI route: ${route}`);
}

export function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
