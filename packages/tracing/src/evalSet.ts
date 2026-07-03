import type { JaegerSpan, JaegerTag } from './jaegerSpan.js';

export type EvalSetTextPart = { text: string };
export type EvalSetContent = { role: 'user' | 'model'; parts: EvalSetTextPart[] };
export type EvalSetToolUse = { name: string; id: string; args: unknown };
export type EvalSetToolResponse = { name: string; id: string; response: string };
export type EvalSetInvocation = {
  invocation_id: string;
  user_content: EvalSetContent;
  final_response: EvalSetContent;
  intermediate_data: {
    tool_uses: EvalSetToolUse[];
    tool_responses: EvalSetToolResponse[];
  };
};
export type EvalCase = {
  eval_id: string;
  conversation: EvalSetInvocation[];
};
export type EvalSet = {
  eval_set_id: string;
  name: string;
  eval_cases: EvalCase[];
};

export function toEvalSet(spans: JaegerSpan[], runId: string, options?: { name?: string }): EvalSet {
  const root = spans.find((span) => span.references.length === 0) ?? spans[0];
  const userText = root ? readTag(root.tags, 'utk.inputs') : '';
  const finalText = root ? readTag(root.tags, 'utk.outputs') : '';
  const toolSpans = spans.filter((span) => readTag(span.tags, 'utk.run_type') === 'tool');
  const tool_uses: EvalSetToolUse[] = toolSpans.map((span) => ({
    name: span.operationName,
    id: span.spanID,
    args: parseJsonOrString(readTag(span.tags, 'utk.inputs'))
  }));
  const tool_responses: EvalSetToolResponse[] = toolSpans.map((span) => ({
    name: span.operationName,
    id: span.spanID,
    response: readTag(span.tags, 'utk.outputs') ?? ''
  }));

  return {
    eval_set_id: runId,
    name: options?.name ?? `utk-run-${runId}`,
    eval_cases: [
      {
        eval_id: runId,
        conversation: [
          {
            invocation_id: root?.spanID ?? runId,
            user_content: { role: 'user', parts: [{ text: userText ?? '' }] },
            final_response: { role: 'model', parts: [{ text: finalText ?? '' }] },
            intermediate_data: { tool_uses, tool_responses }
          }
        ]
      }
    ]
  };
}

function readTag(tags: JaegerTag[], key: string): string | undefined {
  const tag = tags.find((entry) => entry.key === key);
  if (!tag) return undefined;
  if (typeof tag.value === 'string') return tag.value;
  return undefined;
}

function parseJsonOrString(value: string | undefined): unknown {
  if (value === undefined) return {};
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
