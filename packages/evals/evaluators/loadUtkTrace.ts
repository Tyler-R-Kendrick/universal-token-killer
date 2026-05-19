import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { EvalSet, Invocation } from './types.js';
import type { JaegerTraceLike } from './noParseFailures.js';

export type LoadedUtkTrace = {
  evalSet: EvalSet;
  invocations: Invocation[];
  trace: JaegerTraceLike;
};

export async function loadUtkTrace(workspaceRoot: string, runId: string, options: { storageRoot?: string } = {}): Promise<LoadedUtkTrace> {
  const storageRoot = options.storageRoot ?? '.utk/events';
  const eventsDir = path.isAbsolute(storageRoot) ? storageRoot : path.join(workspaceRoot, storageRoot);
  const evalSet = JSON.parse(await readFile(path.join(eventsDir, `${runId}.eval_set.json`), 'utf8')) as EvalSet;
  const trace = JSON.parse(await readFile(path.join(eventsDir, `${runId}.jaeger.json`), 'utf8')) as JaegerTraceLike;
  const invocations = evalSet.eval_cases.flatMap((evalCase) => evalCase.conversation);
  return { evalSet, invocations, trace };
}
