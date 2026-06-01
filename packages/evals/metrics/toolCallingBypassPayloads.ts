export type ToolCallingBypassExpectedPayload = {
  scenario?: string;
  category?: string;
  level?: string;
  should_bypass?: boolean;
  should_execute?: boolean;
  should_forward_upstream?: boolean;
  expected_tool?: string;
  expected_reason?: string;
  expected_args?: Record<string, unknown>;
  expected_output_contains?: string[];
  expected_miss_reason?: string;
  clarification_contains?: string[];
};

export type ToolCallingBypassActualPayload = {
  bypassed?: boolean;
  tool_name?: string;
  reason?: string;
  args?: Record<string, unknown>;
  executed?: boolean;
  forwarded_upstream?: boolean;
  upstream_calls?: number;
  output_text?: string;
  miss_reason?: string;
  clarification?: string;
  ambiguous?: boolean;
  denied?: boolean;
  protected?: boolean;
  route_reasons?: string[];
};

type ActualPayloadParser = (value: Record<string, unknown>) => ToolCallingBypassActualPayload | undefined;

const ACTUAL_PAYLOAD_PARSERS: readonly ActualPayloadParser[] = [
  normalizeDirectActual,
  parseChatCompletion,
  parseResponses,
  parseChatRequest,
  parseResponsesRequest
];

export function parseToolCallingBypassActualPayload(text: string): ToolCallingBypassActualPayload {
  const parsed = parseJson(text);
  if (isObject(parsed)) {
    for (const parser of ACTUAL_PAYLOAD_PARSERS) {
      const actual = parser(parsed);
      if (actual) return actual;
    }
  }
  return { bypassed: false, output_text: text };
}

export function parseToolCallingBypassExpectedPayload(text: string): ToolCallingBypassExpectedPayload {
  const parsed = parseJson(text);
  return isObject(parsed) ? normalizeExpectedPayload(parsed) : { scenario: 'tool-calling-bypass' };
}

export function wasForwardedUpstream(actual: ToolCallingBypassActualPayload): boolean {
  return actual.forwarded_upstream === true || (actual.upstream_calls ?? 0) > 0;
}

function normalizeExpectedPayload(value: Record<string, unknown>): ToolCallingBypassExpectedPayload {
  return {
    scenario: stringValue(value.scenario),
    category: stringValue(value.category),
    level: stringValue(value.level),
    should_bypass: bool(value.should_bypass),
    should_execute: bool(value.should_execute),
    should_forward_upstream: bool(value.should_forward_upstream),
    expected_tool: stringValue(value.expected_tool),
    expected_reason: stringValue(value.expected_reason),
    expected_args: objectValue(value.expected_args),
    expected_output_contains: stringArrayValue(value.expected_output_contains),
    expected_miss_reason: stringValue(value.expected_miss_reason),
    clarification_contains: stringArrayValue(value.clarification_contains)
  };
}

function normalizeDirectActual(value: Record<string, unknown>): ToolCallingBypassActualPayload | undefined {
  if (
    value.bypassed === undefined &&
    value.tool_name === undefined &&
    value.toolName === undefined &&
    value.forwarded_upstream === undefined &&
    value.executed === undefined &&
    value.miss_reason === undefined
  ) {
    return undefined;
  }

  return {
    bypassed: bool(value.bypassed),
    tool_name: stringValue(value.tool_name ?? value.toolName),
    reason: stringValue(value.reason),
    args: objectValue(value.args),
    executed: bool(value.executed),
    forwarded_upstream: bool(value.forwarded_upstream ?? value.forwardedUpstream),
    upstream_calls: numberValue(value.upstream_calls ?? value.upstreamCalls),
    output_text: stringValue(value.output_text ?? value.outputText),
    miss_reason: stringValue(value.miss_reason ?? value.missReason),
    clarification: stringValue(value.clarification),
    ambiguous: bool(value.ambiguous),
    denied: bool(value.denied),
    protected: bool(value.protected),
    route_reasons: stringArrayValue(value.route_reasons)
  };
}

