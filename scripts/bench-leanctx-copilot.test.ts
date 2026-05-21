import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { leanCtxCopilotFixtures } from '../packages/evals/fixtures/leanCtxCopilotFixtures.js';
import { runLeanCtxCopilotBenchmark } from './bench-leanctx-copilot.js';

describe('LeanCTX Copilot benchmark', () => {
  it('covers at least 50 Copilot cases across prompt, tool output, and tool schema surfaces', () => {
    expect(leanCtxCopilotFixtures).toHaveLength(50);
    expect(new Set(leanCtxCopilotFixtures.map((fixture) => fixture.id)).size).toBe(50);
    expect(new Set(leanCtxCopilotFixtures.map((fixture) => fixture.kind))).toEqual(new Set(['prompt-surface', 'tool-output', 'tool-schema']));
    expect(leanCtxCopilotFixtures.every((fixture) => fixture.requiredFacts.length >= 3)).toBe(true);
    expect(leanCtxCopilotFixtures.every((fixture) => fixture.mustRecover)).toBe(true);
  });

  it('runs repeated quality evals and requires UTK to meet or beat LeanCTX on every case', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-leanctx-copilot-bench-'));
    const result = await runLeanCtxCopilotBenchmark({ workspaceRoot, rounds: 3 });

    expect(result.rounds).toBe(3);
    expect(result.results).toHaveLength(150);
    expect(result.failures, result.failures.map((failure) => `${failure.id}: ${failure.feedback.join('; ')}`).join('\n')).toEqual([]);
    expect(result.summary.allPassed).toBe(true);
    expect(result.summary.minRelevance).toBe(1);
    expect(result.summary.minCorrectness).toBe(1);
    expect(result.summary.minGroundedness).toBe(1);
    expect(result.summary.tokenSavingsVsLeanCtx).toBeGreaterThan(0);
  });
});
