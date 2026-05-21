import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAVEMAN_PARITY_FIXTURES, cavemanParityExpectedPayload, type CavemanParityFixture } from '../fixtures/cavemanParityFixtures.js';
import { measureCavemanParity, type CavemanParityMetrics } from '../metrics/cavemanParityMetrics.js';

export type CavemanParityReportRow = {
  name: string;
  category: string;
  useCase: string;
  testStrategy: string;
  cavemanStrength: string;
  utkApproach: string;
  cavemanBaseline: string;
  utkCandidate: string;
  metrics: CavemanParityMetrics;
};

export async function buildCavemanParityReport(): Promise<{ markdown: string; rows: CavemanParityReportRow[] }> {
  const rows: CavemanParityReportRow[] = [];
  for (const fixture of CAVEMAN_PARITY_FIXTURES) {
    rows.push({
      name: fixture.name,
      category: fixture.category,
      useCase: fixture.useCase,
      testStrategy: fixture.testStrategy,
      cavemanStrength: fixture.cavemanStrength,
      utkApproach: fixture.utkApproach,
      cavemanBaseline: fixture.cavemanBaseline,
      utkCandidate: fixture.utkCandidate,
      metrics: await measureCavemanParity({
        scenario: fixture.name,
        cavemanBaseline: fixture.cavemanBaseline,
        candidate: fixture.utkCandidate,
        requiredTerms: fixture.requiredTerms,
        exactTerms: fixture.exactTerms ?? [],
        orderedTerms: fixture.orderedTerms ?? [],
        forbiddenTerms: fixture.forbiddenTerms ?? [],
        requiredPatterns: fixture.requiredPatterns ?? [],
        forbiddenPatterns: fixture.forbiddenPatterns ?? []
      })
    });
  }

  return { rows, markdown: renderMarkdown(rows) };
}

export function renderCavemanParityEvalYaml(fixtures: CavemanParityFixture[] = CAVEMAN_PARITY_FIXTURES): string {
  const lines = ['tests:'];
  for (const fixture of fixtures) {
    lines.push(
      `  - id: ${fixture.name}`,
      '    input:',
      '      - role: user',
      `        content: ${JSON.stringify(fixture.useCase)}`,
      '    expected_output: |',
      ...cavemanParityExpectedPayload(fixture).split('\n').map((line) => `      ${line}`),
      '    assertions:',
      '      - name: caveman-parity',
      '        type: code-grader',
      '        command: ["node", "packages/evals/dist/graders/cavemanParityCodeGrader.js"]'
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(rows: CavemanParityReportRow[]): string {
  const avgRatio = average(rows.map((row) => row.metrics.candidateVsCavemanTokenRatio));
  const totalDelta = rows.reduce((sum, row) => sum + row.metrics.candidateVsCavemanTokenDelta, 0);
  const passed = rows.filter((row) => row.metrics.candidateVsCavemanTokenDelta > 0 && row.metrics.autoevalsFactScore === 1 && edgeGateScore(row.metrics) === 1).length;
  const lines = [
    '# Caveman Parity Benchmark Results',
    '',
    'Generated from `packages/evals/fixtures/cavemanParityFixtures.ts`.',
    '',
    '## Summary',
    '',
    `- Scenarios: ${rows.length}`,
    `- Outperformed caveman token baseline: ${passed}/${rows.length}`,
    `- Average UTK/caveman token ratio: ${avgRatio.toFixed(3)}`,
    `- Total estimated token savings vs caveman: ${totalDelta}`,
    `- Autoevals fact retention: ${rows.every((row) => row.metrics.autoevalsFactScore === 1) ? '1.000 all scenarios' : 'regression present'}`,
    `- Exact/order/forbidden/pattern edge gates: ${rows.every((row) => edgeGateScore(row.metrics) === 1) ? '1.000 all scenarios' : 'regression present'}`,
    '',
    '## Findings',
    '',
    '- Caveman is strongest at terse human-facing prose: review comments, commit subjects, status notes, command help, and incident handoffs.',
    '- UTK outperforms when it uses structured field order, removes labels that syntax already implies, and treats exact commands, paths, ids, errors, and secrets as protected anchors.',
    '- Safety clarity remains special: UTK can be shorter than caveman only when the irreversible consequence and mitigation stay explicit.',
    '',
    '## Results',
    '',
    '| Scenario | Category | Caveman Tokens | UTK Tokens | Delta | Ratio | Facts | Edge Gates |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => {
      const metrics = row.metrics;
      const edgeScore = edgeGateScore(metrics);
      return `| ${escapeCell(row.name)} | ${escapeCell(row.category)} | ${metrics.cavemanTokens} | ${metrics.candidateTokens} | ${metrics.candidateVsCavemanTokenDelta} | ${metrics.candidateVsCavemanTokenRatio.toFixed(3)} | ${metrics.autoevalsFactScore.toFixed(3)} | ${edgeScore.toFixed(3)} |`;
    }),
    '',
    '## Scenario Notes',
    '',
    ...rows.flatMap((row) => [
      `### ${row.name}`,
      '',
      `- Use case: ${row.useCase}`,
      `- Test strategy: ${row.testStrategy}`,
      `- Caveman good at: ${row.cavemanStrength}`,
      `- UTK attempt: ${row.utkApproach}`,
      `- Caveman: ${row.cavemanBaseline}`,
      `- UTK: ${row.utkCandidate}`,
      ''
    ])
  ];
  return `${lines.join('\n')}\n`;
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|');
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function edgeGateScore(metrics: CavemanParityMetrics): number {
  return Math.min(
    metrics.requiredTermRetentionScore,
    metrics.exactTermRetentionScore,
    metrics.orderedTermScore,
    metrics.forbiddenLeakageScore,
    metrics.requiredPatternScore,
    metrics.forbiddenPatternScore
  );
}

async function main(): Promise<void> {
  const { markdown } = await buildCavemanParityReport();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const outPath = path.join(root, 'docs', 'internal', 'caveman-parity-benchmark-results.md');
  const evalPath = path.join(root, 'packages', 'evals', 'evals', 'caveman-parity.EVAL.yaml');
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, markdown, 'utf8');
  await writeFile(evalPath, renderCavemanParityEvalYaml(), 'utf8');
  process.stdout.write(markdown);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
