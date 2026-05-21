import { estimateTokens } from '../assertions/tokenBudgets.js';

export type RequiredFact =
  | { kind: 'literal'; value: string }
  | { kind: 'jsonPath'; path: string; expected: unknown };

export type RtkParityFixture = {
  name: string;
  category?: string;
  useCase?: string;
  testStrategy?: string;
  rtkStrength?: string;
  utkApproach?: string;
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
    category: 'Git status',
    useCase: 'Summarize dirty worktree state without losing modified and untracked files.',
    testStrategy: 'Shell status fixture with literal file retention and strict RTK token win.',
    rtkStrength: 'RTK is good at tiny shell status summaries.',
    utkApproach: 'Store raw status, emit schema-backed compact artifact, and keep response handle-only.',
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
    category: 'Git diff',
    useCase: 'Compress patch output while preserving added and removed lines.',
    testStrategy: 'Diff hunk literal retention with strict RTK token win.',
    rtkStrength: 'RTK condenses diff intent well.',
    utkApproach: 'Preserve raw diff artifact and beat RTK with compact shape metadata.',
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
    category: 'GitHub CLI',
    useCase: 'Summarize PR list output without losing titles or branch names.',
    testStrategy: 'JSON CLI literal retention with strict RTK token win.',
    rtkStrength: 'RTK makes CLI list output readable.',
    utkApproach: 'Persist JSON output and expose compact object schema handles.',
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
    category: 'Search output',
    useCase: 'Compress code search hits while preserving relevant file names.',
    testStrategy: 'ripgrep hit retention with strict RTK token win.',
    rtkStrength: 'RTK summarizes repetitive search output.',
    utkApproach: 'Keep raw search results recoverable and send compact text shape.',
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
    category: 'Test output',
    useCase: 'Summarize passing test output with file and test counts.',
    testStrategy: 'Vitest count retention with strict RTK token win.',
    rtkStrength: 'RTK trims noisy test runner chrome.',
    utkApproach: 'Artifact the full runner output and keep compact line/count envelope.',
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
    category: 'Typecheck output',
    useCase: 'Represent clean TypeScript output without inventing diagnostics.',
    testStrategy: 'Clean command retention with strict RTK token win.',
    rtkStrength: 'RTK can state no diagnostics tersely.',
    utkApproach: 'Preserve exact command output and expose a compact no-diagnostic artifact.',
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
    category: 'JSON object',
    useCase: 'Compress large object payloads while retaining cursor and first record.',
    testStrategy: 'JSONPath fact retention plus raw-output savings threshold.',
    rtkStrength: 'RTK has no native structured-object advantage here.',
    utkApproach: 'Use object key summary plus recoverable raw JSON artifact.',
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
    category: 'JSON array',
    useCase: 'Compress long arrays while retaining sentinel first and failed last events.',
    testStrategy: 'Literal JSON sentinel retention plus raw-output savings threshold.',
    rtkStrength: 'RTK-style shell summarization is weaker on arbitrary arrays.',
    utkApproach: 'Summarize array cardinality and store raw array for fact recovery.',
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
    category: 'Nested JSON',
    useCase: 'Compress nested workflow data while preserving deep artifact reference.',
    testStrategy: 'Deep JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK tends to flatten nested context.',
    utkApproach: 'Schema-infer nested raw output and keep compact object keys.',
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
    category: 'Logs',
    useCase: 'Compress repeated log lines while retaining first and last batch facts.',
    testStrategy: 'Boundary log literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK is strong at repeated shell logs.',
    utkApproach: 'Use line/count text envelope and raw log artifact recovery.',
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
    category: 'Tables',
    useCase: 'Compress text tables while preserving row associations.',
    testStrategy: 'Table row literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK is good at CLI table summaries.',
    utkApproach: 'Avoid restating table rows in chat; keep raw table artifact.',
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
    category: 'Markdown',
    useCase: 'Compress report prose while retaining findings.',
    testStrategy: 'Markdown bullet retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can shorten markdown-ish terminal output.',
    utkApproach: 'Store full report and expose schema/compact artifact handles.',
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
    category: 'Structured tools',
    useCase: 'Compress arbitrary symbol index output while retaining entry path and symbol.',
    testStrategy: 'Structured JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK is not designed for non-shell tool objects.',
    utkApproach: 'Schema-backed object summary plus raw artifact recovery.',
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
    category: 'Copilot tools',
    useCase: 'Compress Copilot tool output while preserving call id and first symbol file.',
    testStrategy: 'Copilot JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK only sees text-like CLI output.',
    utkApproach: 'Mediate Copilot tool objects directly with recoverable raw JSON.',
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
  }),
  supportedFixture({
    name: 'shell-npm-audit',
    category: 'Security audit',
    useCase: 'Compress npm audit output while preserving severity counts.',
    testStrategy: 'Security count literal retention with strict RTK token win.',
    rtkStrength: 'RTK is effective at short audit summaries.',
    utkApproach: 'Keep full audit output recoverable and send compact text envelope.',
    toolId: 'shell.npm.audit',
    input: { command: 'npm audit --audit-level=moderate' },
    rawOutput: [
      '# npm audit report',
      'minimist  <=0.2.3',
      'Severity: moderate',
      'Prototype Pollution in minimist',
      '1 moderate severity vulnerability',
      '0 critical vulnerabilities'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '1 moderate severity vulnerability' },
      { kind: 'literal', value: '0 critical vulnerabilities' }
    ],
    baselineText: 'npm audit summary: 1 moderate vulnerability, 0 critical vulnerabilities'
  }),
  supportedFixture({
    name: 'shell-pytest-failure',
    category: 'Test failures',
    useCase: 'Compress pytest failure output while retaining failing test and assertion.',
    testStrategy: 'Failure id and assertion literal retention with strict RTK token win.',
    rtkStrength: 'RTK can reduce traceback noise to failing test and reason.',
    utkApproach: 'Store full failure trace, send only compact text metadata.',
    toolId: 'shell.pytest',
    input: { command: 'pytest tests/test_router.py::test_schema_route' },
    rawOutput: [
      'FAILED tests/test_router.py::test_schema_route - AssertionError: expected schema shell.git-status.v1',
      'E assert "fallback.v1" == "shell.git-status.v1"',
      '1 failed, 12 passed in 3.14s'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'tests/test_router.py::test_schema_route' },
      { kind: 'literal', value: 'expected schema shell.git-status.v1' }
    ],
    baselineText: 'pytest failed: tests/test_router.py::test_schema_route expected shell.git-status.v1'
  }),
  supportedFixture({
    name: 'shell-docker-ps',
    category: 'Container status',
    useCase: 'Compress docker ps table while preserving unhealthy container.',
    testStrategy: 'Container row literal retention with strict RTK token win.',
    rtkStrength: 'RTK is strong at terminal tables.',
    utkApproach: 'Preserve raw table and expose compact line/count metadata.',
    toolId: 'shell.docker.ps',
    input: { command: 'docker ps --format table' },
    rawOutput: [
      'CONTAINER ID   IMAGE          STATUS                    NAMES',
      'a1b2c3d4e5f6   utk-web        Up 2 hours (healthy)      utk-web-1',
      'f6e5d4c3b2a1   utk-worker     Up 5 minutes (unhealthy)  utk-worker-1'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'utk-worker-1' },
      { kind: 'literal', value: 'unhealthy' }
    ],
    baselineText: 'docker ps: utk-web healthy; utk-worker-1 unhealthy'
  }),
  supportedFixture({
    name: 'shell-kubectl-pods',
    category: 'Kubernetes',
    useCase: 'Compress kubectl pod table while retaining restart count and CrashLoopBackOff.',
    testStrategy: 'Kubernetes status row retention with strict RTK token win.',
    rtkStrength: 'RTK summarizes kubectl tables well.',
    utkApproach: 'Keep kubectl raw output recoverable and compact response generic.',
    toolId: 'shell.kubectl.get-pods',
    input: { command: 'kubectl get pods -n prod' },
    rawOutput: [
      'NAME                         READY   STATUS             RESTARTS   AGE',
      'api-5d9f7d7c9f-q2l8x         1/1     Running            0          2h',
      'worker-6c44d9fbdf-9mxrs      0/1     CrashLoopBackOff   7          11m'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'worker-6c44d9fbdf-9mxrs' },
      { kind: 'literal', value: 'CrashLoopBackOff   7' }
    ],
    baselineText: 'kubectl pods: worker-6c44d9fbdf-9mxrs CrashLoopBackOff with 7 restarts'
  }),
  supportedFixture({
    name: 'shell-curl-headers',
    category: 'HTTP headers',
    useCase: 'Compress curl headers while preserving throttle status and retry delay.',
    testStrategy: 'HTTP status/header literal retention with strict RTK token win.',
    rtkStrength: 'RTK can trim curl header noise.',
    utkApproach: 'Persist headers exactly and send compact text envelope.',
    toolId: 'shell.curl.headers',
    input: { command: 'curl -i https://api.example.test/v1/events' },
    rawOutput: [
      'HTTP/2 429',
      'content-type: application/json',
      'retry-after: 120',
      'x-request-id: req_789',
      '{"error":"rate_limited"}'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'HTTP/2 429' },
      { kind: 'literal', value: 'retry-after: 120' }
    ],
    baselineText: 'curl headers: HTTP/2 429 rate limited, retry-after 120 seconds'
  }),
  supportedFixture({
    name: 'shell-du-sizes',
    category: 'Disk usage',
    useCase: 'Compress du output while preserving largest directory size.',
    testStrategy: 'Disk size/path literal retention with strict RTK token win.',
    rtkStrength: 'RTK handles small CLI size tables well.',
    utkApproach: 'Store raw size rows and compact to text line/count metadata.',
    toolId: 'shell.du',
    input: { command: 'du -sh dist .utk node_modules' },
    rawOutput: [
      '16K\tdist',
      '2.4M\t.utk',
      '184M\tnode_modules'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '184M\tnode_modules' },
      { kind: 'literal', value: '2.4M\t.utk' }
    ],
    baselineText: 'du summary: node_modules 184M, .utk 2.4M, dist 16K'
  }),
  supportedFixture({
    name: 'shell-rg-json-lines',
    category: 'Search JSON',
    useCase: 'Compress ripgrep JSON lines while retaining match path and line.',
    testStrategy: 'JSON-lines search literal retention with strict RTK token win.',
    rtkStrength: 'RTK can summarize search JSON emitted by CLI tools.',
    utkApproach: 'Keep raw JSONL and avoid lossy in-chat rewriting.',
    toolId: 'shell.rg.json',
    input: { command: 'rg --json "assertRtkParity" packages/evals' },
    rawOutput: [
      '{"type":"match","data":{"path":{"text":"packages/evals/evals/rtk-parity-metrics.test.ts"},"line_number":7,"lines":{"text":"import { assertRtkParity } from ../metrics/rtkParityMetrics.js"}}}',
      '{"type":"match","data":{"path":{"text":"packages/evals/metrics/rtkParityMetrics.ts"},"line_number":54,"lines":{"text":"export function assertRtkParity(input)"}}}'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'packages/evals/evals/rtk-parity-metrics.test.ts' },
      { kind: 'literal', value: '"line_number":54' }
    ],
    baselineText: 'rg json: assertRtkParity found in rtk parity test line 7 and metrics line 54'
  }),
  supportedFixture({
    name: 'shell-git-log-oneline',
    category: 'Git history',
    useCase: 'Compress git log output while preserving commit order and subjects.',
    testStrategy: 'Commit hash/subject retention with strict RTK token win.',
    rtkStrength: 'RTK makes short git history scannable.',
    utkApproach: 'Persist log raw text and send compact text envelope.',
    toolId: 'shell.git.log',
    input: { command: 'git log --oneline -3' },
    rawOutput: [
      '9f8e7d6 add caveman parity benchmarks',
      '7c6b5a4 harden rtk metric helpers',
      '3b2a190 wire copilot hook mediation'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '9f8e7d6 add caveman parity benchmarks' },
      { kind: 'literal', value: '7c6b5a4 harden rtk metric helpers' }
    ],
    baselineText: 'git log: 9f8e7d6 caveman benchmarks; 7c6b5a4 rtk metrics; 3b2a190 hook mediation'
  }),
  generalizedFixture({
    name: 'sarif-results',
    category: 'Static analysis',
    useCase: 'Compress SARIF-like results while retaining rule id and affected file.',
    testStrategy: 'Static-analysis JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can summarize CLI analyzer text, but not structured SARIF well.',
    utkApproach: 'Use object schema summary and recoverable raw SARIF artifact.',
    toolId: 'tool.sarif',
    input: { analyzer: 'eslint' },
    rawOutput: {
      version: '2.1.0',
      runs: [{
        tool: { driver: { name: 'eslint' } },
        results: [
          { ruleId: 'no-raw-leakage', level: 'error', locations: [{ physicalLocation: { artifactLocation: { uri: 'packages/core/src/validation/leakage.ts' } } }] }
        ]
      }]
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.runs[0].results[0].ruleId', expected: 'no-raw-leakage' },
      { kind: 'jsonPath', path: '$.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri', expected: 'packages/core/src/validation/leakage.ts' }
    ]
  }),
  generalizedFixture({
    name: 'junit-xml',
    category: 'XML reports',
    useCase: 'Compress JUnit XML while retaining failing testcase and message.',
    testStrategy: 'XML literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can trim terminal XML but loses structure easily.',
    utkApproach: 'Persist XML text and expose compact line/count metadata.',
    toolId: 'tool.junit-xml',
    input: { report: 'junit' },
    rawOutput: '<testsuite tests="2" failures="1"><testcase classname="Router" name="routes schema"><failure message="expected shell.git-status.v1">fallback.v1</failure></testcase></testsuite>',
    requiredFacts: [
      { kind: 'literal', value: 'failures="1"' },
      { kind: 'literal', value: 'expected shell.git-status.v1' }
    ]
  }),
  generalizedFixture({
    name: 'csv-export',
    category: 'CSV',
    useCase: 'Compress CSV exports while retaining quoted fields.',
    testStrategy: 'CSV quoted comma literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK handles small CSV text but has no typed CSV model.',
    utkApproach: 'Store exact CSV and keep compact text metadata.',
    toolId: 'tool.csv',
    input: { export: 'users' },
    rawOutput: [
      'id,name,role',
      '1,"Smith, Ada",admin',
      '2,"Ng, Lin",reader',
      '3,"Patel, Mira",maintainer'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '1,"Smith, Ada",admin' },
      { kind: 'literal', value: '3,"Patel, Mira",maintainer' }
    ]
  }),
  generalizedFixture({
    name: 'graphql-response',
    category: 'GraphQL',
    useCase: 'Compress GraphQL response while retaining typename and nested branch.',
    testStrategy: 'GraphQL JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK has no special affordance for GraphQL result shape.',
    utkApproach: 'Schema summarize GraphQL JSON and keep raw artifact recoverable.',
    toolId: 'tool.graphql',
    input: { query: 'repository' },
    rawOutput: {
      data: {
        repository: {
          __typename: 'Repository',
          nameWithOwner: 'conta/utk',
          defaultBranchRef: { name: 'main' },
          pullRequests: { totalCount: 3 }
        }
      }
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.data.repository.__typename', expected: 'Repository' },
      { kind: 'jsonPath', path: '$.data.repository.defaultBranchRef.name', expected: 'main' }
    ]
  }),
  generalizedFixture({
    name: 'openapi-fragment',
    category: 'API schemas',
    useCase: 'Compress OpenAPI fragments while retaining method and operation id.',
    testStrategy: 'OpenAPI JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can summarize CLI schema dumps only as text.',
    utkApproach: 'Preserve schema object and expose compact key summary.',
    toolId: 'tool.openapi',
    input: { path: '/v1/mediate' },
    rawOutput: {
      openapi: '3.1.0',
      paths: {
        '/v1/mediate': {
          post: {
            operationId: 'mediateToolOutput',
            responses: { '200': { description: 'Mediated response' } }
          }
        }
      }
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.paths./v1/mediate.post.operationId', expected: 'mediateToolOutput' },
      { kind: 'jsonPath', path: '$.paths./v1/mediate.post.responses.200.description', expected: 'Mediated response' }
    ]
  }),
  generalizedFixture({
    name: 'secret-bearing-log',
    category: 'Secret safety',
    useCase: 'Compress secret-bearing logs without leaking raw output in response.',
    testStrategy: 'Secret literal retained only via raw artifact plus response leakage guard in fixture test.',
    rtkStrength: 'RTK may shorten logs but still risks echoing sensitive substrings.',
    utkApproach: 'Do not echo raw string in response; keep full raw artifact recoverable.',
    toolId: 'tool.secret-log',
    input: { log: 'auth' },
    rawOutput: [
      'INFO login user=ada@example.com',
      'WARN token OPENAI_API_KEY=sk-live-1234567890abcdef appeared in env dump',
      'ACTION rotate key and scrub .env.local'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'OPENAI_API_KEY=sk-live-1234567890abcdef' },
      { kind: 'literal', value: 'rotate key and scrub .env.local' }
    ]
  }),
  supportedFixture({
    name: 'shell-terraform-plan',
    category: 'Infrastructure plan',
    useCase: 'Compress Terraform plan output while preserving add/change/destroy counts.',
    testStrategy: 'Terraform action-count tuple retention with strict RTK token win.',
    rtkStrength: 'RTK is strong at collapsing verbose infra plans into action counts.',
    utkApproach: 'Persist full plan and expose compact text envelope with recoverable raw detail.',
    toolId: 'shell.terraform.plan',
    input: { command: 'terraform plan -no-color' },
    rawOutput: [
      'Terraform will perform the following actions:',
      '  # azurerm_linux_web_app.api will be updated in-place',
      '  # azurerm_service_plan.worker will be created',
      'Plan: 2 to add, 1 to change, 0 to destroy.'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'Plan: 2 to add, 1 to change, 0 to destroy.' },
      { kind: 'literal', value: 'azurerm_linux_web_app.api' }
    ],
    baselineText: 'terraform plan: 2 add, 1 change, 0 destroy; api web app updated in-place'
  }),
  supportedFixture({
    name: 'shell-helm-status',
    category: 'Helm release',
    useCase: 'Compress Helm release status while preserving namespace, revision, and failed hook.',
    testStrategy: 'Helm release metadata retention with strict RTK token win.',
    rtkStrength: 'RTK trims chart status output well.',
    utkApproach: 'Keep release output as artifact and send only schema-backed compact output.',
    toolId: 'shell.helm.status',
    input: { command: 'helm status utk-api -n prod' },
    rawOutput: [
      'NAME: utk-api',
      'LAST DEPLOYED: Wed May 20 22:00:00 2026',
      'NAMESPACE: prod',
      'STATUS: failed',
      'REVISION: 42',
      'NOTES: post-upgrade hook migrate-db failed'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'NAMESPACE: prod' },
      { kind: 'literal', value: 'post-upgrade hook migrate-db failed' }
    ],
    baselineText: 'helm status: utk-api prod failed at revision 42; post-upgrade migrate-db hook failed'
  }),
  supportedFixture({
    name: 'shell-ps-memory',
    category: 'Process table',
    useCase: 'Compress process table output while retaining PID and memory hotspot.',
    testStrategy: 'Process memory hotspot retention with strict RTK token win.',
    rtkStrength: 'RTK is good at process-table summaries.',
    utkApproach: 'Store full process table and keep compact artifact metadata model-visible.',
    toolId: 'shell.ps.memory',
    input: { command: 'ps -eo pid,comm,rss --sort=-rss | head' },
    rawOutput: [
      'PID     COMMAND        RSS',
      '4812    node           932144',
      '2099    postgres       331008',
      '7301    chrome         224512',
      '1882    ssh-agent      12444'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '4812    node           932144' },
      { kind: 'literal', value: 'postgres       331008' }
    ],
    baselineText: 'ps memory: node pid 4812 uses 932144 RSS; postgres uses 331008 RSS'
  }),
  supportedFixture({
    name: 'shell-netstat-listen',
    category: 'Network sockets',
    useCase: 'Compress listening socket output while preserving bound address and owning process.',
    testStrategy: 'Listen-address plus process retention with strict RTK token win.',
    rtkStrength: 'RTK summarizes networking CLI tables compactly.',
    utkApproach: 'Persist exact sockets and expose compact line/count artifact.',
    toolId: 'shell.netstat.listen',
    input: { command: 'netstat -ano | findstr LISTENING' },
    rawOutput: [
      'TCP    0.0.0.0:3000       0.0.0.0:0       LISTENING       4812',
      'TCP    127.0.0.1:5432     0.0.0.0:0       LISTENING       2099',
      'TCP    [::]:9229          [::]:0          LISTENING       4812'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '0.0.0.0:3000' },
      { kind: 'literal', value: '127.0.0.1:5432' }
    ],
    baselineText: 'netstat listening: node pid 4812 on 0.0.0.0:3000 and [::]:9229; postgres on 127.0.0.1:5432'
  }),
  supportedFixture({
    name: 'shell-openssl-cert',
    category: 'Certificate inspection',
    useCase: 'Compress certificate inspection while retaining expiry and SAN.',
    testStrategy: 'Certificate expiry/SAN retention with strict RTK token win.',
    rtkStrength: 'RTK handles verbose openssl output by pulling expiry facts.',
    utkApproach: 'Store the certificate dump and keep compact schema text in context.',
    toolId: 'shell.openssl.cert',
    input: { command: 'openssl x509 -in cert.pem -noout -text' },
    rawOutput: [
      'Subject: CN=api.example.com',
      'Issuer: CN=Example Intermediate CA',
      'Not Before: May 20 00:00:00 2026 GMT',
      'Not After : Aug 18 23:59:59 2026 GMT',
      'X509v3 Subject Alternative Name: DNS:api.example.com, DNS:api.internal.example.com'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'Not After : Aug 18 23:59:59 2026 GMT' },
      { kind: 'literal', value: 'DNS:api.internal.example.com' }
    ],
    baselineText: 'openssl cert: api.example.com expires Aug 18 2026 GMT; SAN includes api.internal.example.com'
  }),
  supportedFixture({
    name: 'shell-pnpm-install',
    category: 'Package install',
    useCase: 'Compress package-manager install output while preserving peer dependency warning.',
    testStrategy: 'Peer dependency warning retention with strict RTK token win.',
    rtkStrength: 'RTK filters package-manager noise effectively.',
    utkApproach: 'Keep full install log recoverable and return compact text shape only.',
    toolId: 'shell.pnpm.install',
    input: { command: 'pnpm install' },
    rawOutput: [
      'Packages: +128 -4',
      'WARN Issues with peer dependencies found',
      'packages/evals',
      '└─┬ autoevals 0.0.132',
      '  └── unmet peer zod@^3.25.0: found 4.0.0',
      'Done in 12.4s'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'Packages: +128 -4' },
      { kind: 'literal', value: 'unmet peer zod@^3.25.0' }
    ],
    baselineText: 'pnpm install: +128 -4 packages; unmet peer zod for autoevals in packages/evals'
  }),
  supportedFixture({
    name: 'shell-go-test-race',
    category: 'Go tests',
    useCase: 'Compress Go race detector output while retaining race location.',
    testStrategy: 'Go race detector file/function retention with strict RTK token win.',
    rtkStrength: 'RTK can reduce long race detector traces to key frames.',
    utkApproach: 'Store full trace and keep artifact handles in response.',
    toolId: 'shell.go.test',
    input: { command: 'go test -race ./...' },
    rawOutput: [
      'WARNING: DATA RACE',
      'Read at 0x00c00012 by goroutine 19:',
      '  github.com/acme/utk/router.(*Cache).Get()',
      '      /src/router/cache.go:77 +0x44',
      'Previous write at 0x00c00012 by goroutine 21:',
      '  github.com/acme/utk/router.(*Cache).Set()',
      '      /src/router/cache.go:91 +0x88',
      'FAIL github.com/acme/utk/router 0.842s'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'WARNING: DATA RACE' },
      { kind: 'literal', value: '/src/router/cache.go:91' }
    ],
    baselineText: 'go test race: DATA RACE in router Cache Get/Set, write at /src/router/cache.go:91'
  }),
  supportedFixture({
    name: 'shell-cargo-test',
    category: 'Rust tests',
    useCase: 'Compress Cargo test output while retaining failing test and panic message.',
    testStrategy: 'Rust panic test-name retention with strict RTK token win.',
    rtkStrength: 'RTK originated around Rust CLI output and handles Cargo logs well.',
    utkApproach: 'Recover full Cargo output via raw artifact and send compact text envelope.',
    toolId: 'shell.cargo.test',
    input: { command: 'cargo test --all' },
    rawOutput: [
      '---- router::tests::preserves_schema_id stdout ----',
      'thread router::tests::preserves_schema_id panicked at src/router.rs:118:9:',
      'assertion failed: left == right',
      'left: "fallback.v1"',
      'right: "shell.git-status.v1"',
      'test result: FAILED. 41 passed; 1 failed; 0 ignored'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'router::tests::preserves_schema_id' },
      { kind: 'literal', value: 'right: "shell.git-status.v1"' }
    ],
    baselineText: 'cargo test failed: router::tests::preserves_schema_id expected shell.git-status.v1'
  }),
  supportedFixture({
    name: 'shell-dotnet-test',
    category: 'Dotnet tests',
    useCase: 'Compress dotnet test output while preserving failing test and duration.',
    testStrategy: 'Dotnet failure and duration retention with strict RTK token win.',
    rtkStrength: 'RTK trims cross-platform test runner noise.',
    utkApproach: 'Persist test output and return compact artifact handles.',
    toolId: 'shell.dotnet.test',
    input: { command: 'dotnet test' },
    rawOutput: [
      'Failed Utk.Tests.ToolMediatorTests.SerializesLargeObject [347 ms]',
      'Error Message:',
      ' Expected token ratio below 0.35 but found 0.41',
      'Passed!  - Failed: 1, Passed: 128, Skipped: 0, Total: 129, Duration: 4 s'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'SerializesLargeObject [347 ms]' },
      { kind: 'literal', value: 'Expected token ratio below 0.35' }
    ],
    baselineText: 'dotnet test failed: ToolMediatorTests.SerializesLargeObject 347ms token ratio 0.41 over 0.35'
  }),
  supportedFixture({
    name: 'shell-powershell-error',
    category: 'PowerShell',
    useCase: 'Compress PowerShell error output while preserving FullyQualifiedErrorId.',
    testStrategy: 'PowerShell error id retention with strict RTK token win.',
    rtkStrength: 'RTK can reduce Windows shell noise.',
    utkApproach: 'Keep raw PowerShell diagnostic and expose compact text metadata.',
    toolId: 'shell.powershell.error',
    input: { command: 'Get-Content missing.txt' },
    rawOutput: [
      "Get-Content : Cannot find path 'C:\\src\\utk\\missing.txt' because it does not exist.",
      'At line:1 char:1',
      '+ Get-Content missing.txt',
      '+ ~~~~~~~~~~~~~~~~~~~~~~~',
      'CategoryInfo          : ObjectNotFound: (C:\\src\\utk\\missing.txt:String) [Get-Content], ItemNotFoundException',
      'FullyQualifiedErrorId : PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'C:\\src\\utk\\missing.txt' },
      { kind: 'literal', value: 'PathNotFound,Microsoft.PowerShell.Commands.GetContentCommand' }
    ],
    baselineText: 'PowerShell Get-Content failed: C:\\src\\utk\\missing.txt missing; FullyQualifiedErrorId PathNotFound'
  }),
  supportedFixture({
    name: 'shell-azure-deployment',
    category: 'Azure CLI',
    useCase: 'Compress Azure deployment output while retaining failed resource and correlation id.',
    testStrategy: 'Cloud deployment correlation-id retention with strict RTK token win.',
    rtkStrength: 'RTK summarizes cloud CLI result blocks well.',
    utkApproach: 'Store full JSON/text output and keep compact object/text summary only.',
    toolId: 'shell.az.deployment',
    input: { command: 'az deployment group create --resource-group rg-utk' },
    rawOutput: [
      'Deployment failed. Correlation ID: 2d4b1a11-6d2a-4fd5-a0e3-6cfbaef67321',
      'Resource: Microsoft.Web/sites/utk-api',
      'Code: Conflict',
      'Message: Site with given name already exists.'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '2d4b1a11-6d2a-4fd5-a0e3-6cfbaef67321' },
      { kind: 'literal', value: 'Microsoft.Web/sites/utk-api' }
    ],
    baselineText: 'az deployment failed: Microsoft.Web/sites/utk-api conflict; correlation 2d4b1a11-6d2a-4fd5-a0e3-6cfbaef67321'
  }),
  supportedFixture({
    name: 'shell-ffmpeg-progress',
    category: 'Media processing',
    useCase: 'Compress ffmpeg output while preserving codec error and timestamp.',
    testStrategy: 'Media transcoder timestamp/error retention with strict RTK token win.',
    rtkStrength: 'RTK trims noisy progress streams.',
    utkApproach: 'Persist full ffmpeg stream and expose compact text shape.',
    toolId: 'shell.ffmpeg',
    input: { command: 'ffmpeg -i input.mov output.mp4' },
    rawOutput: [
      'frame=  240 fps= 48 q=28.0 size=1024kB time=00:00:10.00 bitrate=838.8kbits/s',
      '[h264 @ 000001] error while decoding MB 12 34, bytestream -5',
      'Conversion failed at time=00:00:10.42'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'error while decoding MB 12 34' },
      { kind: 'literal', value: 'time=00:00:10.42' }
    ],
    baselineText: 'ffmpeg failed: h264 decode error MB 12 34 at time 00:00:10.42'
  }),
  supportedFixture({
    name: 'shell-mysql-explain',
    category: 'Database plan',
    useCase: 'Compress SQL EXPLAIN table while preserving access type and rows estimate.',
    testStrategy: 'SQL query-plan row retention with strict RTK token win.',
    rtkStrength: 'RTK can condense terminal query plans.',
    utkApproach: 'Raw plan remains recoverable while compact artifact only describes shape.',
    toolId: 'shell.mysql.explain',
    input: { command: 'mysql -e "EXPLAIN SELECT * FROM events WHERE tenant_id=1"' },
    rawOutput: [
      '+----+-------------+--------+------+---------------+------+---------+------+-------+-------------+',
      '| id | select_type | table  | type | possible_keys | key  | key_len | ref  | rows  | Extra       |',
      '|  1 | SIMPLE      | events | ref  | tenant_idx    | NULL | NULL    | NULL | 98231 | Using where |',
      '+----+-------------+--------+------+---------------+------+---------+------+-------+-------------+'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '|  1 | SIMPLE      | events | ref' },
      { kind: 'literal', value: '98231 | Using where' }
    ],
    baselineText: 'mysql explain: events table uses ref access but no key, rows estimate 98231, Using where'
  }),
  supportedFixture({
    name: 'shell-windows-dir',
    category: 'Windows filesystem',
    useCase: 'Compress Windows dir output while preserving file size and timestamp.',
    testStrategy: 'Windows dir timestamp/size retention with strict RTK token win.',
    rtkStrength: 'RTK handles shell listings but can normalize away Windows details.',
    utkApproach: 'Store exact listing with CRLF-like spacing and return compact text envelope.',
    toolId: 'shell.windows.dir',
    input: { command: 'dir C:\\src\\utk\\docs' },
    rawOutput: [
      '05/20/2026  10:14 PM             4,096 rtk-parity.md',
      '05/20/2026  10:15 PM            12,288 evals.md',
      '05/20/2026  10:16 PM    <DIR>          internal'
    ].join('\r\n'),
    requiredFacts: [
      { kind: 'literal', value: '05/20/2026  10:14 PM             4,096 rtk-parity.md' },
      { kind: 'literal', value: '<DIR>          internal' }
    ],
    baselineText: 'dir docs: rtk-parity.md 4096 bytes at 05/20/2026 10:14 PM; internal is directory'
  }),
  supportedFixture({
    name: 'shell-jq-filter',
    category: 'JSON CLI transform',
    useCase: 'Compress jq output while preserving selected id and null field.',
    testStrategy: 'jq-selected null/value retention with strict RTK token win.',
    rtkStrength: 'RTK can summarize filtered JSON output from shell pipelines.',
    utkApproach: 'Persist filtered output and expose compact shape metadata.',
    toolId: 'shell.jq',
    input: { command: 'jq ".runs[] | {id, conclusion}" runs.json' },
    rawOutput: [
      '{ "id": 991, "conclusion": "neutral" }',
      '{ "id": 992, "conclusion": null }',
      '{ "id": 993, "conclusion": "success" }'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '{ "id": 992, "conclusion": null }' },
      { kind: 'literal', value: '{ "id": 993, "conclusion": "success" }' }
    ],
    baselineText: 'jq output: run 992 conclusion null; run 993 conclusion success'
  }),
  generalizedFixture({
    name: 'ndjson-event-stream',
    category: 'NDJSON',
    useCase: 'Compress newline-delimited JSON while preserving first and last event ids.',
    testStrategy: 'NDJSON boundary-event literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can summarize text streams but has no event-stream schema.',
    utkApproach: 'Store exact NDJSON and expose compact text envelope.',
    toolId: 'tool.ndjson',
    input: { stream: 'events' },
    rawOutput: Array.from({ length: 18 }, (_, index) => JSON.stringify({
      id: `evt-${index}`,
      kind: index === 17 ? 'deploy_failed' : 'deploy_step',
      status: index === 17 ? 'failed' : 'ok',
      step: `step-${index}`
    })).join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '"id":"evt-0"' },
      { kind: 'literal', value: '"kind":"deploy_failed"' }
    ]
  }),
  generalizedFixture({
    name: 'lcov-coverage-report',
    category: 'Coverage',
    useCase: 'Compress LCOV text while preserving uncovered line and file.',
    testStrategy: 'LCOV uncovered-line literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK handles terminal coverage summaries but not LCOV semantics.',
    utkApproach: 'Persist LCOV exactly and send compact text shape.',
    toolId: 'tool.lcov',
    input: { report: 'coverage/lcov.info' },
    rawOutput: [
      'TN:',
      'SF:packages/core/src/router/router.ts',
      'DA:41,3',
      'DA:42,0',
      'DA:43,3',
      'BRDA:42,0,0,0',
      'end_of_record',
      'SF:packages/evals/metrics/rtkParityMetrics.ts',
      'DA:54,12',
      'DA:55,12',
      'end_of_record'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'SF:packages/core/src/router/router.ts' },
      { kind: 'literal', value: 'DA:42,0' }
    ]
  }),
  generalizedFixture({
    name: 'prometheus-metrics',
    category: 'Metrics exposition',
    useCase: 'Compress Prometheus exposition while preserving metric labels and values.',
    testStrategy: 'Prometheus labeled-sample retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can shorten metric dumps but lacks label awareness.',
    utkApproach: 'Keep raw metrics scrape recoverable and compact only shape metadata.',
    toolId: 'tool.prometheus',
    input: { endpoint: '/metrics' },
    rawOutput: [
      '# HELP utk_tool_mediation_seconds Tool mediation latency',
      '# TYPE utk_tool_mediation_seconds histogram',
      'utk_tool_mediation_seconds_bucket{tool="shell.rg",le="0.1"} 7',
      'utk_tool_mediation_seconds_bucket{tool="shell.rg",le="0.5"} 11',
      'utk_tool_mediation_seconds_sum{tool="shell.rg"} 1.72',
      'utk_tool_mediation_seconds_count{tool="shell.rg"} 12'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'utk_tool_mediation_seconds_sum{tool="shell.rg"} 1.72' },
      { kind: 'literal', value: 'utk_tool_mediation_seconds_count{tool="shell.rg"} 12' }
    ]
  }),
  generalizedFixture({
    name: 'har-network-log',
    category: 'Browser HAR',
    useCase: 'Compress HAR-like network logs while preserving failing request status.',
    testStrategy: 'HAR nested request/status JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can summarize browser CLI output but not nested HAR objects.',
    utkApproach: 'Schema summarize HAR object and retain raw network log.',
    toolId: 'tool.har',
    input: { page: '/dashboard' },
    rawOutput: {
      log: {
        version: '1.2',
        entries: [
          { request: { method: 'GET', url: 'https://app.example.test/api/session' }, response: { status: 200 } },
          { request: { method: 'POST', url: 'https://app.example.test/api/runs' }, response: { status: 503, statusText: 'Service Unavailable' } }
        ]
      }
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.log.entries[1].request.url', expected: 'https://app.example.test/api/runs' },
      { kind: 'jsonPath', path: '$.log.entries[1].response.status', expected: 503 }
    ]
  }),
  generalizedFixture({
    name: 'playwright-trace-summary',
    category: 'Browser trace',
    useCase: 'Compress browser trace summaries while retaining failed action and selector.',
    testStrategy: 'Playwright action selector JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK sees browser traces as plain noisy text.',
    utkApproach: 'Mediate structured trace output directly with artifact recovery.',
    toolId: 'tool.playwright.trace',
    input: { test: 'checkout' },
    rawOutput: {
      test: 'checkout flow',
      steps: [
        { action: 'goto', url: 'https://app.example.test/checkout', ok: true },
        { action: 'click', selector: 'button[data-testid="pay-now"]', ok: false, error: 'element is disabled' }
      ],
      screenshots: ['before-pay.png', 'disabled-button.png']
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.steps[1].selector', expected: 'button[data-testid="pay-now"]' },
      { kind: 'jsonPath', path: '$.steps[1].error', expected: 'element is disabled' }
    ]
  }),
  generalizedFixture({
    name: 'package-lock-subtree',
    category: 'Lockfile',
    useCase: 'Compress package-lock subtree while preserving resolved version and integrity.',
    testStrategy: 'Lockfile package JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can summarize npm output, not lockfile trees.',
    utkApproach: 'Store lock subtree raw and compact only object keys.',
    toolId: 'tool.package-lock',
    input: { package: 'autoevals' },
    rawOutput: {
      packages: {
        'node_modules/autoevals': {
          version: '0.0.132',
          resolved: 'https://registry.npmjs.org/autoevals/-/autoevals-0.0.132.tgz',
          integrity: 'sha512-abc123',
          dependencies: { '@braintrust/core': '^0.0.88' }
        }
      }
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.packages.node_modules/autoevals.version', expected: '0.0.132' },
      { kind: 'jsonPath', path: '$.packages.node_modules/autoevals.integrity', expected: 'sha512-abc123' }
    ]
  }),
  generalizedFixture({
    name: 'tsserver-protocol-log',
    category: 'Editor protocol',
    useCase: 'Compress TypeScript server protocol logs while preserving request sequence.',
    testStrategy: 'tsserver sequence/event literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK may shrink protocol logs as plain text only.',
    utkApproach: 'Keep JSON protocol lines exact and expose compact text envelope.',
    toolId: 'tool.tsserver',
    input: { log: 'tsserver' },
    rawOutput: [
      '{"seq":17,"type":"request","command":"completionInfo","arguments":{"file":"packages/core/src/router/router.ts","line":42,"offset":13}}',
      '{"seq":0,"type":"event","event":"syntaxDiag","body":{"file":"packages/core/src/router/router.ts","diagnostics":[]}}',
      '{"seq":18,"type":"response","command":"completionInfo","request_seq":17,"success":true}'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '"seq":17' },
      { kind: 'literal', value: '"command":"completionInfo"' }
    ]
  }),
  generalizedFixture({
    name: 'sqlite-query-result',
    category: 'Database rows',
    useCase: 'Compress SQLite query result rows while preserving tenant and deleted marker.',
    testStrategy: 'SQL row object JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can summarize CLI tables but not typed row objects.',
    utkApproach: 'Summarize array cardinality and retain raw result rows.',
    toolId: 'tool.sqlite.rows',
    input: { sql: 'select id, tenant_id, deleted_at from events' },
    rawOutput: [
      { id: 1, tenant_id: 'tenant-a', deleted_at: null, payload_size: 184 },
      { id: 2, tenant_id: 'tenant-a', deleted_at: '2026-05-20T22:00:00Z', payload_size: 240 },
      { id: 3, tenant_id: 'tenant-b', deleted_at: null, payload_size: 512 }
    ],
    requiredFacts: [
      { kind: 'jsonPath', path: '$[1].deleted_at', expected: '2026-05-20T22:00:00Z' },
      { kind: 'jsonPath', path: '$[2].tenant_id', expected: 'tenant-b' }
    ]
  }),
  generalizedFixture({
    name: 'rfc822-email',
    category: 'Email',
    useCase: 'Compress RFC822 message output while preserving Message-ID and subject.',
    testStrategy: 'RFC822 header literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can shorten email-like terminal output but may lose headers.',
    utkApproach: 'Store full email artifact and expose compact text metadata.',
    toolId: 'tool.email',
    input: { message: 'bounce' },
    rawOutput: [
      'Message-ID: <20260520221500.12345@example.com>',
      'From: alerts@example.com',
      'To: platform@example.com',
      'Subject: [SEV2] UTK worker queue delayed',
      'Date: Wed, 20 May 2026 22:15:00 -0500',
      '',
      'Queue latency p95 reached 184ms over 150ms budget.'
    ].join('\r\n'),
    requiredFacts: [
      { kind: 'literal', value: 'Message-ID: <20260520221500.12345@example.com>' },
      { kind: 'literal', value: 'Subject: [SEV2] UTK worker queue delayed' }
    ]
  }),
  generalizedFixture({
    name: 'icalendar-event',
    category: 'Calendar',
    useCase: 'Compress iCalendar event output while preserving UID and timezone timestamp.',
    testStrategy: 'iCalendar UID/DTSTART literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK has no calendar-specific structure model.',
    utkApproach: 'Persist .ics text exactly and keep compact text envelope.',
    toolId: 'tool.ical',
    input: { calendar: 'deploy' },
    rawOutput: [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:deploy-20260521T140322@example.com',
      'DTSTART;TZID=America/Chicago:20260521T140322',
      'SUMMARY:UTK RTK parity review',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n'),
    requiredFacts: [
      { kind: 'literal', value: 'UID:deploy-20260521T140322@example.com' },
      { kind: 'literal', value: 'DTSTART;TZID=America/Chicago:20260521T140322' }
    ]
  }),
  generalizedFixture({
    name: 'yaml-k8s-manifest',
    category: 'YAML manifests',
    useCase: 'Compress Kubernetes YAML while preserving image digest and replica count.',
    testStrategy: 'YAML image/replica literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK treats YAML dumps as plain shell text.',
    utkApproach: 'Store manifest raw and return compact text shape metadata.',
    toolId: 'tool.yaml.k8s',
    input: { manifest: 'deployment.yaml' },
    rawOutput: [
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: utk-api',
      'spec:',
      '  replicas: 3',
      '  template:',
      '    spec:',
      '      containers:',
      '        - name: api',
      '          image: ghcr.io/acme/utk@sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'replicas: 3' },
      { kind: 'literal', value: 'ghcr.io/acme/utk@sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd' }
    ]
  }),
  generalizedFixture({
    name: 'toml-config-fragment',
    category: 'TOML config',
    useCase: 'Compress TOML config while preserving serializer override and boolean flag.',
    testStrategy: 'TOML dotted-key literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can shorten config text but not validate TOML fields.',
    utkApproach: 'Keep config raw and expose compact artifact reference.',
    toolId: 'tool.toml',
    input: { file: '.utk/config.toml' },
    rawOutput: [
      '[serialization]',
      'default = "toon"',
      '',
      '[tools."shell.git.diff"]',
      'serializer = "compressed-json"',
      'include_raw_artifact = true',
      '',
      '[detok]',
      'enabled = false'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: '[tools."shell.git.diff"]' },
      { kind: 'literal', value: 'include_raw_artifact = true' }
    ]
  }),
  generalizedFixture({
    name: 'protobuf-json-diagnostic',
    category: 'Protobuf JSON',
    useCase: 'Compress protobuf JSON diagnostic output while preserving field number and reserved range.',
    testStrategy: 'Protobuf diagnostic JSONPath retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can summarize compiler text but not typed descriptor JSON.',
    utkApproach: 'Schema summarize descriptor object and retain full raw JSON.',
    toolId: 'tool.protobuf.json',
    input: { descriptor: 'benchmark.proto' },
    rawOutput: {
      file: 'benchmark.proto',
      message: {
        name: 'BenchmarkCase',
        fields: [
          { name: 'scenario', number: 1, type: 'string' },
          { name: 'rtk_baseline_tokens', number: 7, type: 'int32' }
        ],
        reservedRanges: [{ start: 8, end: 12 }]
      }
    },
    requiredFacts: [
      { kind: 'jsonPath', path: '$.message.fields[1].number', expected: 7 },
      { kind: 'jsonPath', path: '$.message.reservedRanges[0].end', expected: 12 }
    ]
  }),
  generalizedFixture({
    name: 'binary-png-header',
    category: 'Binary output',
    useCase: 'Compress binary-ish output while preserving raw artifact recovery for magic bytes.',
    testStrategy: 'Binary magic-byte literal recovery plus raw-output savings threshold.',
    rtkStrength: 'RTK is text-first and cannot safely summarize binary payloads.',
    utkApproach: 'Persist binary-like payload and expose a binary envelope instead of echoing bytes.',
    toolId: 'tool.binary.png',
    input: { file: 'screenshot.png' },
    rawOutput: Buffer.from('PNG\r\nmagic=89504e47 width=1440 height=900 chunk=IHDR chunk=IDAT chunk=IEND repeated-padding-00000000000000000000'),
    requiredFacts: [
      { kind: 'literal', value: 'magic=89504e47' },
      { kind: 'literal', value: 'width=1440 height=900' }
    ]
  }),
  generalizedFixture({
    name: 'multipart-form-data',
    category: 'Multipart payload',
    useCase: 'Compress multipart payloads while preserving boundary and file field name.',
    testStrategy: 'Multipart boundary/file-field literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can mangle multipart punctuation under aggressive text compression.',
    utkApproach: 'Store multipart raw text and keep compact text envelope only.',
    toolId: 'tool.multipart',
    input: { request: 'upload' },
    rawOutput: [
      '------WebKitFormBoundary7MA4YWxkTrZu0gW',
      'Content-Disposition: form-data; name="metadata"',
      '',
      '{"scenario":"rtk-parity","attempt":2}',
      '------WebKitFormBoundary7MA4YWxkTrZu0gW',
      'Content-Disposition: form-data; name="file"; filename="report.json"',
      'Content-Type: application/json',
      '',
      '{"status":"failed","reason":"token ratio"}',
      '------WebKitFormBoundary7MA4YWxkTrZu0gW--'
    ].join('\r\n'),
    requiredFacts: [
      { kind: 'literal', value: '------WebKitFormBoundary7MA4YWxkTrZu0gW' },
      { kind: 'literal', value: 'name="file"; filename="report.json"' }
    ]
  }),
  generalizedFixture({
    name: 'ansi-colored-output',
    category: 'ANSI terminal',
    useCase: 'Compress colored terminal output while preserving visible error after escape codes.',
    testStrategy: 'ANSI escaped-error literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK often targets terminal text but escape codes can obscure facts.',
    utkApproach: 'Persist raw ANSI output and expose compact line/count metadata.',
    toolId: 'tool.ansi',
    input: { command: 'test --color=always' },
    rawOutput: [
      '\u001b[31mERROR\u001b[0m route failed: schema fallback.v1 selected',
      '\u001b[33mWARN\u001b[0m expected shell.git-status.v1',
      '\u001b[32mINFO\u001b[0m retry with deterministic route seed 42'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'schema fallback.v1 selected' },
      { kind: 'literal', value: 'expected shell.git-status.v1' }
    ]
  }),
  generalizedFixture({
    name: 'unicode-width-table',
    category: 'Unicode table',
    useCase: 'Compress wide Unicode table output while preserving emoji/status associations.',
    testStrategy: 'Unicode-width row literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK can lose alignment or glyph associations in wide terminal tables.',
    utkApproach: 'Keep raw Unicode table recoverable and compact only text shape.',
    toolId: 'tool.unicode.table',
    input: { table: 'deployments' },
    rawOutput: [
      'SERVICE      REGION       STATUS',
      'api          us-east-2    ✅ healthy',
      'worker       eu-west-1    ❌ queue delayed',
      'scheduler    ap-south-1   ⚠️ clock skew 320ms'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'worker       eu-west-1    ❌ queue delayed' },
      { kind: 'literal', value: 'scheduler    ap-south-1   ⚠️ clock skew 320ms' }
    ]
  }),
  generalizedFixture({
    name: 'patch-with-renames',
    category: 'Patch metadata',
    useCase: 'Compress patch metadata while preserving rename similarity and file paths.',
    testStrategy: 'Git rename metadata literal retention plus raw-output savings threshold.',
    rtkStrength: 'RTK summarizes diffs but can omit rename metadata.',
    utkApproach: 'Persist full patch and expose compact text envelope.',
    toolId: 'tool.patch.rename',
    input: { patch: 'rename.diff' },
    rawOutput: [
      'diff --git a/src/old-router.ts b/src/router/index.ts',
      'similarity index 87%',
      'rename from src/old-router.ts',
      'rename to src/router/index.ts',
      '--- a/src/old-router.ts',
      '+++ b/src/router/index.ts',
      '@@ -1,3 +1,3 @@',
      '-export const name = "old";',
      '+export const name = "router";'
    ].join('\n'),
    requiredFacts: [
      { kind: 'literal', value: 'similarity index 87%' },
      { kind: 'literal', value: 'rename to src/router/index.ts' }
    ]
  })
];

export function rtkParityExpectedPayload(fixture: RtkParityFixture): string {
  return JSON.stringify({
    scenario: fixture.name,
    tool_id: fixture.toolId,
    required_facts: fixture.requiredFacts,
    rtk_supported: fixture.rtkSupported,
    rtk_baseline_bytes: fixture.rtkBaselineBytes,
    rtk_baseline_tokens: fixture.rtkBaselineTokens,
    rtk_notes: fixture.rtkNotes ?? null
  }, null, 2);
}
