import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBenchmark, loadProvenance, type BenchmarkCase, type BenchmarkProvenance } from '../data.js';
import { SUITES_DIR } from '../paths.js';

export { SUITES_DIR };

/** The three graders, referenced from the compiled `dist/` so `agentv run` can spawn them. */
const GRADERS = [
  { name: 'composite', file: 'compositeGrader.js', weight: 1 },
  { name: 'tokens', file: 'tokenGrader.js' },
  { name: 'relevance', file: 'relevanceGrader.js' }
] as const;

/** YAML flow scalar (JSON strings are valid YAML and quote safely). */
function y(value: string): string {
  return JSON.stringify(value);
}

/**
 * Formalize a `.jsonl` benchmark into an AgentV `.EVAL.yaml` suite — the same
 * cases, expressed as a runnable eval suite whose assertions call the UTK graders.
 * When a provenance manifest is present it is emitted as suite-level and per-test
 * `metadata` (informational fields, per AgentV's benchmark-provenance guidance).
 */
export function renderSuiteYaml(benchmark: string, cases: BenchmarkCase[], provenance?: BenchmarkProvenance | null): string {
  const lines = [
    `# Generated from packages/evals/data/${benchmark}.jsonl by packages/evals/scripts/generate-suite.ts.`,
    '# Do not edit by hand — run `npm run evals:suites --workspace @utk/evals` to refresh.',
    `name: ${provenance?.name ?? benchmark}`
  ];
  if (provenance) {
    lines.push(
      `version: ${y(provenance.version)}`,
      `license: ${y(provenance.license)}`,
      `tags: [${provenance.tags.map(y).join(', ')}]`,
      '# Provenance is informational — AgentV does not execute these fields.',
      'provenance:',
      `  origin: ${y(provenance.origin)}`,
      `  authored_by: ${y(provenance.authored_by)}`,
      `  description: ${y(provenance.description)}`,
      `  disclaimer: ${y(provenance.disclaimer)}`,
      '  related_benchmarks:',
      ...provenance.related_benchmarks.flatMap((bench) => [
        `    - id: ${y(bench.id)}`,
        `      name: ${y(bench.name)}`,
        ...(bench.org ? [`      org: ${y(bench.org)}`] : []),
        `      url: ${y(bench.url)}`,
        `      relation: ${y(bench.relation)}`,
        ...(bench.note ? [`      note: ${y(bench.note)}`] : [])
      ])
    );
  }
  lines.push('tests:');

  for (const testCase of cases) {
    const expected = JSON.stringify(
      {
        prompt: testCase.prompt,
        rawOutput: testCase.rawOutput,
        requiredFacts: testCase.requiredFacts,
        irrelevantFacts: testCase.irrelevantFacts
      },
      null,
      2
    );
    const relatedId = provenance?.category_benchmark[testCase.category];
    const related = provenance?.related_benchmarks.find((bench) => bench.id === relatedId);
    lines.push(
      `  - id: ${testCase.name}`,
      '    input:',
      '      - role: user',
      `        content: ${y(testCase.prompt)}`,
      '    metadata:',
      `      category: ${y(testCase.category)}`,
      `      tool_id: ${y(testCase.toolId)}`,
      ...(provenance
        ? [
            `      origin: ${y(provenance.origin)}`,
            `      authored_by: ${y(provenance.authored_by)}`,
            ...(related ? [`      related_benchmark: ${y(related.id)}`, `      related_benchmark_url: ${y(related.url)}`] : [])
          ]
        : []),
      '    expected_output: |',
      ...expected.split('\n').map((line) => `      ${line}`),
      '    assertions:',
      ...GRADERS.flatMap((grader) => [
        `      - name: ${grader.name}`,
        '        type: script',
        `        command: ["node", "packages/evals/dist/graders/${grader.file}"]`,
        ...('weight' in grader ? [`        weight: ${grader.weight}`] : [])
      ])
    );
  }
  return `${lines.join('\n')}\n`;
}

/** Write `suites/<benchmark>.EVAL.yaml` from `data/<benchmark>.jsonl` (+ its provenance manifest). */
export async function generateSuite(benchmark: string): Promise<string> {
  const [cases, provenance] = await Promise.all([loadBenchmark(benchmark), loadProvenance(benchmark)]);
  const yaml = renderSuiteYaml(benchmark, cases, provenance);
  await mkdir(SUITES_DIR, { recursive: true });
  const outPath = path.join(SUITES_DIR, `${benchmark}.EVAL.yaml`);
  await writeFile(outPath, yaml, 'utf8');
  return outPath;
}

async function main(): Promise<void> {
  const benchmarks = process.argv.slice(2);
  const targets = benchmarks.length > 0 ? benchmarks : ['tool-output'];
  for (const benchmark of targets) {
    const outPath = await generateSuite(benchmark);
    process.stdout.write(`Wrote ${path.relative(process.cwd(), outPath)}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
