import { isObject, type JsonObject } from './openai.js';
import { contentHash } from './utils.js';

export type ToolOutputEventSource = {
  role: string;
  toolName: string;
  input: Record<string, unknown>;
  status: 'ok' | 'error';
  turn: number;
};

export function isToolLikeMessage(message: JsonObject): boolean {
  return isObject(message) && (message.role === 'tool' || typeof message.tool_call_id === 'string' || typeof message.name === 'string');
}

export function chatEventSource(message: JsonObject, content: string, turn: number): ToolOutputEventSource {
  return {
    role: typeof message.role === 'string' ? message.role : 'tool',
    toolName: toolNameForMessage(message),
    input: outputIdentity(content),
    status: inferStatus(content),
    turn
  };
}

export function responseEventSource(item: JsonObject, content: string, turn: number): ToolOutputEventSource {
  return {
    role: 'tool',
    toolName: typeof item.name === 'string' ? item.name : 'function_call_output',
    input: outputIdentity(content),
    status: inferStatus(content),
    turn
  };
}

function toolNameForMessage(message: JsonObject): string {
  if (typeof message.name === 'string' && message.name.trim()) return message.name;
  if (typeof message.tool_name === 'string' && message.tool_name.trim()) return message.tool_name;
  return typeof message.role === 'string' && message.role.trim() ? message.role : 'tool';
}

function outputIdentity(content: string): Record<string, unknown> {
  return { outputHash: contentHash(content, 16) };
}

function inferStatus(content: string): 'ok' | 'error' {
  return /\b(error|failed|failure|exception|traceback|panic|ts\d{3,5})\b/i.test(content) ? 'error' : 'ok';
}
