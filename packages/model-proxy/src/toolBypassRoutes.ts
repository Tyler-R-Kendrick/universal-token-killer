import { randomUUID } from 'node:crypto';
import { cloneJson, isObject, type JsonObject } from './openai.js';

export type ToolCallShape = {
  callId: string;
  toolName: string;
  chatToolCall: Record<string, unknown>;
  responsesFunctionCall: Record<string, unknown>;
};

export type ToolBypassRouteAdapter = {
  toolCallResponse(body: JsonObject, shape: ToolCallShape): JsonObject;
  clarificationResponse(body: JsonObject, message: string): JsonObject;
  appendLocalExecution(body: JsonObject, shape: ToolCallShape, content: string): JsonObject;
};

type ToolBypassRoute = '/v1/chat/completions' | '/v1/responses';

const ROUTE_ADAPTERS: Record<ToolBypassRoute, ToolBypassRouteAdapter> = {
  '/v1/chat/completions': {
    toolCallResponse: chatToolCallResponse,
    clarificationResponse: chatClarificationResponse,
    appendLocalExecution: appendChatLocalToolExecution
  },
  '/v1/responses': {
    toolCallResponse: responsesToolCallResponse,
    clarificationResponse: responsesClarificationResponse,
    appendLocalExecution: appendResponsesLocalToolExecution
  }
};

export function toolBypassRouteAdapter(route: string): ToolBypassRouteAdapter | undefined {
  return isToolBypassRoute(route) ? ROUTE_ADAPTERS[route] : undefined;
}

export function toolCallShape(toolName: string, args: Record<string, unknown>): ToolCallShape {
  const callId = makeId('call');
  const argumentsJson = JSON.stringify(args);
  return {
    callId,
    toolName,
    chatToolCall: {
      id: callId,
      type: 'function',
      function: { name: toolName, arguments: argumentsJson }
    },
    responsesFunctionCall: {
      type: 'function_call',
      id: makeId('fc'),
      call_id: callId,
      name: toolName,
      arguments: argumentsJson,
      status: 'completed'
    }
  };
}

function isToolBypassRoute(route: string): route is ToolBypassRoute {
  return route === '/v1/chat/completions' || route === '/v1/responses';
}

function appendResponsesLocalToolExecution(body: JsonObject, shape: ToolCallShape, content: string): JsonObject {
  const next = cloneJson(body);
  next.metadata = { ...(isObject(next.metadata) ? next.metadata : {}), utk_tool_bypass_executed: true };
  const inputItems = typeof next.input === 'string'
    ? [{ role: 'user', content: [{ type: 'input_text', text: next.input }] }]
    : Array.isArray(next.input) ? next.input : [];
  inputItems.push(shape.responsesFunctionCall);
  inputItems.push({ type: 'function_call_output', call_id: shape.callId, output: content });
  next.input = inputItems;
  return next;
}

function appendChatLocalToolExecution(body: JsonObject, shape: ToolCallShape, content: string): JsonObject {
  const next = cloneJson(body);
  next.metadata = { ...(isObject(next.metadata) ? next.metadata : {}), utk_tool_bypass_executed: true };
  const messages = Array.isArray(next.messages) ? next.messages : [];
  messages.push({
    role: 'assistant',
    content: null,
    tool_calls: [shape.chatToolCall]
  });
  messages.push({ role: 'tool', tool_call_id: shape.callId, name: shape.toolName, content });
  next.messages = messages;
  return next;
}

function responsesToolCallResponse(body: JsonObject, shape: ToolCallShape): JsonObject {
  return {
    id: makeId('resp'),
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    model: body.model ?? 'utk-tool-bypass',
    output: [shape.responsesFunctionCall]
  };
}

function chatToolCallResponse(body: JsonObject, shape: ToolCallShape): JsonObject {
  return {
    id: makeId('chatcmpl'),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model ?? 'utk-tool-bypass',
    choices: [{
      index: 0,
      finish_reason: 'tool_calls',
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [shape.chatToolCall]
      }
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}

function responsesClarificationResponse(body: JsonObject, message: string): JsonObject {
  return {
    id: makeId('resp'),
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    model: body.model ?? 'utk-tool-bypass',
    output: [{
      type: 'message',
      id: makeId('msg'),
      role: 'assistant',
      content: [{ type: 'output_text', text: message }]
    }]
  };
}

function chatClarificationResponse(body: JsonObject, message: string): JsonObject {
  return {
    id: makeId('chatcmpl'),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: body.model ?? 'utk-tool-bypass',
    choices: [{
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content: message }
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}

function makeId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}
