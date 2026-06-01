import { TAGS, endSpan, flushTrace, startSpan, type RunContext } from '../tracing/index.js';

export type ToolExecutor = (input: unknown) => Promise<unknown>;
export type MediationSpan = ReturnType<typeof startSpan>;

export function activeRunContext(tracer?: RunContext): RunContext | undefined {
  return tracer?.enabled ? tracer : undefined;
}

export function startMediationSpan(tracer: RunContext | undefined, input: unknown): MediationSpan | undefined {
  return tracer
    ? startSpan(tracer, {
        operationName: 'utk.mediate',
        runType: 'chain',
        tags: [
          TAGS.system('utk'),
          TAGS.spanKind('internal'),
          ...(tracer.captureInputs ? [TAGS.utkInputs(input)] : [])
        ]
      })
    : undefined;
}

export function endMediationSpan(tracer: RunContext | undefined, span: MediationSpan | undefined, resultOrError: { response?: string; error?: Error }): void {
  if (!tracer || !span) return;
  if (resultOrError.error) {
    endSpan(tracer, span, { error: resultOrError.error });
    return;
  }
  endSpan(tracer, span, { tags: tracer.captureOutputs && resultOrError.response ? [TAGS.utkOutputs(resultOrError.response)] : [] });
}

export async function flushMediationTrace(tracer: RunContext | undefined): Promise<void> {
  if (!tracer) return;
  try {
    await flushTrace(tracer);
  } catch {
    // Tracing must be fail-open; a flush failure must not break mediation result.
  }
}

export async function runToolWithTrace(params: {
  normalizedToolId: string;
  input: unknown;
  execute: ToolExecutor;
  tracer?: RunContext;
  rootSpan?: MediationSpan;
}): Promise<unknown> {
  const toolSpan = params.tracer && params.rootSpan
    ? startSpan(params.tracer, {
        operationName: `tool.${params.normalizedToolId}`,
        runType: 'tool',
        parent: params.rootSpan,
        tags: params.tracer.captureInputs ? [TAGS.utkInputs(params.input)] : []
      })
    : undefined;
  try {
    const output = await params.execute(params.input);
    if (params.tracer && toolSpan) {
      endSpan(params.tracer, toolSpan, { tags: params.tracer.captureOutputs ? [TAGS.utkOutputs(output)] : [] });
    }
    return output;
  } catch (error) {
    if (params.tracer && toolSpan) endSpan(params.tracer, toolSpan, { error: error as Error });
    throw error;
  }
}
