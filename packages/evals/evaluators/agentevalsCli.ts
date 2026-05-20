import { spawn as defaultSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { EvaluatorOutput } from './types.js';

export type SpawnLike = (command: string, args: readonly string[]) => ChildProcessWithoutNullStreams;

export type RunAgentEvalsCliArgs = {
  tracePath: string;
  evalSetPath: string;
  metric: string;
  threshold?: number;
  binary?: string;
  spawnFn?: SpawnLike;
  /** Hard wall-clock budget; on expiry the child is SIGTERMed and the result is reason: 'timeout'. Defaults to 30s. */
  timeoutMs?: number;
  /** Grace period after SIGTERM before escalating to SIGKILL. Defaults to 2s. */
  killGraceMs?: number;
};

export type RunAgentEvalsCliResult =
  | { available: true; output: EvaluatorOutput; raw: string }
  | { available: false; reason: 'binary-missing' | 'spawn-error' | 'parse-error' | 'non-zero-exit' | 'timeout'; detail?: string };

export async function runAgentEvalsCli(args: RunAgentEvalsCliArgs): Promise<RunAgentEvalsCliResult> {
  const binary = args.binary ?? 'agentevals';
  const timeoutMs = args.timeoutMs ?? 30_000;
  const gracePeriodMs = args.killGraceMs ?? 2_000;
  const spawn = args.spawnFn ?? (defaultSpawn as unknown as SpawnLike);
  const argv = ['run', args.tracePath, '--eval-set', args.evalSetPath, '-m', args.metric];
  if (args.threshold !== undefined) {
    argv.push('--threshold', String(args.threshold));
  }
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(binary, argv);
  } catch (error) {
    return { available: false, reason: 'spawn-error', detail: (error as Error).message };
  }
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
  const exit = await new Promise<{ code: number | null; error?: Error; timedOut?: boolean }>((resolve) => {
    let settled = false;
    let timedOut = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutError: Error | undefined;
    const settle = (result: { code: number | null; error?: Error; timedOut?: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      timeoutError = new Error(`agentevals timed out after ${timeoutMs}ms`);
      // Send SIGTERM. If kill() itself throws (e.g. the child is already gone),
      // settle immediately. Otherwise give the child a short grace period to
      // exit cleanly before escalating to SIGKILL — without escalation, a
      // stubborn child can keep running in the background after we resolve.
      try {
        child.kill('SIGTERM');
      } catch {
        settle({ code: null, error: timeoutError, timedOut: true });
        return;
      }
      killTimer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* already exited */
        }
      }, gracePeriodMs);
    }, timeoutMs);
    child.once('error', (error) => settle({ code: null, error }));
    child.once('close', (code) => {
      // After timeout we already initiated SIGTERM/SIGKILL; the eventual close
      // here is the timed-out child exiting. Translate to the timeout outcome so
      // the caller sees `reason: 'timeout'` rather than `non-zero-exit`.
      if (timedOut) {
        settle({ code: null, error: timeoutError, timedOut: true });
      } else {
        settle({ code });
      }
    });
  });
  if (exit.timedOut) {
    return { available: false, reason: 'timeout', detail: exit.error?.message ?? `timed out after ${timeoutMs}ms` };
  }
  if (exit.error) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* child may already be dead; nothing to clean up */
    }
    const nodeError = exit.error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') return { available: false, reason: 'binary-missing', detail: nodeError.message };
    return { available: false, reason: 'spawn-error', detail: nodeError.message };
  }
  const stdout = Buffer.concat(stdoutChunks).toString('utf8');
  if (exit.code !== 0) {
    return { available: false, reason: 'non-zero-exit', detail: Buffer.concat(stderrChunks).toString('utf8') || `exit code ${exit.code}` };
  }
  try {
    const output = JSON.parse(stdout) as EvaluatorOutput;
    return { available: true, output, raw: stdout };
  } catch (error) {
    return { available: false, reason: 'parse-error', detail: (error as Error).message };
  }
}
