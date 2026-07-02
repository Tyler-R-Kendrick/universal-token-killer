import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PONYTAIL_LADDER_FIXTURES,
  PONYTAIL_MODES,
  PONYTAIL_PARITY_FIXTURES,
  PONYTAIL_PARITY_MACROS,
  ponytailBaselineForMode,
  ponytailParityExpectedPayload,
  type PonytailLadderFixture,
  type PonytailMode,
  type PonytailParityFixture
} from '../fixtures/ponytailParityFixtures.js';
import {
  measurePonytailLadder,
  measurePonytailParity,
  type PonytailLadderMetrics,
  type PonytailParityMetrics
} from '../metrics/ponytailParityMetrics.js';

export type PonytailParityReportRow = {
  name: string;
  category: string;
  useCase: string;
  testStrategy: string;
  ponytailStrength: string;
  utkApproach: string;
  metrics: PonytailParityMetrics;
};

export type PonytailModeReportRow = PonytailParityReportRow & {
  mode: PonytailMode;
};

export type PonytailLadderReportRow = {
  fixture: PonytailLadderFixture;
  metrics: PonytailLadderMetrics;
};

export async function buildPonytailParityReport(): Promise<{
  markdown: string;
  rows: PonytailParityReportRow[];
  modeRows: PonytailModeReportRow[];
  ladderRows: PonytailLadderReportRow[];
}> {
  const rows: PonytailParityReportRow[] = [];
  const modeRows: PonytailModeReportRow[] = [];
  for (const fixture of PONYTAIL_PARITY_FIXTURES) {
    rows.push({ ...describeFixture(fixture), metrics: await measureFixture(fixture, fixture.ponytailBaseline, fixture.name) });
    for (const mode of PONYTAIL_MODES) {
      modeRows.push({
        ...describeFixture(fixture),
        mode,
        metrics: await measureFixture(fixture, ponytailBaselineForMode(fixture, mode), `${fixture.name}-${mode}`)
      });
    }
  }

  const ladderRows: PonytailLadderReportRow[] = [];
  for (const fixture of PONYTAIL_LADDER_FIXTURES) {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'utk-ponytail-ladder-'));
    try {
      for (const [relativePath, content] of Object.entries(fixture.files)) {
        const filePath = path.join(workspaceRoot, relativePath);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, content, 'utf8');
      }
      const macros = (fixture.macroNames ?? []).map((name) => PONYTAIL_PARITY_MACROS[name]!);
      ladderRows.push({ fixture, metrics: await measurePonytailLadder(workspaceRoot, fixture, macros) });
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  }

  return { rows, modeRows, ladderRows, markdown: renderMarkdown(rows, modeRows, ladderRows) };
}

