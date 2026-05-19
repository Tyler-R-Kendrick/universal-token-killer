import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { completeBashLikeToolInvocation } from '@utk/core';
import { BASH_REWRITE_FIXTURES } from '../fixtures/bashRewriteFixtures.js';
import { assertBashRewrite, measureBashRewrite } from '../metrics/bashRewriteMetrics.js';

const TOOL_DEFINITIONS = [
  {
    toolId: 'bash.git.status',
    command: 'git',
    description: 'Inspect repository status',
    parameters: [
      { name: 'subcommand', kind: 'positional' as const, completions: ['status'], required: true },
      { name: 'short', kind: 'flag' as const, flag: '--short', completions: ['--short'], description: 'Use concise status output' }
    ]
  },
  {
    toolId: 'bash.rg',
    command: 'rg',
    description: 'Search text with ripgrep',
    parameters: [
      { name: 'pattern', kind: 'positional' as const, completions: ['mediateToolExecution'], required: true },
      { name: 'path', kind: 'positional' as const, completions: ['packages'], required: true },
      { name: 'globFlag', kind: 'flag' as const, flag: '-g', completions: ['*.ts'], description: 'Limit to TypeScript files' }
    ]
  }
];

describe('bash rewrite comparative metrics', () => {
  it('calculates accuracy and token deltas against RTK-style baselines', () => {
    const fixture = BASH_REWRITE_FIXTURES[0]!;
    const metrics = measureBashRewrite({
      fixture,
      actualCommand: fixture.expectedCommand,
      actualArgv: fixture.expectedArgv,
      templateText: 'tiny template'
    });

    expect(metrics.exactInvocationMatch).toBe(true);
    expect(metrics.argumentAccuracyScore).toBe(1);
    expect(metrics.utkVsRtkTokenDelta).toBeGreaterThan(0);
    expect(metrics.utkVsRtkTokenRatio).toBeLessThan(1);
  });

  it.each(BASH_REWRITE_FIXTURES)('$name beats the RTK baseline for CLI rewrite scenarios', async (fixture) => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `utk-bash-eval-${fixture.name}-`));
    const result = await completeBashLikeToolInvocation({
      workspaceRoot,
      request: fixture.request,
      tools: TOOL_DEFINITIONS
    });

    const assertion = assertBashRewrite({
      fixture,
      actualCommand: result.invocation.command,
      actualArgv: result.invocation.argv,
      templateText: await readFile(result.templatePath, 'utf8')
    });

    expect(assertion.failures, assertion.failures.join('\n')).toEqual([]);
    expect(assertion.passed).toBe(true);
    expect(result.guidance.used).toBe(true);
  });
});
