import { defineAssertion } from '@agentv/sdk';

/**
 * N-run tool-calling token-efficiency grader.
 *
 * The target's output is a ToolCallingEpisodeReport JSON
 * (packages/evals/agentv/toolCallingEfficiency.ts) with per-run token counts
 * for the three phases (selection / invocation [+ schema generation] / output
 * [+ recovery]) produced by REAL UTK code paths.
 *
 * What is asserted:
 * - the episode ran the expected number of runs;
 * - for the `utk` arm: runs 2..n hit the REAL planner cache (a functional
 *   regression check on UTK's caching, not an outcome comparison), and the
 *   steady-state average total does not exceed run 1 (schema-generation
 *   overhead amortizes — the property UTK's design promises);
 * - for the `baseline` arm: informational pass (its numbers exist so
 *   `agentv compare` can do the honest cross-arm comparison; this assertion
 *   never scores one arm against the other).
 */
export default defineAssertion(({ output, metadata }) => {
  const report = parseReport(output);
  if (!report) {
    return { pass: false, score: 0, assertions: [{ text: 'Target output is not a ToolCallingEpisodeReport JSON', passed: false }] };
  }
  const expectedRuns = asNumber((metadata as Record<string, unknown> | undefined)?.runs);
  const checks: Array<{ text: string; passed: boolean }> = [];

  const ranAll = expectedRuns === undefined || report.runs.length === expectedRuns;
  checks.push({ text: `Episode ran ${report.runs.length}${expectedRuns !== undefined ? `/${expectedRuns}` : ''} runs`, passed: ranAll });

  if (report.arm === 'utk') {
    const laterRuns = report.runs.slice(1);
    const cacheWarm = laterRuns.length === 0 || laterRuns.every((run) => run.cache_hit);
    checks.push({ text: 'Planner cache hits on every run after run 1 (real .utk cache)', passed: cacheWarm });
    const amortized = report.steady_state_avg_total <= report.run1_total;
    checks.push({
      text: `Steady-state avg total (${report.steady_state_avg_total}) <= run 1 total (${report.run1_total})`,
      passed: amortized
    });
    const schemaGenOnlyOnce = laterRuns.every((run) => run.schema_generation_tokens === 0);
    checks.push({ text: 'Schema-generation overhead charged only on cache-miss runs', passed: schemaGenOnlyOnce });
  } else {
    checks.push({ text: `Baseline episode recorded for comparison (avg total ${report.avg_total})`, passed: true });
  }

  const passed = checks.every((check) => check.passed);
  return {
    pass: passed,
    assertions: checks,
    details: {
      arm: report.arm,
      run1_total: report.run1_total,
      steady_state_avg_total: report.steady_state_avg_total,
      avg_total: report.avg_total,
      per_run_totals: report.runs.map((run) => run.total_tokens),
      cache_hits: report.runs.map((run) => run.cache_hit),
      model: report.model
    }
  };
});

type EpisodeReport = {
  arm: string;
  runs: Array<{ total_tokens: number; cache_hit: boolean; schema_generation_tokens: number }>;
  run1_total: number;
  steady_state_avg_total: number;
  avg_total: number;
  model: string;
};

function parseReport(output: string | null): EpisodeReport | null {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output) as Partial<EpisodeReport>;
    if (typeof parsed.arm === 'string' && Array.isArray(parsed.runs) && typeof parsed.run1_total === 'number') {
      return parsed as EpisodeReport;
    }
    return null;
  } catch {
    return null;
  }
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
