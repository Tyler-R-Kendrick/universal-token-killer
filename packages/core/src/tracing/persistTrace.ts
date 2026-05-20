import { mkdir, writeFile } from 'node:fs/promises';
import { canonicalJson } from '../artifact/canonical.js';
import { safeJoin } from '../security/pathSafety.js';
import { toEvalSet, type EvalSet } from './evalSet.js';
import type { JaegerProcess, JaegerTraceDocument } from './jaegerSpan.js';
import type { RunContext } from './runContext.js';

export type FlushResult = {
  jaegerPath: string;
  evalSetPath?: string;
  document: JaegerTraceDocument;
  evalSet?: EvalSet;
};

export async function flushTrace(ctx: RunContext): Promise<FlushResult | undefined> {
  if (!ctx.enabled) return undefined;
  const eventsDir = safeJoin(ctx.workspaceRoot, ctx.storageRoot);
  await mkdir(eventsDir, { recursive: true });

  const processes: Record<string, JaegerProcess> = {
    [ctx.processId]: { serviceName: 'utk', tags: [] }
  };
  const document: JaegerTraceDocument = {
    data: [
      {
        traceID: ctx.traceID,
        spans: ctx.spans,
        processes
      }
    ]
  };

  const jaegerPath = safeJoin(eventsDir, `${ctx.runId}.jaeger.json`);
  await writeFile(jaegerPath, canonicalJson(document), 'utf8');

  let evalSetPath: string | undefined;
  let evalSet: EvalSet | undefined;
  if (ctx.emitEvalSet) {
    evalSet = toEvalSet(ctx.spans, ctx.runId);
    evalSetPath = safeJoin(eventsDir, `${ctx.runId}.eval_set.json`);
    await writeFile(evalSetPath, canonicalJson(evalSet), 'utf8');
  }

  return { jaegerPath, evalSetPath, document, evalSet };
}

