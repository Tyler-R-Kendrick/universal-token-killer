import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { compareBaseline, DEFAULT_BENCHMARK_CASES, runOptionalRtkBenchmark, summarizeBenchmarks } from './bench-rtk-baseline.js';

describe('RTK benchmark helpers', () => {
  it('compares baselines and summarizes pass/fail outcomes', () => {
    expect(compareBaseline(100, 40, 30)).toEqual({ raw: 100, rtk: 40, utk: 30, utkVsRtkDelta: 10 });
    expect(summarizeBenchmarks([{ name: 'ok', rawSize: 100, rtkFilteredSize: 40, utkCompactSize: 40, fidelity: 1, recoverability: 1, latencyMs: 1, routingOverheadTokens: 1 }]).utkMatchesOrBeatsRtk).toBe(true);
    expect(summarizeBenchmarks([{ name: 'bad', rawSize: 100, rtkFilteredSize: 40, utkCompactSize: 41, fidelity: 1, recoverability: 1, latencyMs: 1, routingOverheadTokens: 1 }]).utkMatchesOrBeatsRtk).toBe(false);
    expect(DEFAULT_BENCHMARK_CASES).toContain('shell-git-diff');
    expect(DEFAULT_BENCHMARK_CASES).toContain('arbitrary-structured-tool-output');
  });

  it('skips live RTK by default and runs configured supported fixtures through a shared runner', () => {
    expect(runOptionalRtkBenchmark({}, [])).toEqual({
      status: 'skipped',
      message: 'Set UTK_RTK_COMMAND or UTK_RTK_BIN to run live RTK comparisons.',
      cases: []
    });

    const result = runOptionalRtkBenchmark(
      { UTK_RTK_COMMAND: 'rtk' },
      [
        {
          name: 'shell-git-status',
          toolId: 'shell.git.status',
          input: {},
          rawOutput: 'raw',
          requiredFacts: [],
          rtkSupported: true,
          rtkBaselineBytes: 8,
          rtkBaselineTokens: 2
        },
        {
          name: 'structured',
          toolId: 'tool.structured',
          input: {},
          rawOutput: { ok: true },
          requiredFacts: [],
          rtkSupported: false,
          rtkBaselineBytes: 0,
          rtkBaselineTokens: 0
        }
      ],
      () => 'live rtk'
    );

    expect(result).toEqual({
      status: 'ran',
      command: 'rtk',
      cases: [{ name: 'shell-git-status', rtkBytes: 8, rtkTokens: 2, goldenRtkTokens: 2 }]
    });
  });

  it('can run configured shell commands and reports command failures', () => {
    const fixture = {
      name: 'shell-git-status',
      toolId: 'shell.git.status',
      input: {},
      rawOutput: 'raw',
      requiredFacts: [],
      rtkSupported: true,
      rtkBaselineBytes: 8,
      rtkBaselineTokens: 2
    };
    const passthrough = `"${process.execPath}" -e "process.stdin.pipe(process.stdout)"`;
    const failed = `"${process.execPath}" -e "console.error('rtk failed'); process.exit(2)"`;
    const failedSilently = `"${process.execPath}" -e "process.exit(2)"`;

    expect(runOptionalRtkBenchmark({ UTK_RTK_COMMAND: passthrough }, [fixture])).toMatchObject({
      status: 'ran',
      cases: [{ name: 'shell-git-status', rtkBytes: 3, rtkTokens: 1, goldenRtkTokens: 2 }]
    });
    expect(runOptionalRtkBenchmark({ UTK_RTK_COMMAND: passthrough }, [{ ...fixture, rawOutput: { ok: true } }])).toMatchObject({
      status: 'ran',
      cases: [{ name: 'shell-git-status', rtkBytes: 11, rtkTokens: 3, goldenRtkTokens: 2 }]
    });
    expect(() => runOptionalRtkBenchmark({ UTK_RTK_COMMAND: failed }, [fixture])).toThrow('rtk failed');
    expect(() => runOptionalRtkBenchmark({ UTK_RTK_COMMAND: failedSilently }, [fixture])).toThrow('RTK command failed for shell-git-status');
  });
});
