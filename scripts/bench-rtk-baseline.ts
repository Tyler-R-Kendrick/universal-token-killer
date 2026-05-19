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

export const DEFAULT_BENCHMARK_CASES = [
  'large-json-object',
  'large-json-array-of-objects',
  'deeply-nested-api-style-response',
  'repeated-text-logs',
  'tabular-text',
  'markdown-report',
  'synthetic-vscode-copilot-tool-output',
  'rtk-supported-command-output-fixtures'
];
