import { describe, expect, it } from 'vitest';
import { compareBaseline, DEFAULT_BENCHMARK_CASES, summarizeBenchmarks } from './bench-rtk-baseline.js';

describe('RTK benchmark helpers', () => {
  it('compares baselines and summarizes pass/fail outcomes', () => {
    expect(compareBaseline(100, 40, 30)).toEqual({ raw: 100, rtk: 40, utk: 30, utkVsRtkDelta: 10 });
    expect(summarizeBenchmarks([{ name: 'ok', rawSize: 100, rtkFilteredSize: 40, utkCompactSize: 40, fidelity: 1, recoverability: 1, latencyMs: 1, routingOverheadTokens: 1 }]).utkMatchesOrBeatsRtk).toBe(true);
    expect(summarizeBenchmarks([{ name: 'bad', rawSize: 100, rtkFilteredSize: 40, utkCompactSize: 41, fidelity: 1, recoverability: 1, latencyMs: 1, routingOverheadTokens: 1 }]).utkMatchesOrBeatsRtk).toBe(false);
    expect(DEFAULT_BENCHMARK_CASES).toContain('rtk-supported-command-output-fixtures');
  });
});
