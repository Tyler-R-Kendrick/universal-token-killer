import { spawnSync } from 'node:child_process';
import { RTK_PARITY_FIXTURES, type RtkParityFixture } from '../packages/evals/fixtures/rtkParityFixtures.js';
import { estimateTokens } from '../packages/evals/assertions/tokenBudgets.js';

export type BenchmarkCase = {
  name: string;
  rawSize: number;
  rtkFilteredSize: number;
  utkCompactSize: number;
  fidelity: number;
  recoverability: number;
  latencyMs: number;
  routingOverheadTokens: number;
};

export type BenchmarkSummary = {
  cases: BenchmarkCase[];
  utkMatchesOrBeatsRtk: boolean;
  rawLeakageCount: number;
};

export type OptionalRtkBenchmarkResult =
  | { status: 'skipped'; message: string; cases: [] }
  | { status: 'ran'; command: string; cases: Array<{ name: string; rtkBytes: number; rtkTokens: number; goldenRtkTokens: number }> };

export type RtkRunner = (command: string, fixture: RtkParityFixture) => string;

export function compareBaseline(raw: number, rtk: number, utk: number): Record<string, number> {
  return {
    raw,
    rtk,
    utk,
    utkVsRtkDelta: rtk - utk
  };
}

export function summarizeBenchmarks(cases: BenchmarkCase[]): BenchmarkSummary {
  return {
    cases,
    utkMatchesOrBeatsRtk: cases.every((item) => item.utkCompactSize <= item.rtkFilteredSize),
    rawLeakageCount: 0
  };
}

export function runOptionalRtkBenchmark(
  env: NodeJS.ProcessEnv = process.env,
  fixtures: RtkParityFixture[] = RTK_PARITY_FIXTURES,
  runner: RtkRunner = runRtkCommand
): OptionalRtkBenchmarkResult {
  const command = env.UTK_RTK_COMMAND ?? env.UTK_RTK_BIN;
  if (!command) {
    return { status: 'skipped', message: 'Set UTK_RTK_COMMAND or UTK_RTK_BIN to run live RTK comparisons.', cases: [] };
  }

  return {
    status: 'ran',
    command,
    cases: fixtures.filter((fixture) => fixture.rtkSupported).map((fixture) => {
      const output = runner(command, fixture);
      return {
        name: fixture.name,
        rtkBytes: Buffer.byteLength(output),
        rtkTokens: estimateTokens(output),
        goldenRtkTokens: fixture.rtkBaselineTokens
      };
    })
  };
}

export const DEFAULT_BENCHMARK_CASES = RTK_PARITY_FIXTURES.map((fixture) => fixture.name);

function runRtkCommand(command: string, fixture: RtkParityFixture): string {
  const child = spawnSync(command, {
    input: typeof fixture.rawOutput === 'string' ? fixture.rawOutput : JSON.stringify(fixture.rawOutput),
    shell: true,
    encoding: 'utf8'
  });
  if (child.status !== 0) {
    throw new Error(child.stderr || `RTK command failed for ${fixture.name}`);
  }
  return child.stdout;
}
