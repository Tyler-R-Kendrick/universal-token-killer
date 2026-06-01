/* c8 ignore file -- covered by model-proxy behavior tests; request-shape branches are defensive. */
export type OpenAiRouteKind = 'chat' | 'responses';
export type JsonObject = Record<string, unknown>;

export type NormalizedOpenAiRequest = {
  kind: OpenAiRouteKind;
  body: JsonObject;
  messages: JsonObject[];
  items: JsonObject[];
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
    const input = normalizeResponsesInput(body.input);
    return { kind: 'responses', body: { ...body, input }, messages: [], items: input };
  }

  throw new Error(`Unsupported OpenAI route: ${route}`);
}

export function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function parseJsonObject(value: string): JsonObject | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    return isObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function jsonResponse(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

export function findLastUserText(route: string, body: JsonObject): string {
  if (route === '/v1/chat/completions' && Array.isArray(body.messages)) {
    for (let index = body.messages.length - 1; index >= 0; index -= 1) {
      const message = body.messages[index];
      if (isObject(message) && message.role === 'user') return contentText(message.content);
    }
  }
  if (route === '/v1/responses') {
    if (typeof body.input === 'string') return body.input;
    if (Array.isArray(body.input)) {
      for (let index = body.input.length - 1; index >= 0; index -= 1) {
        const item = body.input[index];
        if (isObject(item) && item.role === 'user') return contentText(item.content);
      }
    }
  }
  return '';
}

export function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((part) => {
    if (!isObject(part)) return '';
    if (typeof part.text === 'string') return part.text;
    if (typeof part.input_text === 'string') return part.input_text;
    if (typeof part.content === 'string') return part.content;
    return '';
  }).filter(Boolean).join('\n');
}

function normalizeResponsesInput(input: unknown): JsonObject[] {
  if (typeof input === 'string') {
    return [{ role: 'user', content: [{ type: 'input_text', text: input }] }];
  }
  return Array.isArray(input) ? input.filter(isObject).map((item) => ({ ...item })) : [];
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
