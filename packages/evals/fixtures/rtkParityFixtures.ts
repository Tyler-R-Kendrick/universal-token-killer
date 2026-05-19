import { estimateTokens } from '../assertions/tokenBudgets.js';

export type RequiredFact =
  | { kind: 'literal'; value: string }
  | { kind: 'jsonPath'; path: string; expected: unknown };

export type RtkParityFixture = {
  name: string;
  toolId: string;
  input: unknown;
  rawOutput: unknown;
  requiredFacts: RequiredFact[];
  rtkSupported: boolean;
  rtkBaselineBytes: number;
  rtkBaselineTokens: number;
  rtkNotes?: string;
};

function supportedFixture(params: Omit<RtkParityFixture, 'rtkSupported' | 'rtkBaselineBytes' | 'rtkBaselineTokens'> & { baselineText: string }): RtkParityFixture {
  return {
    ...params,
    rtkSupported: true,
    rtkBaselineBytes: Buffer.byteLength(params.baselineText),
    rtkBaselineTokens: estimateTokens(params.baselineText)
  };
}

function generalizedFixture(params: Omit<RtkParityFixture, 'rtkSupported' | 'rtkBaselineBytes' | 'rtkBaselineTokens' | 'rtkNotes'>): RtkParityFixture {
  const rawText = typeof params.rawOutput === 'string' ? params.rawOutput : JSON.stringify(params.rawOutput, null, 2);
  const rawTokens = estimateTokens(rawText);
  return {
    ...params,
    rtkSupported: false,
    rtkBaselineBytes: 0,
    rtkBaselineTokens: Math.floor(rawTokens * 0.35),
    rtkNotes: 'No direct RTK equivalent; compare UTK compact output against raw-output savings threshold.'
  };
}

const repeatedLogs = Array.from({ length: 24 }, (_, index) => `[2026-05-19T08:${String(index).padStart(2, '0')}:00Z] INFO worker-${index % 3} processed batch-${index} status=ok`).join('\n');

