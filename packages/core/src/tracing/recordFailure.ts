import { stableStringify } from '../artifact/canonical.js';
import type { JaegerLog, JaegerSpan, JaegerTag } from './jaegerSpan.js';
import { newSpanId, nowMicros, type RunContext } from './runContext.js';

export type RecordFailureOptions = {
  span?: JaegerSpan;
  name: string;
  runType?: 'tool' | 'parser' | 'chain' | 'llm';
  operationName?: string;
  error?: Error | { name?: string; message?: string; stack?: string };
  extra?: Record<string, unknown>;
};

export function recordFailure(ctx: RunContext | undefined, options: RecordFailureOptions): JaegerSpan | undefined {
  if (!ctx || !ctx.enabled) return undefined;
  const span = options.span ?? createOrphanSpan(ctx, options);
  if (!options.span) {
    ctx.spans.push(span);
  }
  span.logs.push(buildExceptionLog(ctx, options));
  return span;
}

function createOrphanSpan(ctx: RunContext, options: RecordFailureOptions): JaegerSpan {
  const start = nowMicros(ctx);
  return {
    traceID: ctx.traceID,
    spanID: newSpanId(),
    operationName: options.operationName ?? options.name,
    startTime: start,
    duration: 0,
    tags: [
      { key: 'utk.failure.code', value: options.name },
      { key: 'utk.run_type', value: options.runType ?? 'tool' }
    ],
    logs: [],
    references: [],
    processID: ctx.processId
  };
}

function buildExceptionLog(ctx: RunContext, options: RecordFailureOptions): JaegerLog {
  const error = options.error;
  const fields: JaegerTag[] = [
    { key: 'event', value: 'exception' },
    { key: 'utk.failure.code', value: options.name },
    { key: 'exception.type', value: error?.name ?? 'Error' },
    { key: 'exception.message', value: error?.message ?? '' }
  ];
  if (error?.stack) {
    fields.push({ key: 'exception.stacktrace', value: error.stack });
  }
  if (options.extra) {
    fields.push({ key: 'utk.failure.extra', value: stableStringify(options.extra) });
  }
  return { timestamp: nowMicros(ctx), fields };
}

export function startSpan(
  ctx: RunContext,
  params: {
    operationName: string;
    runType?: 'tool' | 'parser' | 'chain' | 'llm';
    parent?: JaegerSpan;
    tags?: JaegerTag[];
  }
): JaegerSpan {
  const span: JaegerSpan = {
    traceID: ctx.traceID,
    spanID: newSpanId(),
    operationName: params.operationName,
    startTime: nowMicros(ctx),
    duration: 0,
    tags: [
      { key: 'utk.run_type', value: params.runType ?? 'chain' },
      ...(params.tags ?? [])
    ],
    logs: [],
    references: params.parent
      ? [{ refType: 'CHILD_OF', traceID: ctx.traceID, spanID: params.parent.spanID }]
      : [],
    processID: ctx.processId
  };
  ctx.spans.push(span);
  return span;
}

export function endSpan(
  ctx: RunContext,
  span: JaegerSpan,
  result?: { tags?: JaegerTag[]; error?: Error | { name?: string; message?: string; stack?: string } }
): void {
  span.duration = Math.max(0, nowMicros(ctx) - span.startTime);
  if (result?.tags) span.tags.push(...result.tags);
  if (result?.error) {
    span.logs.push(
      buildExceptionLog(ctx, {
        name: 'span.error',
        error: result.error
      })
    );
  }
}