function parseChatCompletion(value: Record<string, unknown>): ToolCallingBypassActualPayload | undefined {
  const choices = Array.isArray(value.choices) ? value.choices : [];
  const message = isObject(choices[0]) && isObject(choices[0].message) ? choices[0].message : undefined;
  if (!message) return undefined;
  const content = typeof message.content === 'string' ? message.content : '';
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const call = isObject(toolCalls[0]) ? toolCalls[0] : undefined;
  const fn = isObject(call?.function) ? call.function : undefined;
  if (fn && typeof fn.name === 'string') {
    return {
      bypassed: true,
      tool_name: fn.name,
      args: parseArgs(fn.arguments),
      executed: false,
      forwarded_upstream: false,
      output_text: JSON.stringify(value)
    };
  }
  if (content.includes('Missing required arguments')) {
    return missingRequiredActual(content);
  }
  return undefined;
}

function parseResponses(value: Record<string, unknown>): ToolCallingBypassActualPayload | undefined {
  const output = Array.isArray(value.output) ? value.output : [];
  const call = output.find((item) => isObject(item) && item.type === 'function_call');
  if (isObject(call) && typeof call.name === 'string') {
    const functionOutput = output.find((item) => isObject(item) && item.type === 'function_call_output');
    return {
      bypassed: true,
      tool_name: call.name,
      args: parseArgs(call.arguments),
      executed: Boolean(functionOutput),
      forwarded_upstream: false,
      output_text: isObject(functionOutput) && typeof functionOutput.output === 'string' ? functionOutput.output : JSON.stringify(value)
    };
  }
  const text = extractResponseMessageText(output.find((item) => isObject(item) && item.type === 'message'));
  return text?.includes('Missing required arguments') ? missingRequiredActual(text) : undefined;
}

function parseChatRequest(value: Record<string, unknown>): ToolCallingBypassActualPayload | undefined {
  const messages = Array.isArray(value.messages) ? value.messages : [];
  const assistant = [...messages].reverse().find((item) => isObject(item) && Array.isArray(item.tool_calls));
  if (!isObject(assistant)) return undefined;
  const call = Array.isArray(assistant.tool_calls) && isObject(assistant.tool_calls[0]) ? assistant.tool_calls[0] : undefined;
  const fn = isObject(call?.function) ? call.function : undefined;
  if (!fn || typeof fn.name !== 'string') return undefined;
  const toolMessage = [...messages].reverse().find((item) => isObject(item) && item.role === 'tool' && item.name === fn.name);
  return {
    bypassed: true,
    tool_name: fn.name,
    args: parseArgs(fn.arguments),
    executed: Boolean(toolMessage),
    forwarded_upstream: true,
    output_text: isObject(toolMessage) && typeof toolMessage.content === 'string' ? toolMessage.content : JSON.stringify(value)
  };
}

function parseResponsesRequest(value: Record<string, unknown>): ToolCallingBypassActualPayload | undefined {
  const input = Array.isArray(value.input) ? value.input : [];
  const call = input.find((item) => isObject(item) && item.type === 'function_call');
  if (!isObject(call) || typeof call.name !== 'string') return undefined;
  const output = input.find((item) => isObject(item) && item.type === 'function_call_output' && item.call_id === call.call_id);
  return {
    bypassed: true,
    tool_name: call.name,
    args: parseArgs(call.arguments),
    executed: Boolean(output),
    forwarded_upstream: true,
    output_text: isObject(output) && typeof output.output === 'string' ? output.output : JSON.stringify(value)
  };
}

function missingRequiredActual(content: string): ToolCallingBypassActualPayload {
  return {
    bypassed: false,
    executed: false,
    forwarded_upstream: false,
    miss_reason: 'missing-required-args',
    clarification: content,
    output_text: content
  };
}

function extractResponseMessageText(message: unknown): string | undefined {
  if (!isObject(message)) return undefined;
  const content = Array.isArray(message.content) ? message.content : [];
  return content.map((item) => isObject(item) && typeof item.text === 'string' ? item.text : '').join('');
}

function parseArgs(value: unknown): Record<string, unknown> {
  if (isObject(value)) return value;
  if (typeof value !== 'string') return {};
  const parsed = parseJson(value);
  return isObject(parsed) ? parsed : {};
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringArrayValue(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return isObject(value) ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
