import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProvenance, type BenchmarkProvenance } from '../data.js';
import { runSuite, type BenchmarkReport, type SuiteResult, type TechniqueReport } from '../harness.js';
import { renderSuiteMarkdown } from '../report.js';
import { renderParetoSvg } from '../pareto.js';
import { REPO_ROOT, RESULTS_DIR } from '../paths.js';
import { generateSuite } from './generate-suite.js';

export { RESULTS_DIR };
const DOCS_DIR = path.join(REPO_ROOT, 'docs', 'features', 'evals');
const CHARTS_DIR = path.join(DOCS_DIR, 'charts');
// Data-version stamp, NOT a run timestamp: it is pinned so re-running the fully
// deterministic suite does not churn the committed artifact, and bumped manually
// whenever the datasets, arms, or scoring change (which changes the numbers).
const SUITE_TIMESTAMP = '2026-07-04T00:00:00Z';

/** Run the whole suite (every benchmark × baseline + competitors + UTK). */
export async function runAll(): Promise<SuiteResult> {
  return runSuite();
}

/** Run the suite and persist per-benchmark results, Pareto charts, AgentV suites, and the summary doc. */
export async function runAndPersist(): Promise<SuiteResult> {
  const suite = await runAll();
  await mkdir(RESULTS_DIR, { recursive: true });
  await mkdir(CHARTS_DIR, { recursive: true });

  const provenance: Record<string, BenchmarkProvenance | null> = {};
  const charts: Record<string, string> = {};

  for (const report of suite.benchmarks) {
    provenance[report.benchmark] = await loadProvenance(report.benchmark);
    // Per-benchmark results carry the full 19-field per-case logs for every arm.
    await writeFile(path.join(RESULTS_DIR, `${report.benchmark}.json`), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const chartFile = `${report.benchmark}-pareto.svg`;
    await writeFile(path.join(CHARTS_DIR, chartFile), renderParetoSvg(report), 'utf8');
    charts[report.benchmark] = `charts/${chartFile}`;
    // Keep the formal AgentV suite in sync with the dataset + provenance.
    await generateSuite(report.benchmark);
  }

  await writeFile(path.join(RESULTS_DIR, 'summary.json'), `${JSON.stringify(summarize(suite), null, 2)}\n`, 'utf8');
  await mkdir(DOCS_DIR, { recursive: true });
  await writeFile(path.join(DOCS_DIR, 'benchmark-summary.md'), renderSuiteMarkdown(suite, { provenance, charts, timestamp: SUITE_TIMESTAMP }), 'utf8');

  return suite;
}

function summarize(suite: SuiteResult): unknown {
  return {
    model: suite.model,
    benchmarks: suite.benchmarks.map((report) => ({
      benchmark: report.benchmark,
      kind: report.kind,
      cases: report.cases,
      frontier: report.frontier,
      techniques: [report.baseline, ...report.competitors, report.utk].map(techniqueSummary)
    }))
  };
}

function techniqueSummary(tech: TechniqueReport): unknown {
  return {
    technique: tech.technique,
    label: tech.label,
    onFrontier: tech.onFrontier,
    visibleTokens: tech.primary.visibleTokens,
    tokenReduction: tech.primary.tokenReduction,
    taskSuccessRate: tech.primary.taskSuccessRate,
    avgQuality: tech.primary.avgQuality,
    costPerTask: tech.primary.costPerTask,
    costPerSuccess: Number.isFinite(tech.primary.costPerSuccess) ? tech.primary.costPerSuccess : null,
    p95LatencyMs: tech.primary.p95LatencyMs,
    unsafeToolErrors: tech.primary.unsafeToolErrors,
    headlines: tech.headlines,
    gatePassed: tech.gate?.passed ?? null
  };
}

function printBenchmark(report: BenchmarkReport): void {
  process.stdout.write(`\n${report.title} (${report.kind}, ${report.cases} cases) — frontier: ${report.frontier.join(', ') || '—'}\n`);
  for (const tech of [report.baseline, ...report.competitors, report.utk]) {
    const p = tech.primary;
    const star = tech.onFrontier ? '★' : ' ';
    process.stdout.write(
      `  ${star} ${tech.label.padEnd(30)} vis=${String(p.visibleTokens).padStart(5)} red=${(p.tokenReduction * 100).toFixed(0).padStart(3)}% succ=${(p.taskSuccessRate * 100).toFixed(0).padStart(3)}% $${p.costPerTask.toFixed(5)} p95=${String(Math.round(p.p95LatencyMs)).padStart(4)}ms\n`
    );
  }
}

async function main(): Promise<void> {
  const suite = await runAndPersist();
  for (const report of suite.benchmarks) printBenchmark(report);
  process.stdout.write('\nWrote results/, charts/, suites/, and docs/features/evals/benchmark-summary.md.\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
