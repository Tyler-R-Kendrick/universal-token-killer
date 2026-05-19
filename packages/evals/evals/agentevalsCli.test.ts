import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { runAgentEvalsCli, type SpawnLike } from '../index.js';

function fakeChild(opts: {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  errorOnStart?: NodeJS.ErrnoException;
  errorOnSpawn?: Error;
}): { spawn: SpawnLike; calls: Array<{ command: string; args: readonly string[] }> } {
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const spawn: SpawnLike = ((command, args) => {
    calls.push({ command, args });
    if (opts.errorOnSpawn) throw opts.errorOnSpawn;
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = new EventEmitter();
    setImmediate(() => {
      if (opts.errorOnStart) {
        child.emit('error', opts.errorOnStart);
        return;
      }
      if (opts.stdout) stdout.emit('data', Buffer.from(opts.stdout));
      if (opts.stderr) stderr.emit('data', Buffer.from(opts.stderr));
      child.emit('close', opts.code ?? 0);
    });
    return Object.assign(child, { stdout, stderr }) as never;
  }) as SpawnLike;
  return { spawn, calls };
}

describe('runAgentEvalsCli', () => {
  it('returns parsed EvaluatorOutput on a successful exit', async () => {
    const { spawn, calls } = fakeChild({
      stdout: JSON.stringify({ score: 0.95, status: 'PASSED', per_invocation_scores: [0.95], details: { reason: 'ok' } })
    });
    const result = await runAgentEvalsCli({
      tracePath: 'trace.json',
      evalSetPath: 'set.json',
      metric: 'tool_trajectory_avg_score',
      spawnFn: spawn
    });
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.output.score).toBe(0.95);
      expect(result.output.status).toBe('PASSED');
    }
    expect(calls[0]?.args).toEqual(['run', 'trace.json', '--eval-set', 'set.json', '-m', 'tool_trajectory_avg_score']);
  });

  it('reports binary-missing when ENOENT is emitted', async () => {
    const error = Object.assign(new Error('not found'), { code: 'ENOENT' });
    const { spawn } = fakeChild({ errorOnStart: error });
    const result = await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', spawnFn: spawn });
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toBe('binary-missing');
  });

  it('reports spawn-error for other emitted errors', async () => {
    const error = Object.assign(new Error('weird'), { code: 'EACCES' });
    const { spawn } = fakeChild({ errorOnStart: error });
    const result = await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', spawnFn: spawn });
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toBe('spawn-error');
  });

  it('reports spawn-error when the spawn function itself throws', async () => {
    const { spawn } = fakeChild({ errorOnSpawn: new Error('throw at spawn time') });
    const result = await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', spawnFn: spawn });
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe('spawn-error');
      expect(result.detail).toContain('throw at spawn time');
    }
  });

  it('reports non-zero-exit when the binary fails', async () => {
    const { spawn } = fakeChild({ code: 2, stderr: 'unknown metric' });
    const result = await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', spawnFn: spawn });
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe('non-zero-exit');
      expect(result.detail).toContain('unknown metric');
    }
  });

  it('falls back to "exit code N" detail when stderr is empty', async () => {
    const { spawn } = fakeChild({ code: 3 });
    const result = await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', spawnFn: spawn });
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe('non-zero-exit');
      expect(result.detail).toBe('exit code 3');
    }
  });

  it('reports parse-error when stdout is not valid JSON', async () => {
    const { spawn } = fakeChild({ stdout: 'not json' });
    const result = await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', spawnFn: spawn });
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toBe('parse-error');
  });

  it('uses the configured binary name', async () => {
    const { spawn, calls } = fakeChild({ stdout: JSON.stringify({ score: 1, status: 'PASSED', per_invocation_scores: [1], details: { reason: 'ok' } }) });
    await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', spawnFn: spawn, binary: '/opt/bin/agentevals' });
    expect(calls[0]?.command).toBe('/opt/bin/agentevals');
  });
});