export function renderPonytailParityEvalYaml(fixtures: PonytailParityFixture[] = PONYTAIL_PARITY_FIXTURES): string {
  const lines = ['tests:'];
  for (const fixture of fixtures) {
    for (const mode of PONYTAIL_MODES) {
      lines.push(
        `  - id: ${fixture.name}-${mode}`,
        '    input:',
        '      - role: user',
        `        content: ${JSON.stringify(`${fixture.request} Emit a UTK min emission (@minmap patch plus min code) against the ponytail ${mode} arm.`)}`,
        '    expected_output: |',
        ...ponytailParityExpectedPayload(fixture, mode).split('\n').map((line) => `      ${line}`),
        '    assertions:',
        '      - name: ponytail-parity',
        '        type: code-grader',
        '        command: ["node", "packages/evals/dist/graders/ponytailParityCodeGrader.js"]'
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

function describeFixture(fixture: PonytailParityFixture): Omit<PonytailParityReportRow, 'metrics'> {
  return {
    name: fixture.name,
    category: fixture.category,
    useCase: fixture.useCase,
    testStrategy: fixture.testStrategy,
    ponytailStrength: fixture.ponytailStrength,
    utkApproach: fixture.utkApproach
  };
}

async function measureFixture(fixture: PonytailParityFixture, ponytailBaseline: string, scenario: string): Promise<PonytailParityMetrics> {
  return await measurePonytailParity({
    scenario,
    verboseBaseline: fixture.verboseBaseline,
    ponytailBaseline,
    minEmission: fixture.utkMinEmission,
    expectedPretty: fixture.utkPrettyExpected,
    requiredTerms: fixture.requiredTerms,
    mapEntries: fixture.mapEntries,
    macros: fixture.macroNames.map((name) => PONYTAIL_PARITY_MACROS[name]!),
    maxTokenRatio: fixture.maxTokenRatio
  });
}

function renderMarkdown(
  rows: PonytailParityReportRow[],
  modeRows: PonytailModeReportRow[],
  ladderRows: PonytailLadderReportRow[]
): string {
  const avgRatio = average(rows.map((row) => row.metrics.utkVsPonytailTokenRatio));
  const avgVerboseRatio = average(rows.map((row) => row.metrics.utkVsVerboseTokenRatio));
  const totalDelta = rows.reduce((sum, row) => sum + row.metrics.utkVsPonytailTokenDelta, 0);
  const totalVerboseDelta = rows.reduce((sum, row) => sum + row.metrics.utkVsVerboseTokenDelta, 0);
  const passed = rows.filter((row) => row.metrics.utkVsPonytailTokenDelta > 0 && qualityGateScore(row.metrics) === 1).length;
  const modePassed = modeRows.filter((row) => row.metrics.utkVsPonytailTokenDelta > 0 && qualityGateScore(row.metrics) === 1).length;
  const ladderPassed = ladderRows.filter((row) => row.metrics.ladderCorrectnessScore === 1).length;
  const modeSummaries = PONYTAIL_MODES.map((mode) => summarizeMode(mode, modeRows.filter((row) => row.mode === mode)));
  const lines = [
    '# Ponytail Parity Benchmark Results',
    '',
    'Generated from `packages/evals/fixtures/ponytailParityFixtures.ts`.',
    '',
    '## Summary',
    '',
    `- Emission scenarios: ${rows.length}`,
    `- Mode evaluations: ${modeRows.length} (${PONYTAIL_MODES.join(', ')})`,
    `- Ladder evaluations: ${ladderRows.length}`,
    `- Outperformed ponytail full baseline: ${passed}/${rows.length}`,
    `- Outperformed ponytail mode baselines: ${modePassed}/${modeRows.length}`,
    `- Ladder decisions correct: ${ladderPassed}/${ladderRows.length}`,
    `- Average UTK-min/ponytail token ratio: ${avgRatio.toFixed(3)}`,
    `- Average UTK-min/verbose token ratio: ${avgVerboseRatio.toFixed(3)}`,
    `- Total estimated token savings vs ponytail: ${totalDelta}`,
    `- Total estimated token savings vs verbose baseline: ${totalVerboseDelta}`,
    `- Round-trip fidelity / parse validity / min leakage / fact retention: ${rows.every((row) => qualityGateScore(row.metrics) === 1) ? '1.000 all scenarios' : 'regression present'}`,
    '',
    '## Findings',
    '',
    '- Ponytail is strongest at refusing unnecessary code: its ladder and minimal implementations are already terse, so single-shot emissions win by structure, not prose.',
    '- UTK outperforms by changing how the remaining code is written: repeated identifiers become single-token min-ids declared once in a @minmap patch, and shared idioms collapse into macro calls.',
    '- The UTK arm is measured including its @minmap patch overhead — the declared pretty names are paid once, so savings concentrate where identifiers repeat and grow when a session reuses the map across emissions.',
    '- Users only ever see the deterministic pretty expansion; every scenario gates on round-trip fidelity, parse validity, min leakage, and fact retention at 1.0 — token wins do not count when a gate drops.',
    '- All arms are measured without indentation so deltas reflect symbols and idioms rather than whitespace; token counts use the repo-standard `ceil(chars/4)` estimate.',
    '',
    '## Mode Results',
    '',
    '| Mode | Cases | Ponytail Tokens | UTK Min Tokens | Delta | Ratio | Quality Gates |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...modeSummaries.map(
      (summary) =>
        `| ${summary.mode} | ${summary.cases} | ${summary.ponytailTokens} | ${summary.utkTokens} | ${summary.delta} | ${summary.ratio.toFixed(3)} | ${summary.qualityScore.toFixed(3)} |`
    ),
    '',
    '## Ladder Results',
    '',
    '| Scenario | Expected Rung | Selected Rung | Strategy | Correct |',
    '| --- | ---: | ---: | --- | ---: |',
    ...ladderRows.map(
      (row) =>
        `| ${escapeCell(row.fixture.name)} | ${row.fixture.expectedRung} | ${row.metrics.selectedRung ?? '-'} | ${row.metrics.strategy} | ${row.metrics.ladderCorrectnessScore.toFixed(3)} |`
    ),
    '',
    '## Results',
    '',
    '| Scenario | Category | Verbose Tokens | Ponytail Tokens | UTK Min Tokens | Delta | Ratio | Quality Gates |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => {
      const metrics = row.metrics;
      return `| ${escapeCell(row.name)} | ${escapeCell(row.category)} | ${metrics.verboseTokens} | ${metrics.ponytailTokens} | ${metrics.utkMinTokens} | ${metrics.utkVsPonytailTokenDelta} | ${metrics.utkVsPonytailTokenRatio.toFixed(3)} | ${qualityGateScore(metrics).toFixed(3)} |`;
    }),
    '',
    '## Scenario Notes',
    '',
    ...rows.flatMap((row) => [
      `### ${row.name}`,
      '',
      `- Use case: ${row.useCase}`,
      `- Test strategy: ${row.testStrategy}`,
      `- Ponytail good at: ${row.ponytailStrength}`,
      `- UTK attempt: ${row.utkApproach}`,
      ''
    ]),
    '## Validation Commands',
    '',
    '```bash',
    'npm run bench:ponytail --workspace @utk/evals',
    'npm run report:ponytail --workspace @utk/evals',
    '```',
    '',
    '## Maintenance Notes',
    '',
    '- Keep this report, `docs/internal/benchmark-summary.md`, and `docs/evals.md` in sync per `packages/evals/AGENTS.md`.',
    '- The ponytail arms are hand-authored deterministic baselines modeled on the published Ponytail rung examples; Ponytail itself was not installed (see `docs/internal/ponytail-competitive-research.md`).'
  ];
  return `${lines.join('\n')}\n`;
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|');
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeMode(
  mode: PonytailMode,
  rows: PonytailModeReportRow[]
): {
  mode: PonytailMode;
  cases: number;
  ponytailTokens: number;
  utkTokens: number;
  delta: number;
  ratio: number;
  qualityScore: number;
} {
  const ponytailTokens = rows.reduce((sum, row) => sum + row.metrics.ponytailTokens, 0);
  const utkTokens = rows.reduce((sum, row) => sum + row.metrics.utkMinTokens, 0);
  return {
    mode,
    cases: rows.length,
    ponytailTokens,
    utkTokens,
    delta: ponytailTokens - utkTokens,
    ratio: ponytailTokens === 0 ? 0 : utkTokens / ponytailTokens,
    qualityScore: average(rows.map((row) => qualityGateScore(row.metrics)))
  };
}

function qualityGateScore(metrics: PonytailParityMetrics): number {
  return Math.min(
    metrics.roundTripFidelityScore,
    metrics.parseValidityScore,
    metrics.minLeakageScore,
    metrics.requiredTermRetentionScore,
    metrics.autoevalsFactScore
  );
}

async function main(): Promise<void> {
  const { markdown } = await buildPonytailParityReport();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const outPath = path.join(root, 'docs', 'internal', 'ponytail-parity-benchmark-results.md');
  const evalPath = path.join(root, 'packages', 'evals', 'evals', 'ponytail-parity.EVAL.yaml');
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, markdown, 'utf8');
  await writeFile(evalPath, renderPonytailParityEvalYaml(), 'utf8');
  process.stdout.write(markdown);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
