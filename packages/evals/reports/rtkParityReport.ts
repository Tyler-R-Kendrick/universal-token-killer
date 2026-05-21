import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mediateToolExecution } from '@utk/core';
import { RTK_PARITY_FIXTURES, rtkParityExpectedPayload, type RtkParityFixture } from '../fixtures/rtkParityFixtures.js';
import { assertRtkParityWithAutoevals, type RtkParityAutoevalsMetrics } from '../metrics/rtkParityMetrics.js';

export type RtkParityReportRow = {
  fixture: RtkParityFixture;
  rawText: string;
  compactText: string;
  responseText: string;
  metrics: RtkParityAutoevalsMetrics;
  passed: boolean;
  failures: string[];
};

export async function buildRtkParityReport(): Promise<{ markdown: string; rows: RtkParityReportRow[] }> {
  const rows: RtkParityReportRow[] = [];
  for (const fixture of RTK_PARITY_FIXTURES) {
    rows.push(await runRtkParityFixture(fixture));
  }
  return { rows, markdown: renderMarkdown(rows) };
}

export async function runRtkParityFixture(fixture: RtkParityFixture): Promise<RtkParityReportRow> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `utk-rtk-report-${fixture.name}-`));
  const result = await mediateToolExecution({
    workspaceRoot,
    toolId: fixture.toolId,
    input: fixture.input,
    execute: async () => fixture.rawOutput
  });
  const raw = await readFile(result.rawPath);
  const compactText = await readFile(result.serializedPath, 'utf8');
  await access(result.rawPath);
  await access(result.serializedPath);
  const assertion = await assertRtkParityWithAutoevals({
    fixture,
    rawText: raw.toString(),
    compactText,
    responseText: result.response,
    rawArtifactExists: true,
    compactArtifactExists: true
  });
  return {
    fixture,
    rawText: raw.toString(),
    compactText,
    responseText: result.response,
    metrics: assertion.metrics,
    passed: assertion.passed,
    failures: assertion.failures
  };
}

export function renderRtkParityEvalYaml(fixtures: RtkParityFixture[] = RTK_PARITY_FIXTURES): string {
  const lines = ['tests:'];
  for (const fixture of fixtures) {
    lines.push(
      `  - id: ${fixture.name}`,
      '    input:',
      '      - role: user',
      `        content: ${JSON.stringify(fixture.useCase ?? `Run RTK parity scenario ${fixture.name}`)}`,
      '    expected_output: |',
      ...rtkParityExpectedPayload(fixture).split('\n').map((line) => `      ${line}`),
      '    assertions:',
      '      - name: rtk-parity',
      '        type: code-grader',
      '        command: ["node", "packages/evals/dist/graders/rtkParityCodeGrader.js"]'
    );
  }
  return `${lines.join('\n')}\n`;
}

export function rtkParityActualPayload(row: Pick<RtkParityReportRow, 'rawText' | 'compactText' | 'responseText'>): string {
  return JSON.stringify({
    raw_text: row.rawText,
    compact_text: row.compactText,
    response_text: row.responseText,
    raw_artifact_exists: true,
    compact_artifact_exists: true
  }, null, 2);
}

function renderMarkdown(rows: RtkParityReportRow[]): string {
  const passed = rows.filter((row) => row.passed).length;
  const supportedRows = rows.filter((row) => row.fixture.rtkSupported);
  const avgSupportedRatio = average(supportedRows.map((row) => row.metrics.utkVsRtkTokenRatio));
  const totalSupportedDelta = supportedRows.reduce((sum, row) => sum + row.metrics.utkVsRtkTokenDelta, 0);
  const lines = [
    '# RTK Parity Benchmark Results',
    '',
    'Generated from `packages/evals/fixtures/rtkParityFixtures.ts`.',
    '',
    '## Summary',
    '',
    `- Scenarios: ${rows.length}`,
    `- RTK-supported shell scenarios: ${supportedRows.length}`,
    `- Generalized tool-output scenarios: ${rows.length - supportedRows.length}`,
    `- Passed RTK/UTK thresholds: ${passed}/${rows.length}`,
    `- Average UTK/RTK token ratio for RTK-supported scenarios: ${avgSupportedRatio.toFixed(3)}`,
    `- Total estimated token savings vs RTK-supported baselines: ${totalSupportedDelta}`,
    `- Autoevals fact retention: ${rows.every((row) => row.metrics.autoevalsFactScore === 1) ? '1.000 all scenarios' : 'regression present'}`,
    `- Recoverability: ${rows.every((row) => row.metrics.recoverabilityScore === 1) ? '1.000 all scenarios' : 'regression present'}`,
    '',
    '## Findings',
    '',
    '- RTK is strongest on common shell outputs: git, grep, test runners, package managers, process/network tables, cloud CLIs, Docker, kubectl, curl, audit logs, and compact tables.',
    '- UTK wins by not rewriting facts into chat. It stores raw output, emits compact schema-backed artifacts, and keeps response text as recoverable handles.',
    '- Generalized tool outputs are where UTK moves beyond RTK: nested JSON, Copilot tool objects, SARIF, OpenAPI, GraphQL, CSV, XML, HAR, traces, lockfiles, protocol logs, coverage, metrics, calendars, manifests, binary payloads, multipart bodies, ANSI output, Unicode tables, and secret-bearing logs.',
    '',
    '## Results',
    '',
    '| Scenario | Category | Kind | RTK Tokens | UTK Compact Tokens | Delta | Ratio | Facts | Autoevals | Recoverable |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => {
      const metrics = row.metrics;
      return `| ${escapeCell(row.fixture.name)} | ${escapeCell(row.fixture.category ?? categoryOf(row.fixture))} | ${row.fixture.rtkSupported ? 'RTK-supported' : 'generalized'} | ${metrics.rtkTokens} | ${metrics.utkCompactTokens} | ${metrics.utkVsRtkTokenDelta} | ${metrics.utkVsRtkTokenRatio.toFixed(3)} | ${metrics.factRetentionScore.toFixed(3)} | ${metrics.autoevalsFactScore.toFixed(3)} | ${metrics.recoverabilityScore.toFixed(3)} |`;
    }),
    '',
    '## Scenario Notes',
    '',
    ...rows.flatMap((row) => [
      `### ${row.fixture.name}`,
      '',
      `- Use case: ${row.fixture.useCase ?? row.fixture.name}`,
      `- Test strategy: ${row.fixture.testStrategy ?? 'RTK parity threshold with recoverability and required fact retention.'}`,
      `- RTK good at: ${row.fixture.rtkStrength ?? (row.fixture.rtkSupported ? 'Shell output compression.' : 'No direct equivalent.')}`,
      `- UTK attempt: ${row.fixture.utkApproach ?? 'Raw artifact recovery plus compact schema output.'}`,
      `- Result: ${row.passed ? 'pass' : `fail: ${row.failures.join('; ')}`}`,
      ''
    ])
  ];
  return `${lines.join('\n')}\n`;
}

function categoryOf(fixture: RtkParityFixture): string {
  return fixture.toolId.split('.')[1] ?? 'tool output';
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|');
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main(): Promise<void> {
  const { markdown } = await buildRtkParityReport();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const outPath = path.join(root, 'docs', 'internal', 'rtk-parity-benchmark-results.md');
  const evalPath = path.join(root, 'packages', 'evals', 'evals', 'rtk-parity.EVAL.yaml');
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, markdown, 'utf8');
  await writeFile(evalPath, renderRtkParityEvalYaml(), 'utf8');
  process.stdout.write(markdown);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
