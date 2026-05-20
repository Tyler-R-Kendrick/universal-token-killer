import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { runAgentEvalsCli, type SpawnLike } from '../index.js';

function fakeChild(opts: {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  errorOnStart?: NodeJS.ErrnoException;
  errorOnSpawn?: Error;
}): { spawn: SpawnLike; calls: Array<{ command: string; args: readonly string[] }>; killCalls: string[] } {
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const killCalls: string[] = [];
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
    return Object.assign(child, {
      stdout,
      stderr,
      kill: (signal?: NodeJS.Signals | number) => {
        killCalls.push(typeof signal === 'string' ? signal : String(signal ?? ''));
        return true;
      }
    }) as never;
  }) as SpawnLike;
  return { spawn, calls, killCalls };
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

  it('forwards --threshold when provided and omits it otherwise', async () => {
    const ok = JSON.stringify({ score: 1, status: 'PASSED', per_invocation_scores: [1], details: { reason: 'ok' } });
    const withThreshold = fakeChild({ stdout: ok });
    await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', threshold: 0.75, spawnFn: withThreshold.spawn });
    expect(withThreshold.calls[0]?.args).toEqual(['run', 't', '--eval-set', 's', '-m', 'm', '--threshold', '0.75']);

    const without = fakeChild({ stdout: ok });
    await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', spawnFn: without.spawn });
    expect(without.calls[0]?.args).toEqual(['run', 't', '--eval-set', 's', '-m', 'm']);
  });

  it('kills the child on error so the process does not leak', async () => {
    const error = Object.assign(new Error('weird'), { code: 'EACCES' });
    const { spawn, killCalls } = fakeChild({ errorOnStart: error });
    const result = await runAgentEvalsCli({ tracePath: 't', evalSetPath: 's', metric: 'm', spawnFn: spawn });
    expect(result.available).toBe(false);
    expect(killCalls).toContain('SIGTERM');
  });

  it('on timeout sends SIGTERM, waits for close, and reports timeout', async () => {
    // A child that never emits close on its own — only after SIGTERM.
    const killCalls: string[] = [];
    const spawn: SpawnLike = (() => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const child = new EventEmitter();
      let acceptedSigterm = false;
      const childWithExtras = Object.assign(child, {
        stdout,
        stderr,
        kill: (signal?: NodeJS.Signals | number) => {
          killCalls.push(typeof signal === 'string' ? signal : String(signal ?? ''));
          if (signal === 'SIGTERM' && !acceptedSigterm) {
            acceptedSigterm = true;
            // Simulate a child that exits promptly on SIGTERM.
            setImmediate(() => child.emit('close', null));
          }
          return true;
        }
      });
      return childWithExtras as never;
    }) as SpawnLike;
    const result = await runAgentEvalsCli({
      tracePath: 't',
      evalSetPath: 's',
      metric: 'm',
      spawnFn: spawn,
      timeoutMs: 20,
      killGraceMs: 1_000
    });
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toBe('timeout');
      expect(result.detail).toContain('timed out after 20ms');
    }
    expect(killCalls[0]).toBe('SIGTERM');
    // No SIGKILL escalation because the child exited within the grace window.
    expect(killCalls).not.toContain('SIGKILL');
  });

  it('escalates to SIGKILL when the child ignores SIGTERM past the grace period', async () => {
    const killCalls: string[] = [];
    const spawn: SpawnLike = (() => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const child = new EventEmitter();
      const childWithExtras = Object.assign(child, {
        stdout,
        stderr,
        kill: (signal?: NodeJS.Signals | number) => {
          killCalls.push(typeof signal === 'string' ? signal : String(signal ?? ''));
          // Stubborn child: ignore SIGTERM; only honor SIGKILL.
          if (signal === 'SIGKILL') {
            setImmediate(() => child.emit('close', null));
          }
          return true;
        }
      });
      return childWithExtras as never;
    }) as SpawnLike;
    const result = await runAgentEvalsCli({
      tracePath: 't',
      evalSetPath: 's',
      metric: 'm',
      spawnFn: spawn,
      timeoutMs: 10,
      killGraceMs: 20
    });
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toBe('timeout');
    expect(killCalls).toContain('SIGTERM');
    expect(killCalls).toContain('SIGKILL');
  });

  it('settles immediately when child.kill() itself throws (child already dead)', async () => {
    const spawn: SpawnLike = (() => {
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const child = new EventEmitter();
      const childWithExtras = Object.assign(child, {
        stdout,
        stderr,
        kill: () => {
          throw new Error('ESRCH');
        }
      });
      return childWithExtras as never;
    }) as SpawnLike;
    const result = await runAgentEvalsCli({
      tracePath: 't',
      evalSetPath: 's',
      metric: 'm',
      spawnFn: spawn,
      timeoutMs: 10
    });
    expect(result.available).toBe(false);
    if (!result.available) expect(result.reason).toBe('timeout');
  });
});
