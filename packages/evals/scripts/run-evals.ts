import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPARISONS } from '../comparison/index.js';
import { runComparison, type ComparisonResult } from '../harness.js';
import { renderComparisonMarkdown, renderSummaryMarkdown } from '../report.js';
import { REPO_ROOT, RESULTS_DIR } from '../paths.js';
import { generateSuite } from './generate-suite.js';

export { RESULTS_DIR };
const DOCS_DIR = path.join(REPO_ROOT, 'docs', 'internal');

/** Run every comparison, returning the results in report order. */
export async function runAll(): Promise<ComparisonResult[]> {
  return Promise.all(COMPARISONS.map((comparison) => runComparison(comparison)));
}

/** Run all comparisons and persist results, suites, and docs so they stay in sync. */
export async function runAndPersist(): Promise<ComparisonResult[]> {
  const results = await runAll();

  await mkdir(RESULTS_DIR, { recursive: true });
  for (const result of results) {
    await writeFile(path.join(RESULTS_DIR, `${result.competitor}.json`), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  await writeFile(path.join(RESULTS_DIR, 'summary.json'), `${JSON.stringify(summarize(results), null, 2)}\n`, 'utf8');

  const benchmarks = [...new Set(results.map((result) => result.benchmark))];
  for (const benchmark of benchmarks) {
    await generateSuite(benchmark);
  }

  await mkdir(DOCS_DIR, { recursive: true });
  for (const result of results) {
    await writeFile(path.join(DOCS_DIR, `${result.competitor}-benchmark-results.md`), renderComparisonMarkdown(result), 'utf8');
  }
  await writeFile(path.join(DOCS_DIR, 'benchmark-summary.md'), renderSummaryMarkdown(results), 'utf8');

  return results;
}

function summarize(results: ComparisonResult[]): unknown {
  return {
    benchmark: results[0]?.benchmark ?? null,
    competitors: results.map((result) => ({
      competitor: result.competitor,
      label: result.label,
      cases: result.cases,
      baselineTokens: result.arms.baseline.totals.visibleTokens,
      competitorTokens: result.arms.competitor.totals.visibleTokens,
      utkTokens: result.arms.utk.totals.visibleTokens,
      utkFactsKept: `${result.arms.utk.totals.passed}/${result.arms.utk.totals.cases}`,
      utkAvgComposite: result.arms.utk.totals.avgComposite,
      competitorAvgComposite: result.arms.competitor.totals.avgComposite
    }))
  };
}

async function main(): Promise<void> {
  const results = await runAndPersist();
  for (const result of results) {
    const utk = result.arms.utk.totals;
    const competitor = result.arms.competitor.totals;
    process.stdout.write(
      `${result.competitor.padEnd(10)} baseline=${result.arms.baseline.totals.visibleTokens} ` +
        `competitor=${competitor.visibleTokens} utk=${utk.visibleTokens} ` +
        `utk-facts=${utk.passed}/${utk.cases} utk-composite=${utk.avgComposite}\n`
    );
  }
  process.stdout.write(`\nWrote results/, suites/, and docs/internal/ artifacts.\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
