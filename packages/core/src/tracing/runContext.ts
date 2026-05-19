import { randomUUID } from 'node:crypto';
import type { UtkConfig } from '../config/config.js';
import type { JaegerSpan } from './jaegerSpan.js';

export type RunContext = {
  runId: string;
  traceID: string;
  spans: JaegerSpan[];
  workspaceRoot: string;
  enabled: boolean;
  captureInputs: boolean;
  captureOutputs: boolean;
  emitEvalSet: boolean;
  storageRoot: string;
  processId: string;
  now: () => Date;
};

export type CreateRunContextOptions = {
  now?: () => Date;
  runId?: string;
};

export function createRunContext(
  config: UtkConfig,
  workspaceRoot: string,
  options: CreateRunContextOptions = {}
): RunContext {
  const tracing = config.tracing;
  const runId = options.runId ?? randomUUID();
  return {
    runId,
    traceID: runId,
    spans: [],
    workspaceRoot,
    enabled: tracing.enabled,
    captureInputs: tracing.capture_inputs,
    captureOutputs: tracing.capture_outputs,
    emitEvalSet: tracing.emit_eval_set,
    storageRoot: tracing.storage_root,
    processId: tracing.process_id,
    now: options.now ?? (() => new Date())
  };
}

export function nowMicros(ctx: Pick<RunContext, 'now'>): number {
  return ctx.now().getTime() * 1000;
}

export function newSpanId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 16);
}
