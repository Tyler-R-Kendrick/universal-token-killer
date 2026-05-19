import type { BashRewriteFixture } from '../metrics/bashRewriteMetrics.js';

export const BASH_REWRITE_FIXTURES: BashRewriteFixture[] = [
  {
    name: 'git-status-short',
    request: 'run git status --short',
    expectedCommand: 'git status --short',
    expectedArgv: ['git', 'status', '--short'],
    rtkBaselineTokens: 48
  },
  {
    name: 'ripgrep-typescript-symbol',
    request: 'rg search packages -g *.ts for mediateToolExecution',
    expectedCommand: 'rg mediateToolExecution packages -g *.ts',
    expectedArgv: ['rg', 'mediateToolExecution', 'packages', '-g', '*.ts'],
    rtkBaselineTokens: 64
  }
];
