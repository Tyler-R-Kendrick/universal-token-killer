import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPARISONS } from '../comparison/index.js';
import { loadProvenance } from '../data.js';
import { runBenchmark, type BenchmarkResult } from '../harness.js';
import { renderBenchmarkMarkdown } from '../report.js';
import { REPO_ROOT, RESULTS_DIR } from '../paths.js';
import { generateSuite } from './generate-suite.js';

export { RESULTS_DIR };
const DOCS_DIR = path.join(REPO_ROOT, 'docs', 'features', 'evals');

/** Run the whole benchmark (baseline + every competitor + UTK). */
export async function runAll(): Promise<BenchmarkResult> {
  return runBenchmark(COMPARISONS);
}

/** Run the benchmark and persist results, suite, and docs so they stay in sync. */
export async function runAndPersist(): Promise<BenchmarkResult> {
  const result = await runAll();
  const provenance = await loadProvenance(result.benchmark);

  await mkdir(RESULTS_DIR, { recursive: true });
  await writeFile(path.join(RESULTS_DIR, `${result.benchmark}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(path.join(RESULTS_DIR, 'summary.json'), `${JSON.stringify(summarize(result), null, 2)}\n`, 'utf8');

  await generateSuite(result.benchmark);

  await mkdir(DOCS_DIR, { recursive: true });
  await writeFile(path.join(DOCS_DIR, 'benchmark-summary.md'), renderBenchmarkMarkdown(result, provenance), 'utf8');

  return result;
}

function summarize(result: BenchmarkResult): unknown {
  const baselineTokens = result.arms.find((arm) => arm.arm === 'baseline')?.totals.visibleTokens ?? 0;
  return {
    benchmark: result.benchmark,
    cases: result.cases,
    leaderboard: [...result.arms]
      .sort((a, b) => b.totals.visibleTokens - a.totals.visibleTokens)
      .map((arm) => ({
        technique: arm.label,
        competitor: arm.competitor,
        tokens: arm.totals.visibleTokens,
        changePct: baselineTokens === 0 ? 0 : Math.round((arm.totals.visibleTokens / baselineTokens - 1) * 100),
        factsKept: `${arm.totals.passed}/${arm.totals.cases}`,
        avgComposite: arm.totals.avgComposite
      }))
  };
}

async function main(): Promise<void> {
  const result = await runAndPersist();
  const baselineTokens = result.arms.find((arm) => arm.arm === 'baseline')?.totals.visibleTokens ?? 0;
  for (const arm of [...result.arms].sort((a, b) => b.totals.visibleTokens - a.totals.visibleTokens)) {
    const change = baselineTokens === 0 ? '—' : `${Math.round((arm.totals.visibleTokens / baselineTokens - 1) * 100)}%`;
    process.stdout.write(`${arm.label.padEnd(30)} tokens=${String(arm.totals.visibleTokens).padStart(5)} change=${change.padStart(5)} facts=${arm.totals.passed}/${arm.totals.cases}\n`);
  }
  process.stdout.write('\nWrote results/, suites/, and docs/features/evals/benchmark-summary.md.\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
