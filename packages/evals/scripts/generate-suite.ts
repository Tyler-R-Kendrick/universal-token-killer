import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBenchmark, type BenchmarkCase } from '../data.js';
import { SUITES_DIR } from '../paths.js';

export { SUITES_DIR };

/** The three graders, referenced from the compiled `dist/` so `agentv run` can spawn them. */
const GRADERS = [
  { name: 'composite', file: 'compositeGrader.js', weight: 1 },
  { name: 'tokens', file: 'tokenGrader.js' },
  { name: 'relevance', file: 'relevanceGrader.js' }
] as const;

/**
 * Formalize a `.jsonl` benchmark into an AgentV `.EVAL.yaml` suite — the same
 * cases, expressed as a runnable eval suite whose assertions call the UTK graders.
 */
export function renderSuiteYaml(benchmark: string, cases: BenchmarkCase[]): string {
  const lines = [
    `# Generated from packages/evals/data/${benchmark}.jsonl by packages/evals/scripts/generate-suite.ts.`,
    '# Do not edit by hand — run `npm run evals:suites --workspace @utk/evals` to refresh.',
    `suite: ${benchmark}`,
    'tests:'
  ];
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
    lines.push(
      `  - id: ${testCase.name}`,
      '    input:',
      '      - role: user',
      `        content: ${JSON.stringify(testCase.prompt)}`,
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

/** Write `suites/<benchmark>.EVAL.yaml` from `data/<benchmark>.jsonl`. */
export async function generateSuite(benchmark: string): Promise<string> {
  const cases = await loadBenchmark(benchmark);
  const yaml = renderSuiteYaml(benchmark, cases);
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
