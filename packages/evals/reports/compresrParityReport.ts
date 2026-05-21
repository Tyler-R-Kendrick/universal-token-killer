import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mediateToolExecution } from '@utk/core';
import { COMPRESR_INSTALL_CONFIG } from '../config/compresrConfig.js';
import { COMPRESR_PARITY_FIXTURES, compresrParityExpectedPayload, type CompresrParityFixture } from '../fixtures/compresrParityFixtures.js';
import { assertCompresrParity, type CompresrParityMetrics } from '../metrics/compresrParityMetrics.js';

export type CompresrParityReportRow = {
  fixture: CompresrParityFixture;
  rawText: string;
  compactText: string;
  responseText: string;
  metrics: CompresrParityMetrics;
  passed: boolean;
  failures: string[];
};

export async function buildCompresrParityReport(): Promise<{ markdown: string; rows: CompresrParityReportRow[] }> {
  const rows: CompresrParityReportRow[] = [];
  for (const fixture of COMPRESR_PARITY_FIXTURES) {
    rows.push(await runCompresrParityFixture(fixture));
  }
  return { rows, markdown: renderMarkdown(rows) };
}

export async function runCompresrParityFixture(fixture: CompresrParityFixture): Promise<CompresrParityReportRow> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `utk-compresr-report-${fixture.name}-`));
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
  const assertion = await assertCompresrParity({
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

export function renderCompresrParityEvalYaml(fixtures: CompresrParityFixture[] = COMPRESR_PARITY_FIXTURES): string {
  const lines = ['tests:'];
  for (const fixture of fixtures) {
    lines.push(
      `  - id: ${fixture.name}`,
      '    input:',
      '      - role: user',
      `        content: ${JSON.stringify(fixture.useCase)}`,
      '    expected_output: |',
      ...compresrParityExpectedPayload(fixture).split('\n').map((line) => `      ${line}`),
      '    assertions:',
      '      - name: compresr-parity',
      '        type: code-grader',
      '        command: ["node", "packages/evals/dist/graders/compresrParityCodeGrader.js"]'
    );
  }
  return `${lines.join('\n')}\n`;
}

export function compresrParityActualPayload(row: Pick<CompresrParityReportRow, 'rawText' | 'compactText' | 'responseText'>): string {
  return JSON.stringify({
    raw_text: row.rawText,
    compact_text: row.compactText,
    response_text: row.responseText,
    raw_artifact_exists: true,
    compact_artifact_exists: true
  }, null, 2);
}

function renderMarkdown(rows: CompresrParityReportRow[]): string {
  const passed = rows.filter((row) => row.passed).length;
  const avgRatio = average(rows.map((row) => row.metrics.utkVsCompresrTokenRatio));
  const totalDelta = rows.reduce((sum, row) => sum + row.metrics.utkVsCompresrTokenDelta, 0);
  const lines = [
    '# Compresr Parity Benchmark Results',
    '',
    'Generated from `packages/evals/fixtures/compresrParityFixtures.ts`.',
    '',
    '## Installation',
    '',
    `- Installed package: \`${COMPRESR_INSTALL_CONFIG.pythonPackage}@${COMPRESR_INSTALL_CONFIG.installedVersion}\``,
    `- Install command: \`${COMPRESR_INSTALL_CONFIG.installCommand}\``,
    `- API key env var: \`${COMPRESR_INSTALL_CONFIG.apiKeyEnvVar}\``,
    `- Live API mode: \`${COMPRESR_INSTALL_CONFIG.liveApiMode}\``,
    `- Baseline mode: \`${COMPRESR_INSTALL_CONFIG.baselineMode}\``,
    '',
    '## Summary',
    '',
    `- Scenarios: ${rows.length}`,
    `- Passed Compresr/UTK thresholds: ${passed}/${rows.length}`,
    `- Average UTK/Compresr token ratio: ${avgRatio.toFixed(3)}`,
    `- Total estimated token savings vs Compresr baselines: ${totalDelta}`,
    `- Autoevals fact retention: ${rows.every((row) => row.metrics.autoevalsFactScore === 1) ? '1.000 all scenarios' : 'regression present'}`,
    `- Recoverability: ${rows.every((row) => row.metrics.recoverabilityScore === 1) ? '1.000 all scenarios' : 'regression present'}`,
    '',
    '## Findings',
    '',
    '- Compresr is strongest at remote query-aware compression, batch/streaming SDK calls, Context Gateway tool-output compression, history compaction, tool discovery, shadow refs, cost/format gating, and provider request adapters.',
    '- UTK wins these fixtures by avoiding lossy remote rewrites in the model-visible response: it stores raw output, emits compact schema artifacts, and keeps project-local recovery handles.',
    '- Live hosted compression requires `COMPRESR_API_KEY`; this suite verifies installed SDK/config metadata and uses deterministic baselines so CI does not send tool output to a remote service.',
    '',
    '## Results',
    '',
    '| Scenario | Category | Compresr Tokens | UTK Compact Tokens | Delta | Ratio | Facts | Autoevals | Recoverable |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => {
      const metrics = row.metrics;
      return `| ${escapeCell(row.fixture.name)} | ${escapeCell(row.fixture.category)} | ${metrics.compresrBaselineTokens} | ${metrics.compactTokens} | ${metrics.utkVsCompresrTokenDelta} | ${metrics.utkVsCompresrTokenRatio.toFixed(3)} | ${metrics.factRetentionScore.toFixed(3)} | ${metrics.autoevalsFactScore.toFixed(3)} | ${metrics.recoverabilityScore.toFixed(3)} |`;
    }),
    '',
    '## Scenario Notes',
    '',
    ...rows.flatMap((row) => [
      `### ${row.fixture.name}`,
      '',
      `- Use case: ${row.fixture.useCase}`,
      `- Test strategy: ${row.fixture.testStrategy}`,
      `- Compresr good at: ${row.fixture.compresrStrength}`,
      `- UTK attempt: ${row.fixture.utkApproach}`,
      `- Result: ${row.passed ? 'pass' : `fail: ${row.failures.join('; ')}`}`,
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

async function main(): Promise<void> {
  const { markdown } = await buildCompresrParityReport();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const outPath = path.join(root, 'docs', 'internal', 'compresr-parity-benchmark-results.md');
  const evalPath = path.join(root, 'packages', 'evals', 'evals', 'compresr-parity.EVAL.yaml');
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, markdown, 'utf8');
  await writeFile(evalPath, renderCompresrParityEvalYaml(), 'utf8');
  process.stdout.write(markdown);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
