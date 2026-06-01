import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TOOL_CALLING_BYPASS_CATEGORIES,
  TOOL_CALLING_BYPASS_FIXTURES,
  TOOL_CALLING_BYPASS_LEVELS,
  toolCallingBypassEvalInput,
  toolCallingBypassExpectedPayload,
  type ToolCallingBypassFixture
} from '../fixtures/toolCallingBypassFixtures.js';

export type ToolCallingBypassReport = {
  markdown: string;
  rows: ToolCallingBypassFixture[];
};

export async function buildToolCallingBypassReport(fixtures: ToolCallingBypassFixture[] = TOOL_CALLING_BYPASS_FIXTURES): Promise<ToolCallingBypassReport> {
  return { rows: fixtures, markdown: renderMarkdown(fixtures) };
}

export function renderToolCallingBypassEvalYaml(fixtures: ToolCallingBypassFixture[] = TOOL_CALLING_BYPASS_FIXTURES): string {
  const lines = ['tests:'];
  for (const fixture of fixtures) {
    lines.push(
      `  - id: ${fixture.name}`,
      '    input:',
      '      - role: user',
      `        content: ${JSON.stringify(toolCallingBypassEvalInput(fixture))}`,
      '    expected_output: |',
      ...toolCallingBypassExpectedPayload(fixture).split('\n').map((line) => `      ${line}`),
      '    assertions:',
      '      - name: tool-calling-bypass',
      '        type: code-grader',
      '        command: ["node", "packages/evals/dist/graders/toolCallingBypassCodeGrader.js"]'
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderMarkdown(fixtures: ToolCallingBypassFixture[]): string {
  const byLevel = countBy(fixtures, (fixture) => fixture.level, TOOL_CALLING_BYPASS_LEVELS);
  const byCategory = countBy(fixtures, (fixture) => fixture.category, TOOL_CALLING_BYPASS_CATEGORIES);
  const positives = fixtures.filter((fixture) => fixture.expected.shouldBypass).length;
  const negatives = fixtures.length - positives;
  const localExecution = fixtures.filter((fixture) => fixture.expected.shouldExecute).length;
  const lines = [
    '# Tool-Calling Bypass Eval Scenarios',
    '',
    'Generated from `packages/evals/fixtures/toolCallingBypassFixtures.ts`.',
    '',
    '## Summary',
    '',
    `- Scenarios: ${fixtures.length}`,
    `- Positive bypasses: ${positives}`,
    `- Fail-open / clarification cases: ${negatives}`,
    `- Local execution required: ${localExecution}`,
    `- Matching levels: ${TOOL_CALLING_BYPASS_LEVELS.join(', ')}`,
    '',
    '## Level Coverage',
    '',
    '| Level | Cases |',
    '| --- | ---: |',
    ...TOOL_CALLING_BYPASS_LEVELS.map((level) => `| ${level} | ${byLevel[level]} |`),
    '',
    '## Category Coverage',
    '',
    '| Category | Cases |',
    '| --- | ---: |',
    ...TOOL_CALLING_BYPASS_CATEGORIES.map((category) => `| ${category} | ${byCategory[category]} |`),
    '',
    '## Scenario Matrix',
    '',
    '| Scenario | Category | Level | Route | Expected | Tool | Reason |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...fixtures.map((fixture) => `| ${fixture.name} | ${fixture.category} | ${fixture.level} | ${fixture.route} | ${fixture.expected.shouldBypass ? 'bypass' : fixture.expected.expectedMissReason ?? 'fail-open'} | ${fixture.expected.expectedTool ?? ''} | ${fixture.expected.expectedReason ?? ''} |`)
  ];
  return `${lines.join('\n')}\n`;
}

function countBy<T extends string>(fixtures: ToolCallingBypassFixture[], read: (fixture: ToolCallingBypassFixture) => T, keys: readonly T[]): Record<T, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
  for (const fixture of fixtures) counts[read(fixture)] += 1;
  return counts;
}

async function main(): Promise<void> {
  const { markdown } = await buildToolCallingBypassReport();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const outPath = path.join(root, 'docs', 'internal', 'tool-calling-bypass-eval-scenarios.md');
  const evalPath = path.join(root, 'packages', 'evals', 'evals', 'tool-calling-bypass.EVAL.yaml');
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, markdown, 'utf8');
  await writeFile(evalPath, renderToolCallingBypassEvalYaml(), 'utf8');
  process.stdout.write(markdown);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
