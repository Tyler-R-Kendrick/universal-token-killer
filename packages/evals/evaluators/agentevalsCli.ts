import { spawn as defaultSpawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { EvaluatorOutput } from './types.js';

export type SpawnLike = (command: string, args: readonly string[]) => ChildProcessWithoutNullStreams;

export type RunAgentEvalsCliArgs = {
  tracePath: string;
  evalSetPath: string;
  metric: string;
  binary?: string;
  spawnFn?: SpawnLike;
};

export type RunAgentEvalsCliResult =
  | { available: true; output: EvaluatorOutput; raw: string }
  | { available: false; reason: 'binary-missing' | 'spawn-error' | 'parse-error' | 'non-zero-exit'; detail?: string };

export async function runAgentEvalsCli(args: RunAgentEvalsCliArgs): Promise<RunAgentEvalsCliResult> {
  const binary = args.binary ?? 'agentevals';
  const spawn = args.spawnFn ?? (defaultSpawn as unknown as SpawnLike);
  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(binary, ['run', args.tracePath, '--eval-set', args.evalSetPath, '-m', args.metric]);
  } catch (error) {
    return { available: false, reason: 'spawn-error', detail: (error as Error).message };
  }
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
  const exit = await new Promise<{ code: number | null; error?: Error }>((resolve) => {
    child.on('error', (error) => resolve({ code: null, error }));
    child.on('close', (code) => resolve({ code }));
  });
  if (exit.error) {
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
