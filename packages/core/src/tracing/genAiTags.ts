import { stableStringify } from '../artifact/canonical.js';
import type { JaegerTag } from './jaegerSpan.js';

export type ToolCallTag = { name: string; id: string; arguments: unknown };

export const TAGS = {
  system: (value: string): JaegerTag => ({ key: 'gen_ai.system', value }),
  model: (value: string): JaegerTag => ({ key: 'gen_ai.request.model', value }),
  spanKind: (value: 'internal' | 'client' | 'server'): JaegerTag => ({ key: 'span.kind', value }),
  toolCalls: (calls: ToolCallTag[]): JaegerTag => ({
    key: 'gen_ai.request.openai.tool_calls',
    value: stableStringify(calls)
  }),
  toolResult: (result: unknown): JaegerTag => ({
    key: 'gen_ai.response.message.tool_result',
    value: stableStringify(result)
  }),
  utkFailureCode: (code: string): JaegerTag => ({ key: 'utk.failure.code', value: code }),
  utkInputs: (value: unknown): JaegerTag => ({
    key: 'utk.inputs',
    value: typeof value === 'string' ? value : stableStringify(value)
  }),
  utkOutputs: (value: unknown): JaegerTag => ({
    key: 'utk.outputs',
    value: typeof value === 'string' ? value : stableStringify(value)
  }),
  utkRunType: (value: 'tool' | 'parser' | 'chain' | 'llm'): JaegerTag => ({ key: 'utk.run_type', value })
};
