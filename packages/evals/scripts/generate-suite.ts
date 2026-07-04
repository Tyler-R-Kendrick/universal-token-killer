import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeEvalYaml } from '@agentv/sdk';
import { BENCHMARKS } from '../benchmarks.js';
import { buildArmSuiteFromRoot, buildToolCallingSuite } from '../agentv/suiteBuilder.js';
import { PACKAGE_ROOT, SUITES_DIR } from '../paths.js';

export { SUITES_DIR };

/**
 * Serialize the AgentV SDK suites (agentv/suiteBuilder.ts — the same
 * definitions the `evals/*.eval.ts` files export) to canonical snake_case
 * `suites/<benchmark>.EVAL.yaml` via the SDK's `serializeEvalYaml`. The YAML
 * artifacts are committed so the suites are inspectable and runnable without
 * loading TypeScript; `agentv eval` accepts either form.
 */
export function renderSuiteYaml(benchmark: string): string {
  const header =
    `# Generated from packages/evals/data/${benchmark}.jsonl by packages/evals/scripts/generate-suite.ts\n` +
    '# (AgentV SDK `serializeEvalYaml` over agentv/suiteBuilder.ts — same definition as evals/*.eval.ts).\n' +
    '# Do not edit by hand — run `npm run evals:suites --workspace @utk/evals` to refresh.\n';
  const suite = benchmark === 'tool-calling-efficiency'
    ? buildToolCallingSuite({ root: PACKAGE_ROOT })
    : buildArmSuiteFromRoot(PACKAGE_ROOT, benchmark);
  return header + serializeEvalYaml(suite);
}

/** Write `suites/<benchmark>.EVAL.yaml` from the SDK suite definition. */
export async function generateSuite(benchmark: string): Promise<string> {
  const yaml = renderSuiteYaml(benchmark);
  await mkdir(SUITES_DIR, { recursive: true });
  const outPath = path.join(SUITES_DIR, `${benchmark}.EVAL.yaml`);
  await writeFile(outPath, yaml, 'utf8');
  return outPath;
}

export const ALL_SUITES: string[] = [...BENCHMARKS.map((b) => b.name), 'tool-calling-efficiency'];

async function main(): Promise<void> {
  const benchmarks = process.argv.slice(2);
  const targets = benchmarks.length > 0 ? benchmarks : ALL_SUITES;
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
