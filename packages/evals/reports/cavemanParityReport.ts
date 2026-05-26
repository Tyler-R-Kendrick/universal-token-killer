import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAVEMAN_MODES, CAVEMAN_PARITY_FIXTURES, cavemanBaselineForMode, cavemanParityExpectedPayload, type CavemanMode, type CavemanParityFixture } from '../fixtures/cavemanParityFixtures.js';
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

export type CavemanModeReportRow = CavemanParityReportRow & {
  mode: CavemanMode;
};

export async function buildCavemanParityReport(): Promise<{ markdown: string; rows: CavemanParityReportRow[]; modeRows: CavemanModeReportRow[] }> {
  const rows: CavemanParityReportRow[] = [];
  const modeRows: CavemanModeReportRow[] = [];
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

    for (const mode of CAVEMAN_MODES) {
      const cavemanBaseline = cavemanBaselineForMode(fixture, mode);
      modeRows.push({
        name: fixture.name,
        mode,
        category: fixture.category,
        useCase: fixture.useCase,
        testStrategy: fixture.testStrategy,
        cavemanStrength: fixture.cavemanStrength,
        utkApproach: fixture.utkApproach,
        cavemanBaseline,
        utkCandidate: fixture.utkCandidate,
        metrics: await measureCavemanParity({
          scenario: `${fixture.name}-${mode}`,
          cavemanBaseline,
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
  }

  return { rows, modeRows, markdown: renderMarkdown(rows, modeRows) };
}

export function renderCavemanParityEvalYaml(fixtures: CavemanParityFixture[] = CAVEMAN_PARITY_FIXTURES): string {
  const lines = ['tests:'];
  for (const fixture of fixtures) {
    for (const mode of CAVEMAN_MODES) {
      lines.push(
        `  - id: ${fixture.name}-${mode}`,
        '    input:',
        '      - role: user',
        `        content: ${JSON.stringify(`${fixture.useCase} Respond in caveman ${mode} mode.`)}`,
        '    expected_output: |',
        ...cavemanParityExpectedPayload(fixture, mode).split('\n').map((line) => `      ${line}`),
        '    assertions:',
        '      - name: caveman-parity',
        '        type: code-grader',
        '        command: ["node", "packages/evals/dist/graders/cavemanParityCodeGrader.js"]'
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(rows: CavemanParityReportRow[], modeRows: CavemanModeReportRow[]): string {
  const avgRatio = average(rows.map((row) => row.metrics.candidateVsCavemanTokenRatio));
  const totalDelta = rows.reduce((sum, row) => sum + row.metrics.candidateVsCavemanTokenDelta, 0);
  const passed = rows.filter((row) => row.metrics.candidateVsCavemanTokenDelta > 0 && row.metrics.autoevalsFactScore === 1 && edgeGateScore(row.metrics) === 1).length;
  const modePassed = modeRows.filter((row) => row.metrics.candidateVsCavemanTokenDelta > 0 && row.metrics.autoevalsFactScore === 1 && edgeGateScore(row.metrics) === 1).length;
  const modeSummaries = CAVEMAN_MODES.map((mode) => summarizeMode(mode, modeRows.filter((row) => row.mode === mode)));
  const avgModeRatio = average(modeSummaries.map((summary) => summary.ratio));
  const totalModeDelta = modeSummaries.reduce((sum, summary) => sum + summary.delta, 0);
  const lines = [
    '# Caveman Parity Benchmark Results',
    '',
    'Generated from `packages/evals/fixtures/cavemanParityFixtures.ts`.',
    '',
    '## Summary',
    '',
    `- Scenarios: ${rows.length}`,
    `- Mode evaluations: ${modeRows.length} (${CAVEMAN_MODES.join(', ')})`,
    `- Outperformed caveman token baseline: ${passed}/${rows.length}`,
    `- Outperformed caveman mode baselines: ${modePassed}/${modeRows.length}`,
    `- Average UTK/caveman token ratio: ${avgRatio.toFixed(3)}`,
    `- Total estimated token savings vs caveman: ${totalDelta}`,
    `- Average UTK/caveman mode token ratio: ${avgModeRatio.toFixed(3)}`,
    `- Total estimated token savings vs caveman modes: ${totalModeDelta}`,
    `- Autoevals fact retention: ${rows.every((row) => row.metrics.autoevalsFactScore === 1) ? '1.000 all scenarios' : 'regression present'}`,
    `- Exact/order/forbidden/pattern edge gates: ${rows.every((row) => edgeGateScore(row.metrics) === 1) ? '1.000 all scenarios' : 'regression present'}`,
    '',
    '## Findings',
    '',
    '- Caveman is strongest at terse human-facing prose: review comments, commit subjects, status notes, command help, and incident handoffs.',
    '- UTK outperforms when it uses structured field order, removes labels that syntax already implies, and treats exact commands, paths, ids, errors, and secrets as protected anchors.',
    '- Safety clarity remains special: UTK can be shorter than caveman only when the irreversible consequence and mitigation stay explicit.',
    '- Mode coverage now runs the same caveman suite across independent lite, full, ultra, and wenyan competitor baselines so style compression cannot hide fact drift.',
    '',
    '## Mode Results',
    '',
    '| Mode | Cases | Caveman Tokens | UTK Tokens | Delta | Ratio | Facts | Edge Gates |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...modeSummaries.map((summary) => `| ${summary.mode} | ${summary.cases} | ${summary.cavemanTokens} | ${summary.utkTokens} | ${summary.delta} | ${summary.ratio.toFixed(3)} | ${summary.factScore.toFixed(3)} | ${summary.edgeScore.toFixed(3)} |`),
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

function summarizeMode(mode: CavemanMode, rows: CavemanModeReportRow[]): {
  mode: CavemanMode;
  cases: number;
  cavemanTokens: number;
  utkTokens: number;
  delta: number;
  ratio: number;
  factScore: number;
  edgeScore: number;
} {
  const cavemanTokens = rows.reduce((sum, row) => sum + row.metrics.cavemanTokens, 0);
  const utkTokens = rows.reduce((sum, row) => sum + row.metrics.candidateTokens, 0);
  return {
    mode,
    cases: rows.length,
    cavemanTokens,
    utkTokens,
    delta: cavemanTokens - utkTokens,
    ratio: cavemanTokens === 0 ? 0 : utkTokens / cavemanTokens,
    factScore: average(rows.map((row) => row.metrics.autoevalsFactScore)),
    edgeScore: average(rows.map((row) => edgeGateScore(row.metrics)))
  };
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