export const RTK_PARITY_FIXTURES: RtkParityFixture[] = [
  supportedFixture({
    name: 'shell-git-status',
    toolId: 'shell.git.status',
    input: { command: 'git status --short' },
    rawOutput: ' M README.md\n?? packages/evals/fixtures/rtkParityFixtures.ts\n?? packages/evals/metrics/rtkParityMetrics.ts\n',
    requiredFacts: [
      { kind: 'literal', value: 'M README.md' },
      { kind: 'literal', value: 'rtkParityFixtures.ts' }
    ],
    baselineText: 'git status summary: one modified README and two untracked RTK parity metric files'
  }),
  supportedFixture({
    name: 'shell-git-diff',
    toolId: 'shell.git.diff',
    input: { command: 'git diff -- packages/evals' },
    rawOutput: [
      'diff --git a/packages/evals/evals/rtk-parity.eval.ts b/packages/evals/evals/rtk-parity.eval.ts',
      '+  shell-git-diff comparative metrics',
      '+  arbitrary structured tool output fixture',
      '-  placeholder parity list'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'shell-git-diff comparative metrics' },
      { kind: 'literal', value: 'placeholder parity list' }
    ],
    baselineText: 'git diff summary: rtk parity eval changed; added comparative metrics; removed placeholder'
  }),
  supportedFixture({
    name: 'shell-gh-pr-list',
    toolId: 'shell.gh.pr.list',
    input: { command: 'gh pr list --json number,title,headRefName' },
    rawOutput: JSON.stringify([
      { number: 17, title: 'Add comparative RTK metrics', headRefName: 'codex/rtk-metrics' },
      { number: 18, title: 'Harden Copilot hook mediation', headRefName: 'codex/copilot-hook' }
    ], null, 2),
    requiredFacts: [
      { kind: 'literal', value: 'Add comparative RTK metrics' },
      { kind: 'literal', value: 'codex/copilot-hook' }
    ],
    baselineText: 'gh prs: #17 Add comparative RTK metrics; #18 Harden Copilot hook mediation'
  }),
  supportedFixture({
    name: 'shell-rg',
    toolId: 'shell.rg',
    input: { command: 'rg mediateToolExecution packages' },
    rawOutput: [
      'packages/core/src/mediation/toolMediator.ts:export async function mediateToolExecution(params: {',
      'packages/copilot-hook/src/copilotHook.ts:  const result = await mediateToolExecution({',
      'packages/core/test/toolMediator.serialization.test.ts:    const result = await mediateToolExecution({'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'toolMediator.ts' },
      { kind: 'literal', value: 'copilotHook.ts' }
    ],
    baselineText: 'rg mediateToolExecution: core mediator, copilot hook, serializer test'
  }),
  supportedFixture({
    name: 'shell-vitest',
    toolId: 'shell.vitest',
    input: { command: 'vitest run packages/evals' },
    rawOutput: 'RUN v4.1.6 C:/src/utk/packages/evals\nTest Files 2 passed (2)\nTests 3 passed (3)\nDuration 889ms\n',
    requiredFacts: [
      { kind: 'literal', value: 'Test Files 2 passed (2)' },
      { kind: 'literal', value: 'Tests 3 passed (3)' }
    ],
    baselineText: 'vitest: 2 files passed, 3 tests passed'
  }),
  supportedFixture({
    name: 'shell-tsc',
    toolId: 'shell.tsc',
    input: { command: 'tsc -p tsconfig.json --noEmit' },
    rawOutput: '> @utk/evals@0.1.0 typecheck\n> tsc -p tsconfig.json --noEmit\n',
    requiredFacts: [
      { kind: 'literal', value: '@utk/evals@0.1.0 typecheck' },
      { kind: 'literal', value: 'tsc -p tsconfig.json --noEmit' }
    ],
    baselineText: 'tsc summary: @utk/evals workspace typecheck completed with no TypeScript diagnostics'
  }),
  generalizedFixture({
    name: 'large-json-object',
    toolId: 'tool.large-object',
    input: { resource: 'users' },
    rawOutput: {
      users: Array.from({ length: 12 }, (_, index) => ({ id: index + 1, name: `user-${index + 1}`, role: index % 2 === 0 ? 'admin' : 'reader', active: true })),
      nextCursor: 'cursor-12'
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.users[0].name', expected: 'user-1' },
      { kind: 'jsonPath', path: '$.nextCursor', expected: 'cursor-12' }
    ]
  }),
  generalizedFixture({
    name: 'large-json-array',
    toolId: 'tool.large-array',
    input: { resource: 'events' },
    rawOutput: Array.from({ length: 32 }, (_, index) => ({ eventId: `evt-${index}`, type: 'build', status: index === 31 ? 'failed' : 'passed', workflow: 'ci', branch: 'codex/rtk-metrics' })),
    requiredFacts: [
      { kind: 'literal', value: '"status": "failed"' },
      { kind: 'literal', value: '"eventId": "evt-0"' }
    ]
  }),
  generalizedFixture({
    name: 'deeply-nested-response',
    toolId: 'tool.deep-response',
    input: { include: ['runs', 'artifacts'] },
    rawOutput: {
      repository: {
        name: 'universal-token-killer',
        workflows: [
          {
            name: 'ci',
            runs: Array.from({ length: 10 }, (_, index) => ({
              id: 991 + index,
              conclusion: index === 9 ? 'success' : 'neutral',
              artifacts: [{ name: index === 9 ? 'coverage' : `trace-${index}`, size: 1842 + index }]
            }))
          }
        ]
      }
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.repository.name', expected: 'universal-token-killer' },
      { kind: 'jsonPath', path: '$.repository.workflows[0].runs[9].artifacts[0].name', expected: 'coverage' }
    ]
  }),
  generalizedFixture({
    name: 'repeated-text-logs',
    toolId: 'tool.logs',
    input: { log: 'worker' },
    rawOutput: repeatedLogs,
    requiredFacts: [
      { kind: 'literal', value: 'worker-0 processed batch-0' },
      { kind: 'literal', value: 'processed batch-23 status=ok' }
    ]
  }),
  generalizedFixture({
    name: 'tabular-text',
    toolId: 'tool.table',
    input: { format: 'table' },
    rawOutput: [
      'NAME       STATUS   TOKENS',
      'core       pass     124',
      'hook       pass     98',
      'evals      pass     142',
      'routing    pass     88',
      'schema     pass     131',
      'toon       pass     76',
      'config     pass     55',
      'metrics    pass     109'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'core       pass' },
      { kind: 'literal', value: 'evals      pass' }
    ]
  }),
  generalizedFixture({
    name: 'markdown-report',
    toolId: 'tool.markdown-report',
    input: { report: 'summary' },
    rawOutput: '# UTK Report\n\n## Findings\n\n- TOON serializer is enabled by default.\n- Copilot hook mediates observable tool output.\n',
    requiredFacts: [
      { kind: 'literal', value: 'TOON serializer is enabled by default' },
      { kind: 'literal', value: 'Copilot hook mediates observable tool output' }
    ]
  }),
  generalizedFixture({
    name: 'arbitrary-structured-tool-output',
    toolId: 'tool.structured',
    input: { operation: 'read-index' },
    rawOutput: {
      result: {
        kind: 'index',
        entries: Array.from({ length: 12 }, (_, index) => ({
          path: index === 0 ? 'src/index.ts' : `src/module-${index}.ts`,
          symbols: index === 0 ? ['mediateToolExecution', 'loadUtkConfig'] : [`symbol${index}`, `helper${index}`],
          language: 'typescript'
        }))
      },
      diagnostics: []
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.result.entries[0].path', expected: 'src/index.ts' },
      { kind: 'jsonPath', path: '$.result.entries[0].symbols[1]', expected: 'loadUtkConfig' }
    ]
  }),
  generalizedFixture({
    name: 'synthetic-copilot-tool-output',
    toolId: 'copilot.synthetic-tool',
    input: { toolName: 'workspace.symbols' },
    rawOutput: {
      toolCallId: 'call-123',
      output: {
        symbols: Array.from({ length: 10 }, (_, index) => ({
          name: index === 0 ? 'processCopilotToolHookPayload' : `syntheticSymbol${index}`,
          file: index === 0 ? 'packages/copilot-hook/src/copilotHook.ts' : `packages/copilot-hook/src/generated-${index}.ts`
        }))
      }
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.toolCallId', expected: 'call-123' },
      { kind: 'jsonPath', path: '$.output.symbols[0].file', expected: 'packages/copilot-hook/src/copilotHook.ts' }
    ]
  })
];
