import { estimateTokens } from '../assertions/tokenBudgets.js';

export const CAVEMAN_MODES = ['lite', 'full', 'ultra', 'wenyan'] as const;
export type CavemanMode = (typeof CAVEMAN_MODES)[number];
export type CavemanModeBaselines = Record<CavemanMode, string>;

export type CavemanParityFixture = {
  name: string;
  category: string;
  useCase: string;
  testStrategy: string;
  cavemanStrength: string;
  utkApproach: string;
  sourceText: string;
  cavemanBaseline: string;
  cavemanBaselines: CavemanModeBaselines;
  utkCandidate: string;
  requiredTerms: string[];
  exactTerms?: string[];
  orderedTerms?: string[];
  forbiddenTerms?: string[];
  requiredPatterns?: string[];
  forbiddenPatterns?: string[];
  maxTokenRatio: number;
  minFactScore: number;
};

type CavemanParityFixtureParams = Omit<CavemanParityFixture, 'cavemanBaselines' | 'maxTokenRatio' | 'minFactScore'> &
  Partial<Pick<CavemanParityFixture, 'maxTokenRatio' | 'minFactScore'>> & {
    cavemanBaselines?: Partial<CavemanModeBaselines>;
  };

function fixture(params: CavemanParityFixtureParams): CavemanParityFixture {
  const full = params.cavemanBaselines?.full ?? params.cavemanBaseline;
  const baselines = {
    lite: params.cavemanBaselines?.lite ?? `Lite caveman competitor: ${full}`,
    full,
    ultra: params.cavemanBaselines?.ultra ?? `Ultra caveman competitor: ${full}`,
    wenyan: params.cavemanBaselines?.wenyan ?? `Wenyan caveman competitor: ${full}`
  };
  return {
    maxTokenRatio: 1,
    minFactScore: 1,
    ...params,
    cavemanBaseline: full,
    cavemanBaselines: baselines
  };
}

export const CAVEMAN_PARITY_FIXTURES: CavemanParityFixture[] = [
  fixture({
    name: 'ci-failure-triage',
    category: 'Failure triage',
    useCase: 'Summarize a failed validation run with enough detail for the next fix.',
    testStrategy: 'Required fact retention for command, TypeScript error, file, cause, and rerun step.',
    cavemanStrength: 'Compact technical triage with command, error, file, cause, and rerun step.',
    utkApproach: 'Drop connective prose and keep exact command/error/path symbols as anchors.',
    sourceText: [
      'The CI run is failing during the typecheck step. The command was npm run typecheck.',
      'TypeScript reports TS2345 in packages/core/src/router/router.ts on line 87 because schemaId may be undefined.',
      'The next action is to guard schemaId before calling routeToSchema(schemaId), then rerun npm run typecheck.'
    ].join(' '),
    cavemanBaseline: 'CI red. `npm run typecheck` fails in `packages/core/src/router/router.ts:87`: TS2345. Cause: `schemaId` may be undefined. Fix guard before `routeToSchema(schemaId)`. Rerun `npm run typecheck`.',
    utkCandidate: 'CI red. `npm run typecheck` fails: TS2345 `packages/core/src/router/router.ts:87`. `schemaId` may be undefined. Guard before `routeToSchema(schemaId)`. Rerun `npm run typecheck`.',
    requiredTerms: ['npm run typecheck', 'TS2345', 'packages/core/src/router/router.ts:87', 'schemaId', 'routeToSchema(schemaId)']
  }),
  fixture({
    name: 'review-finding',
    category: 'Code review',
    useCase: 'Compress a code-review finding without dropping file, line, risk, or fix.',
    testStrategy: 'Line-specific risk/fix retention with exact file-line anchor.',
    cavemanStrength: 'Line-specific actionable feedback with minimal review prose.',
    utkApproach: 'Use path-first structure and collapse risk/fix into terse clauses.',
    sourceText: [
      'In packages/model-proxy/src/proxy.ts line 142, the retry loop retries POST requests after a partial body was forwarded.',
      'That can duplicate side effects for non-idempotent upstream calls.',
      'Only retry idempotent methods or requests that failed before body forwarding.'
    ].join(' '),
    cavemanBaseline: '`packages/model-proxy/src/proxy.ts:142` retries POST after partial body forwarded. Risk: duplicate side effects. Fix: retry only idempotent methods or failures before body forwarding.',
    utkCandidate: '`packages/model-proxy/src/proxy.ts:142` retries POST after partial body. Duplicate side effects possible. Fix: retry only idempotent methods or pre-body failures.',
    requiredTerms: ['packages/model-proxy/src/proxy.ts:142', 'POST', 'partial body', 'duplicate side effects', 'idempotent']
  }),
  fixture({
    name: 'artifact-recovery',
    category: 'Artifact recovery',
    useCase: 'Preserve recovery handles while shrinking a tool-output mediation summary.',
    testStrategy: 'Recovery artifact path retention with schema and confidence anchors.',
    cavemanStrength: 'Short recovery summaries that still protect paths, schema ids, and confidence.',
    utkApproach: 'Omit explanatory wrapper text and keep recoverability handles verbatim.',
    sourceText: [
      'The mediated tool response omitted the full payload from chat, stored the raw result at .utk/tools/git.status/observations/run-9/output.raw.txt,',
      'stored the compact artifact at .utk/tools/git.status/observations/run-9/output.compact.toon, inferred schema shell.git-status.v1,',
      'and routed with confidence 0.97.'
    ].join(' '),
    cavemanBaseline: 'Payload omitted from chat. Raw: `.utk/tools/git.status/observations/run-9/output.raw.txt`. Compact: `.utk/tools/git.status/observations/run-9/output.compact.toon`. Schema `shell.git-status.v1`, confidence 0.97.',
    utkCandidate: 'Payload omitted. Raw `.utk/tools/git.status/observations/run-9/output.raw.txt`; compact `.utk/tools/git.status/observations/run-9/output.compact.toon`. Schema `shell.git-status.v1`; confidence 0.97.',
    requiredTerms: ['.utk/tools/git.status/observations/run-9/output.raw.txt', '.utk/tools/git.status/observations/run-9/output.compact.toon', 'shell.git-status.v1', '0.97']
  }),
  fixture({
    name: 'implementation-status',
    category: 'Status reporting',
    useCase: 'Report implementation status with validation proof and remaining blocker.',
    testStrategy: 'Validation proof plus blocker string retention.',
    cavemanStrength: 'Dense implementation status with validation proof and blocker evidence.',
    utkApproach: 'Front-load done/proof/blocker/diff fields and remove labels where syntax is clear.',
    sourceText: [
      'The implementation added run checkpoint persistence and passed npm test --workspace @utk/evals.',
      'Publication is blocked because gh auth reports "The token in default is invalid".',
      'The recoverable diff is saved at C:/Users/conta/.codex/automations/tk39.diff.'
    ].join(' '),
    cavemanBaseline: 'Implementation done: run checkpoint persistence. Validation passed: `npm test --workspace @utk/evals`. Publish blocked: `"The token in default is invalid"`. Diff: `C:/Users/conta/.codex/automations/tk39.diff`.',
    utkCandidate: 'Run checkpoint persistence done. `npm test --workspace @utk/evals` passed. Publish blocked: `"The token in default is invalid"`. Diff `C:/Users/conta/.codex/automations/tk39.diff`.',
    requiredTerms: ['run checkpoint persistence', 'npm test --workspace @utk/evals', 'The token in default is invalid', 'C:/Users/conta/.codex/automations/tk39.diff']
  }),
  fixture({
    name: 'commit-message',
    category: 'Commit prose',
    useCase: 'Compress a Conventional Commit message while preserving scope and behavior.',
    testStrategy: 'Conventional Commit scope/type preservation with compact subject gate.',
    cavemanStrength: 'Very short commit subjects that keep type, scope, and concrete behavior.',
    utkApproach: 'Use normal Conventional Commit syntax and move only essential behavior into subject.',
    sourceText: 'Add caveman parity benchmark fixtures, metric helpers, and an AgentV code-grader wrapper that compares UTK terse outputs against caveman baselines.',
    cavemanBaseline: 'test(evals): add caveman parity benchmarks and AgentV autoevals grader',
    utkCandidate: 'test(evals): add caveman parity autoevals',
    requiredTerms: ['test(evals)', 'caveman parity', 'autoevals']
  }),
  fixture({
    name: 'slash-command-help',
    category: 'Command help',
    useCase: 'Explain a command switch compactly without losing mode names or stop phrase.',
    testStrategy: 'Slash-command syntax retention with stop-phrase coverage.',
    cavemanStrength: 'Tiny command help that preserves exact slash commands and mode names.',
    utkApproach: 'Use one-line syntax plus stop phrase, no explanatory preface.',
    sourceText: 'The caveman mode command supports /caveman lite, /caveman full, /caveman ultra, and /caveman wenyan. Users can leave the mode by saying stop caveman or normal mode.',
    cavemanBaseline: '`/caveman lite|full|ultra|wenyan` sets compression level. Stop with `stop caveman` or `normal mode`.',
    utkCandidate: '`/caveman lite|full|ultra|wenyan`; stop: `stop caveman` or `normal mode`.',
    requiredTerms: ['/caveman lite|full|ultra|wenyan', 'stop caveman', 'normal mode']
  }),
  fixture({
    name: 'security-auto-clarity',
    category: 'Safety clarity',
    useCase: 'Keep a security warning clear while still removing redundant prose.',
    testStrategy: 'Security warning consequence and mitigation retention.',
    cavemanStrength: 'Auto-clarity expands enough for irreversible or security-sensitive actions.',
    utkApproach: 'Keep explicit warning and irreversible consequence, then short mitigation.',
    sourceText: 'Warning: rotating the production signing key immediately invalidates all active sessions. Make sure the old key is backed up and a rollback plan exists before you apply the change.',
    cavemanBaseline: 'Warning: rotating production signing key invalidates all active sessions. Backup old key and confirm rollback plan before applying.',
    utkCandidate: 'Warning: rotate prod signing key -> all sessions invalid. Backup old key; confirm rollback plan first.',
    requiredTerms: ['Warning', 'prod signing key', 'all sessions invalid', 'Backup old key', 'rollback plan']
  }),
  fixture({
    name: 'mcp-tool-metadata',
    category: 'Tool metadata',
    useCase: 'Shrink MCP tool metadata while preserving tool name, scope, and safety boundary.',
    testStrategy: 'Tool identity plus safety-boundary term retention.',
    cavemanStrength: 'Removes tool-description filler without changing tool identity or boundaries.',
    utkApproach: 'Use schema-like fragments that keep tool name, allowed input, and local-only boundary.',
    sourceText: 'The detok MCP tool rewrites bulky natural-language text locally before it is sent to the model. It should not be used for secrets, private keys, source code blocks, or exact error strings.',
    cavemanBaseline: '`detok` rewrites bulky natural-language text locally before model use. Avoid secrets, private keys, code blocks, exact errors.',
    utkCandidate: '`detok`: local rewrite for bulky natural language. No secrets, private keys, code blocks, exact errors.',
    requiredTerms: ['detok', 'local', 'bulky natural language', 'secrets', 'private keys', 'code blocks', 'exact errors']
  }),
  fixture({
    name: 'benchmark-result',
    category: 'Benchmark reporting',
    useCase: 'Report benchmark result with pass counts, ratio, and next action.',
    testStrategy: 'Numeric result tuple retention: count, ratio, next action.',
    cavemanStrength: 'Dense numeric status with no dashboard-style prose.',
    utkApproach: 'Use metric-first result line with exact counts and ratio.',
    sourceText: 'The caveman parity benchmark completed successfully. It ran 11 tests and all 11 passed. The average candidate to caveman token ratio was 0.89. The next action is to publish the report.',
    cavemanBaseline: 'Caveman parity green: 11/11 tests. Avg candidate/caveman token ratio 0.89. Next: publish report.',
    utkCandidate: 'Caveman parity green: 11/11. Avg ratio 0.89. Next publish report.',
    requiredTerms: ['Caveman parity', '11/11', '0.89', 'publish report']
  }),
  fixture({
    name: 'incident-handoff',
    category: 'Operational handoff',
    useCase: 'Condense an incident handoff while preserving owner, severity, impact, and mitigation.',
    testStrategy: 'Incident handoff field retention for severity, owner, impact, mitigation.',
    cavemanStrength: 'Fast incident handoff with exactly the operational fields humans scan.',
    utkApproach: 'Field-prefix only the critical values and drop narrative sequence.',
    sourceText: 'Severity is SEV2. The owner is platform-oncall. The impact is elevated 500 errors on /api/codex/chat for approximately 12 percent of requests. The mitigation is to roll back deployment 2026.05.20.4.',
    cavemanBaseline: 'SEV2. Owner `platform-oncall`. Impact: 12% 500s on `/api/codex/chat`. Mitigation: roll back `2026.05.20.4`.',
    utkCandidate: 'SEV2. `platform-oncall`. 12% 500s on `/api/codex/chat`. Roll back `2026.05.20.4`.',
    requiredTerms: ['SEV2', 'platform-oncall', '12% 500s', '/api/codex/chat', '2026.05.20.4']
  }),
  fixture({
    name: 'api-contract-change',
    category: 'API contract',
    useCase: 'Summarize an API contract change with endpoint, field, compatibility, and migration.',
    testStrategy: 'API endpoint/field/value exactness under terse release-note compression.',
    cavemanStrength: 'Keeps endpoint and field names exact while stripping release-note filler.',
    utkApproach: 'Endpoint-first line with compatibility and migration tokens only.',
    sourceText: 'The endpoint POST /api/codex/chat now accepts providerOptions.reasoningEffort. The change is backward compatible because the field is optional. Clients can migrate by passing low, medium, high, or xhigh.',
    cavemanBaseline: '`POST /api/codex/chat` adds optional `providerOptions.reasoningEffort`. Backward compatible. Values: `low|medium|high|xhigh`.',
    utkCandidate: '`POST /api/codex/chat`: optional `providerOptions.reasoningEffort`; compatible. Values `low|medium|high|xhigh`.',
    requiredTerms: ['POST /api/codex/chat', 'providerOptions.reasoningEffort', 'optional', 'compatible', 'low|medium|high|xhigh']
  }),
  fixture({
    name: 'test-plan',
    category: 'Test planning',
    useCase: 'Compress a TDD plan while retaining red/green/refactor order and named gate.',
    testStrategy: 'TDD sequence retention with validation command anchor.',
    cavemanStrength: 'Short phased plans with exact validation commands.',
    utkApproach: 'Arrow-sequence plan with one final gate.',
    sourceText: 'Start by writing a failing regression test for missing artifact references. Then implement the compact response fix. Refactor only after the test is green. The final gate is npm test --workspace @utk/evals.',
    cavemanBaseline: 'TDD: red test for missing artifact refs -> compact response fix -> refactor after green. Gate: `npm test --workspace @utk/evals`.',
    utkCandidate: 'TDD: red missing artifact refs -> fix compact response -> refactor after green. Gate `npm test --workspace @utk/evals`.',
    requiredTerms: ['TDD', 'red', 'missing artifact refs', 'compact response', 'refactor after green', 'npm test --workspace @utk/evals']
  }),
  fixture({
    name: 'exact-error-string',
    category: 'Exact errors',
    useCase: 'Compress a failure report while preserving exact quoted Windows error text.',
    testStrategy: 'Case-sensitive exact error string retention.',
    cavemanStrength: 'Keeps exact error strings visible while dropping cause speculation.',
    utkApproach: 'Use blocker-first line and preserve quoted error verbatim.',
    sourceText: 'The publish run failed because the process reported Cannot read directory "../../../../..": Access is denied. This should be treated as an environment blocker rather than a code failure.',
    cavemanBaseline: 'Publish blocked by env error: `Cannot read directory "../../../../..": Access is denied.` Treat as environment blocker, not code failure.',
    utkCandidate: 'Publish blocked: `Cannot read directory "../../../../..": Access is denied.` Env blocker, not code failure.',
    requiredTerms: ['Publish blocked', 'Cannot read directory', 'Access is denied', 'Env blocker'],
    exactTerms: ['Cannot read directory "../../../../..": Access is denied.']
  }),
  fixture({
    name: 'windows-paths',
    category: 'Path preservation',
    useCase: 'Shrink a handoff containing Windows paths without normalizing separators.',
    testStrategy: 'Windows path separator preservation with exact-term checks.',
    cavemanStrength: 'Keeps file paths exact even in terse prose.',
    utkApproach: 'Use path-only evidence fields and keep backslashes untouched.',
    sourceText: 'The generated report is at C:\\Users\\conta\\.codex\\worktrees\\2f15\\utk\\docs\\internal\\caveman-parity-benchmark-results.md and the source fixture is at C:\\Users\\conta\\.codex\\worktrees\\2f15\\utk\\packages\\evals\\fixtures\\cavemanParityFixtures.ts.',
    cavemanBaseline: 'Report: `C:\\Users\\conta\\.codex\\worktrees\\2f15\\utk\\docs\\internal\\caveman-parity-benchmark-results.md`. Fixture: `C:\\Users\\conta\\.codex\\worktrees\\2f15\\utk\\packages\\evals\\fixtures\\cavemanParityFixtures.ts`.',
    utkCandidate: 'Report=C:\\Users\\conta\\.codex\\worktrees\\2f15\\utk\\docs\\internal\\caveman-parity-benchmark-results.md; Fixture=C:\\Users\\conta\\.codex\\worktrees\\2f15\\utk\\packages\\evals\\fixtures\\cavemanParityFixtures.ts',
    requiredTerms: ['Report', 'Fixture'],
    exactTerms: [
      'C:\\Users\\conta\\.codex\\worktrees\\2f15\\utk\\docs\\internal\\caveman-parity-benchmark-results.md',
      'C:\\Users\\conta\\.codex\\worktrees\\2f15\\utk\\packages\\evals\\fixtures\\cavemanParityFixtures.ts'
    ]
  }),
  fixture({
    name: 'json-config-diff',
    category: 'JSON/config',
    useCase: 'Summarize a config change while preserving JSON keys and numeric values exactly.',
    testStrategy: 'Quoted JSON key and before/after number preservation.',
    cavemanStrength: 'Retains quoted config keys and numbers without long explanation.',
    utkApproach: 'Use compact before/after key-value fragments.',
    sourceText: 'The model proxy settings changed max_context_tokens from 5000 to 3000 and prompt_compression_min_tokens from 10 to 1. The keys must stay quoted in the report.',
    cavemanBaseline: 'Config change: `"max_context_tokens": 5000 -> 3000`; `"prompt_compression_min_tokens": 10 -> 1`. Keep quoted keys.',
    utkCandidate: '`"max_context_tokens": 5000 -> 3000`; `"prompt_compression_min_tokens": 10 -> 1`. Quoted keys kept.',
    requiredTerms: ['max_context_tokens', '3000', 'prompt_compression_min_tokens', '1'],
    exactTerms: ['"max_context_tokens": 5000 -> 3000', '"prompt_compression_min_tokens": 10 -> 1']
  }),
  fixture({
    name: 'destructive-migration-warning',
    category: 'Safety clarity',
    useCase: 'Keep destructive database migration warning clear and ordered.',
    testStrategy: 'Order-sensitive destructive operation sequence check.',
    cavemanStrength: 'Expands enough for irreversible actions and order-sensitive instructions.',
    utkApproach: 'Use explicit warning plus ordered action list with no extra prose.',
    sourceText: 'Dropping the legacy_events.payload column is irreversible after the migration is applied. The operator must take a backup, run the migration, verify row counts, and only then delete the backup.',
    cavemanBaseline: 'Warning: `DROP legacy_events.payload` irreversible after migration. Order: backup -> migrate -> verify row counts -> delete backup.',
    utkCandidate: 'Warning: `DROP legacy_events.payload` irreversible. Order: backup -> migrate -> verify rows -> delete backup.',
    requiredTerms: ['Warning', 'DROP legacy_events.payload', 'irreversible', 'backup', 'migrate', 'verify rows', 'delete backup'],
    orderedTerms: ['backup', 'migrate', 'verify rows', 'delete backup']
  }),
  fixture({
    name: 'negative-review-result',
    category: 'Code review',
    useCase: 'Report no findings without implying hidden defects.',
    testStrategy: 'Negative finding guard with forbidden false-positive defect terms.',
    cavemanStrength: 'Short no-issue result with residual test gap.',
    utkApproach: 'State no actionable findings, then one residual risk.',
    sourceText: 'The code review found no actionable issues. The only residual risk is that browser visual smoke was not run in this environment.',
    cavemanBaseline: 'No actionable findings. Residual risk: browser visual smoke not run in this env.',
    utkCandidate: 'No actionable findings. Risk: browser visual smoke not run.',
    requiredTerms: ['No actionable findings', 'browser visual smoke', 'not run'],
    forbiddenTerms: ['bug', 'defect', 'failure']
  }),
  fixture({
    name: 'ordered-publish-steps',
    category: 'Ordered operations',
    useCase: 'Compress publish instructions where order matters.',
    testStrategy: 'Publish chain order check using ordered terms.',
    cavemanStrength: 'Keeps multi-step operational order with arrows.',
    utkApproach: 'Drop labels and preserve ordered command chain.',
    sourceText: 'To publish safely, rebase on origin/main first, resolve conflicts second, run npm test third, push the branch fourth, and then open the pull request.',
    cavemanBaseline: 'Publish order: rebase `origin/main` -> resolve conflicts -> `npm test` -> push branch -> open PR.',
    utkCandidate: 'Publish: rebase `origin/main` -> resolve conflicts -> `npm test` -> push -> open PR.',
    requiredTerms: ['rebase', 'origin/main', 'resolve conflicts', 'npm test', 'push', 'open PR'],
    orderedTerms: ['rebase', 'resolve conflicts', 'npm test', 'push', 'open PR']
  }),
  fixture({
    name: 'secret-redaction',
    category: 'Secret safety',
    useCase: 'Compress secret-leak finding while proving the secret is not repeated.',
    testStrategy: 'Redaction exactness plus forbidden secret leakage check.',
    cavemanStrength: 'Warns and redacts rather than echoing sensitive values.',
    utkApproach: 'Preserve variable/path/action and replace secret with redaction token.',
    sourceText: 'The .env.local file contains OPENAI_API_KEY=sk-live-1234567890abcdef. Do not repeat the value. Rotate the key and remove it from the file.',
    cavemanBaseline: 'Secret leak in `.env.local`: `OPENAI_API_KEY=[REDACTED]`. Rotate key; remove from file. Do not echo value.',
    utkCandidate: 'Secret leak `.env.local`: `OPENAI_API_KEY=[REDACTED]`. Rotate; remove. Do not echo.',
    requiredTerms: ['Secret leak', '.env.local', 'OPENAI_API_KEY', '[REDACTED]', 'Rotate'],
    exactTerms: ['OPENAI_API_KEY=[REDACTED]'],
    forbiddenTerms: ['sk-live-1234567890abcdef']
  }),
  fixture({
    name: 'latency-regression',
    category: 'Performance',
    useCase: 'Report a performance regression with exact p95 and budget values.',
    testStrategy: 'Metric inequality exactness with p95/budget pattern.',
    cavemanStrength: 'Condenses metric deltas while keeping threshold math readable.',
    utkApproach: 'Use metric equation with exact p95, budget, and culprit.',
    sourceText: 'The benchmark regressed because p95 latency is 184 milliseconds while the budget is 150 milliseconds. The likely culprit is autoevals JSONDiff setup work during report generation.',
    cavemanBaseline: 'Perf regression: p95 184ms > 150ms budget. Culprit likely autoevals JSONDiff setup during report generation.',
    utkCandidate: 'Perf red: p95 184ms > 150ms. Culprit: autoevals JSONDiff setup in report gen.',
    requiredTerms: ['p95 184ms', '150ms', 'autoevals JSONDiff', 'report gen'],
    exactTerms: ['p95 184ms > 150ms']
  }),
  fixture({
    name: 'timestamp-timezone',
    category: 'Time precision',
    useCase: 'Compress a scheduling note while preserving offset timestamp and local timezone.',
    testStrategy: 'Regex-gate ISO-like timestamp with UTC offset and timezone label.',
    cavemanStrength: 'Keeps date/time exact without calendar prose.',
    utkApproach: 'Use timestamp-first note and drop sentence wrapper.',
    sourceText: 'The reminder should run at 2026-05-21 14:03:22-05:00 America/Chicago and must not be converted to UTC in the summary.',
    cavemanBaseline: 'Reminder at `2026-05-21 14:03:22-05:00 America/Chicago`; do not convert to UTC.',
    utkCandidate: 'Reminder `2026-05-21 14:03:22-05:00 America/Chicago`; no UTC conversion.',
    requiredTerms: ['2026-05-21 14:03:22-05:00', 'America/Chicago', 'no UTC conversion'],
    requiredPatterns: ['2026-05-21\\s+14:03:22-05:00\\s+America/Chicago']
  }),
  fixture({
    name: 'url-query-fragment',
    category: 'URL preservation',
    useCase: 'Shrink a link handoff while preserving query params and fragment.',
    testStrategy: 'Exact URL preservation including query order and fragment.',
    cavemanStrength: 'Keeps full URLs intact while cutting link explanation.',
    utkApproach: 'Use URL as the primary payload and one short action.',
    sourceText: 'Send the reviewer to https://agentv.dev/docs/integrations/autoevals-integration/?tab=typescript#code-grader and ask them to verify the TypeScript code-grader example.',
    cavemanBaseline: 'Reviewer link: `https://agentv.dev/docs/integrations/autoevals-integration/?tab=typescript#code-grader`; verify TS code-grader example.',
    utkCandidate: 'Verify TS code-grader: https://agentv.dev/docs/integrations/autoevals-integration/?tab=typescript#code-grader',
    requiredTerms: ['https://agentv.dev/docs/integrations/autoevals-integration/?tab=typescript#code-grader', 'TS code-grader'],
    exactTerms: ['https://agentv.dev/docs/integrations/autoevals-integration/?tab=typescript#code-grader']
  }),
  fixture({
    name: 'semver-range',
    category: 'Version constraints',
    useCase: 'Compress dependency guidance while preserving a complex semver range.',
    testStrategy: 'Exact semver range check with forbidden simplified range.',
    cavemanStrength: 'Keeps version expressions exact.',
    utkApproach: 'Remove rationale, keep package and range only.',
    sourceText: 'The package should accept autoevals versions matching ^0.0.132 || >=0.1.0 <0.2.0. Do not simplify this to latest because CI must remain deterministic.',
    cavemanBaseline: '`autoevals` range: `^0.0.132 || >=0.1.0 <0.2.0`. Do not use `latest`; CI deterministic.',
    utkCandidate: '`autoevals`: `^0.0.132 || >=0.1.0 <0.2.0`; no `latest`.',
    requiredTerms: ['autoevals', '^0.0.132 || >=0.1.0 <0.2.0', 'no `latest`'],
    exactTerms: ['^0.0.132 || >=0.1.0 <0.2.0'],
    forbiddenTerms: ['latest because']
  }),
  fixture({
    name: 'env-precedence',
    category: 'Configuration precedence',
    useCase: 'Summarize config precedence without changing order.',
    testStrategy: 'Ordered precedence chain check with three exact sources.',
    cavemanStrength: 'Turns precedence rules into a compact ordered chain.',
    utkApproach: 'Use highest-to-lowest arrow chain.',
    sourceText: 'Configuration precedence is command-line flag first, then UTK_CONFIG_PATH, then .utk/config.toml, then built-in defaults.',
    cavemanBaseline: 'Precedence: CLI flag -> `UTK_CONFIG_PATH` -> `.utk/config.toml` -> built-in defaults.',
    utkCandidate: 'Precedence: CLI flag -> `UTK_CONFIG_PATH` -> `.utk/config.toml` -> defaults.',
    requiredTerms: ['CLI flag', 'UTK_CONFIG_PATH', '.utk/config.toml', 'defaults'],
    orderedTerms: ['CLI flag', 'UTK_CONFIG_PATH', '.utk/config.toml', 'defaults']
  }),
  fixture({
    name: 'zero-failure-summary',
    category: 'Negative metrics',
    useCase: 'Report zero failures without accidentally implying a failure.',
    testStrategy: 'Forbidden-pattern gate blocks failed/failing/failure while preserving zero count.',
    cavemanStrength: 'Can state clean result tersely.',
    utkApproach: 'Use green count and avoid failure-family words.',
    sourceText: 'The run completed successfully with 0 failures, 0 skipped tests, and 312 passing tests.',
    cavemanBaseline: 'Green: 312 passing, 0 failures, 0 skipped.',
    utkCandidate: 'Green: 312 pass, 0 fail, 0 skip.',
    requiredTerms: ['Green', '312', '0 fail', '0 skip'],
    forbiddenPatterns: ['failures|failed|failing']
  }),
  fixture({
    name: 'percentage-delta',
    category: 'Numeric precision',
    useCase: 'Compress a benchmark delta with sign, decimal, and baseline preserved.',
    testStrategy: 'Regex-gate signed decimal percentage and baseline value.',
    cavemanStrength: 'Short numeric comparisons with readable directionality.',
    utkApproach: 'Use equation-style result with signed delta.',
    sourceText: 'The prompt cost improved by negative 12.5 percent compared with the baseline of 8,192 tokens, ending at 7,168 tokens.',
    cavemanBaseline: 'Prompt cost: 8,192 -> 7,168 tokens, -12.5%.',
    utkCandidate: '8,192->7,168 (-12.5%).',
    requiredTerms: ['8,192', '7,168', '-12.5%'],
    requiredPatterns: ['8,192->7,168 \\(-12\\.5%\\)']
  }),
  fixture({
    name: 'table-row',
    category: 'Table compression',
    useCase: 'Compress a table row while preserving column-value associations.',
    testStrategy: 'Pattern checks NAME/STATUS/TOKENS associations in one compact row.',
    cavemanStrength: 'Keeps tabular values scannable with less surrounding text.',
    utkApproach: 'Convert row to key=value tuple.',
    sourceText: 'In the benchmark table, the row has NAME core, STATUS pass, TOKENS 124, and RATIO 0.82.',
    cavemanBaseline: 'Table row: NAME=core STATUS=pass TOKENS=124 RATIO=0.82.',
    utkCandidate: 'Row core/pass/124/0.82.',
    requiredTerms: ['core', 'pass', '124', '0.82'],
    requiredPatterns: ['core/pass/124/0\\.82']
  }),
  fixture({
    name: 'stack-trace-top-frame',
    category: 'Stack traces',
    useCase: 'Summarize stack trace by preserving top frame and error.',
    testStrategy: 'Exact top frame retention plus lower-frame omission guard.',
    cavemanStrength: 'Keeps the actionable top frame and error type.',
    utkApproach: 'Top-frame-only summary.',
    sourceText: 'The stack trace begins with TypeError: Cannot read properties of undefined, then at parseConfig (src/config.ts:42:13), then at loadConfig (src/config.ts:80:9).',
    cavemanBaseline: '`TypeError: Cannot read properties of undefined` at `parseConfig (src/config.ts:42:13)`. Lower frames omitted.',
    utkCandidate: '`TypeError: Cannot read properties of undefined` @ `parseConfig (src/config.ts:42:13)`.',
    requiredTerms: ['TypeError', 'Cannot read properties of undefined', 'parseConfig (src/config.ts:42:13)'],
    exactTerms: ['parseConfig (src/config.ts:42:13)'],
    forbiddenTerms: ['loadConfig (src/config.ts:80:9)']
  }),
  fixture({
    name: 'shell-quote-command',
    category: 'Shell quoting',
    useCase: 'Compress shell guidance without changing quotes or spaces.',
    testStrategy: 'Exact command retention with quoted commit message.',
    cavemanStrength: 'Preserves shell syntax while shrinking instructions.',
    utkApproach: 'Command-only output plus one caution.',
    sourceText: 'Run git commit -m "fix: handle spaces" after staging the benchmark files, and do not remove the quotes around the commit message.',
    cavemanBaseline: 'Run `git commit -m "fix: handle spaces"` after staging. Keep quotes.',
    utkCandidate: '`git commit -m "fix: handle spaces"` after staging; keep quotes.',
    requiredTerms: ['git commit', 'fix: handle spaces', 'keep quotes'],
    exactTerms: ['git commit -m "fix: handle spaces"']
  }),
  fixture({
    name: 'sql-where-clause',
    category: 'SQL safety',
    useCase: 'Summarize SQL filter change without losing tenant isolation.',
    testStrategy: 'Exact WHERE clause retention and forbidden tenantless query pattern.',
    cavemanStrength: 'Keeps SQL predicates exact under compression.',
    utkApproach: 'Predicate-only summary with risk removed.',
    sourceText: 'The SQL query must include WHERE tenant_id = $1 AND deleted_at IS NULL before ordering by created_at desc.',
    cavemanBaseline: 'SQL must include `WHERE tenant_id = $1 AND deleted_at IS NULL` before `ORDER BY created_at DESC`.',
    utkCandidate: 'SQL: `WHERE tenant_id = $1 AND deleted_at IS NULL` before order.',
    requiredTerms: ['WHERE tenant_id = $1 AND deleted_at IS NULL', 'before order'],
    exactTerms: ['WHERE tenant_id = $1 AND deleted_at IS NULL'],
    forbiddenPatterns: ['WHERE deleted_at IS NULL']
  }),
  fixture({
    name: 'yaml-frontmatter',
    category: 'YAML metadata',
    useCase: 'Compress documentation metadata while preserving YAML booleans and tag list.',
    testStrategy: 'Exact YAML key/value snippets retained.',
    cavemanStrength: 'Keeps metadata literals exact.',
    utkApproach: 'Inline YAML snippets only.',
    sourceText: 'The documentation frontmatter should set draft: false and tags: [evals, caveman, autoevals].',
    cavemanBaseline: 'Frontmatter metadata: `draft: false`; tags list `[evals, caveman, autoevals]`.',
    utkCandidate: '`draft: false`; `tags: [evals, caveman, autoevals]`.',
    requiredTerms: ['draft: false', 'tags: [evals, caveman, autoevals]'],
    exactTerms: ['draft: false', 'tags: [evals, caveman, autoevals]']
  }),
  fixture({
    name: 'graph-edge-path',
    category: 'Graph state',
    useCase: 'Summarize graph traversal without inserting nonexistent nodes.',
    testStrategy: 'Ordered path check plus forbidden extra node.',
    cavemanStrength: 'Keeps compact graph paths readable.',
    utkApproach: 'Bare path with omitted-node guard.',
    sourceText: 'The dependency path goes from agent-browser to benchmarkModelRouting to sessionState. It does not pass through SettingsPanel.',
    cavemanBaseline: 'Path: `agent-browser -> benchmarkModelRouting -> sessionState`. Not through `SettingsPanel`.',
    utkCandidate: '`agent-browser -> benchmarkModelRouting -> sessionState`; no `SettingsPanel`.',
    requiredTerms: ['agent-browser', 'benchmarkModelRouting', 'sessionState'],
    orderedTerms: ['agent-browser', 'benchmarkModelRouting', 'sessionState'],
    forbiddenTerms: ['through SettingsPanel']
  }),
  fixture({
    name: 'wcag-contrast',
    category: 'Accessibility',
    useCase: 'Compress accessibility finding with WCAG id, ratio, threshold, and fix.',
    testStrategy: 'WCAG identifier and contrast ratio regex checks.',
    cavemanStrength: 'Keeps accessibility standard IDs exact.',
    utkApproach: 'Metric-first a11y finding.',
    sourceText: 'The button fails WCAG 2.2 AA 1.4.3 because the contrast is 3.9:1 and the threshold is 4.5:1. Darken the foreground color.',
    cavemanBaseline: 'A11y fail: WCAG 2.2 AA 1.4.3, contrast 3.9:1 < 4.5:1. Fix: darken foreground.',
    utkCandidate: 'A11y: WCAG 2.2 AA 1.4.3; 3.9:1 < 4.5:1. Darken fg.',
    requiredTerms: ['WCAG 2.2 AA 1.4.3', '3.9:1 < 4.5:1', 'Darken'],
    requiredPatterns: ['3\\.9:1\\s+<\\s+4\\.5:1']
  }),
  fixture({
    name: 'icu-placeholder',
    category: 'Localization',
    useCase: 'Shrink localization note while preserving ICU placeholder syntax.',
    testStrategy: 'Exact ICU placeholder retention.',
    cavemanStrength: 'Keeps placeholder syntax verbatim.',
    utkApproach: 'Placeholder-only note with no localization prose.',
    sourceText: 'The translation string must keep the ICU placeholder {count, plural, one {# file} other {# files}} exactly, because the runtime parser depends on it.',
    cavemanBaseline: 'Keep ICU exactly: `{count, plural, one {# file} other {# files}}`; parser depends on it.',
    utkCandidate: 'Keep ICU `{count, plural, one {# file} other {# files}}`; parser needs it.',
    requiredTerms: ['{count, plural, one {# file} other {# files}}', 'parser'],
    exactTerms: ['{count, plural, one {# file} other {# files}}']
  }),
  fixture({
    name: 'markdown-link',
    category: 'Markdown',
    useCase: 'Compress link guidance while preserving Markdown link target.',
    testStrategy: 'Exact Markdown link retention.',
    cavemanStrength: 'Keeps Markdown syntax intact.',
    utkApproach: 'Use link as command target.',
    sourceText: 'Link to the AgentV autoevals documentation using [AgentV autoevals](https://agentv.dev/docs/integrations/autoevals-integration/) and do not paste the bare URL separately.',
    cavemanBaseline: 'Use `[AgentV autoevals](https://agentv.dev/docs/integrations/autoevals-integration/)`; no bare URL duplicate.',
    utkCandidate: 'Use [AgentV autoevals](https://agentv.dev/docs/integrations/autoevals-integration/); no duplicate.',
    requiredTerms: ['[AgentV autoevals](https://agentv.dev/docs/integrations/autoevals-integration/)', 'no duplicate'],
    exactTerms: ['[AgentV autoevals](https://agentv.dev/docs/integrations/autoevals-integration/)']
  }),
  fixture({
    name: 'sha256-checksum',
    category: 'Integrity',
    useCase: 'Report artifact checksum without truncation.',
    testStrategy: 'SHA-256 length/pattern and exact checksum retention.',
    cavemanStrength: 'Can keep long hashes exact.',
    utkApproach: 'Hash-first integrity line.',
    sourceText: 'The downloaded archive checksum is sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00123456789abcdef0123456789abcdef and the expected size is 42 MB.',
    cavemanBaseline: 'Archive: `sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00123456789abcdef0123456789abcdef`, size 42 MB.',
    utkCandidate: 'Archive sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00123456789abcdef0123456789abcdef; 42 MB.',
    requiredTerms: ['sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00123456789abcdef0123456789abcdef', '42 MB'],
    requiredPatterns: ['sha256:[0-9a-f]{64}'],
    exactTerms: ['sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00123456789abcdef0123456789abcdef']
  }),
  fixture({
    name: 'exit-code-signal',
    category: 'Process status',
    useCase: 'Compress process failure with exit code and signal.',
    testStrategy: 'Exit code and signal exactness with forbidden wrong-cause phrase.',
    cavemanStrength: 'Keeps process result compact and actionable.',
    utkApproach: 'Exit tuple plus likely cause only.',
    sourceText: 'The worker exited with code 137 after receiving SIGKILL. Treat this as a memory or external kill condition, not a TypeScript compile failure.',
    cavemanBaseline: 'Worker exit 137 (`SIGKILL`). Likely memory/external kill, not TypeScript compile failure.',
    utkCandidate: 'Worker exit 137/SIGKILL. Likely memory/external kill, not TS compile.',
    requiredTerms: ['exit 137', 'SIGKILL', 'memory/external kill', 'not TS compile'],
    forbiddenTerms: ['TypeScript compile failure']
  }),
  fixture({
    name: 'partial-success',
    category: 'Mixed outcomes',
    useCase: 'Report mixed test result without flattening to pass/fail.',
    testStrategy: 'Fractional outcome retention with forbidden all-green claim.',
    cavemanStrength: 'Compactly preserves partial status.',
    utkApproach: 'Tuple result with next failing slice.',
    sourceText: 'The batch run had 3 passed shards, 1 failed shard, and 2 skipped shards. The failed shard is windows-node20.',
    cavemanBaseline: 'Batch: 3 passed, 1 failed, 2 skipped. Failed shard: `windows-node20`.',
    utkCandidate: 'Batch 3 pass / 1 fail / 2 skip; failed `windows-node20`.',
    requiredTerms: ['3 pass', '1 fail', '2 skip', 'windows-node20'],
    forbiddenTerms: ['all green', 'fully passed']
  }),
  fixture({
    name: 'license-notice',
    category: 'License',
    useCase: 'Compress license notice while preserving license, copyright holder, and year.',
    testStrategy: 'Legal notice tuple exactness without adding license claims.',
    cavemanStrength: 'Keeps legal metadata concise.',
    utkApproach: 'Tuple style notice.',
    sourceText: 'The third-party snippet is licensed under MIT, copyright 2026 Example Labs, and must retain the NOTICE file.',
    cavemanBaseline: 'Third-party snippet: MIT; Copyright 2026 Example Labs; retain NOTICE.',
    utkCandidate: 'Snippet: MIT; Copyright 2026 Example Labs; keep NOTICE.',
    requiredTerms: ['MIT', 'Copyright 2026 Example Labs', 'NOTICE'],
    forbiddenTerms: ['Apache', 'GPL']
  }),
  fixture({
    name: 'retention-policy',
    category: 'Privacy',
    useCase: 'Summarize data-retention rule without weakening privacy terms.',
    testStrategy: 'Retention window and jurisdiction retention with forbidden over-retention.',
    cavemanStrength: 'Keeps policy limits visible.',
    utkApproach: 'Policy tuple with max retention and deletion action.',
    sourceText: 'The privacy rule allows storing PII for at most 30 days in EU regions, after which the records must be deleted.',
    cavemanBaseline: 'Privacy: PII max 30 days, EU regions only, then delete records.',
    utkCandidate: 'PII: max 30 days; EU only; delete after.',
    requiredTerms: ['PII', 'max 30 days', 'EU', 'delete'],
    forbiddenTerms: ['forever', 'indefinite', 'US regions']
  }),
  fixture({
    name: 'currency-rounding',
    category: 'Finance',
    useCase: 'Compress invoice delta while preserving cents and no-rounding instruction.',
    testStrategy: 'Currency literal and decimal-cent exactness with forbidden rounded amount.',
    cavemanStrength: 'Keeps money values exact.',
    utkApproach: 'Equation-only currency delta.',
    sourceText: 'The invoice changed from $1,234.56 to $1,199.99, which is a decrease of $34.57. Do not round to whole dollars.',
    cavemanBaseline: 'Invoice: `$1,234.56 -> $1,199.99`, delta `-$34.57`; do not round.',
    utkCandidate: '`$1,234.56->$1,199.99`; delta `-$34.57`; no round.',
    requiredTerms: ['$1,234.56', '$1,199.99', '-$34.57', 'no round'],
    exactTerms: ['$1,234.56->$1,199.99', '-$34.57'],
    forbiddenTerms: ['$1,200', '$35']
  }),
  fixture({
    name: 'scientific-notation',
    category: 'Numeric precision',
    useCase: 'Preserve scientific notation and comparison direction.',
    testStrategy: 'Scientific notation pattern retention with inequality direction.',
    cavemanStrength: 'Keeps compact numeric notation intact.',
    utkApproach: 'Metric inequality only.',
    sourceText: 'The measured epsilon is 1.0e-7 and it must remain below the tolerance of 2.5e-6.',
    cavemanBaseline: 'Epsilon `1.0e-7` < tolerance `2.5e-6`.',
    utkCandidate: '`1.0e-7 < 2.5e-6`.',
    requiredTerms: ['1.0e-7', '2.5e-6'],
    requiredPatterns: ['1\\.0e-7\\s+<\\s+2\\.5e-6']
  }),
  fixture({
    name: 'ipv6-cidr',
    category: 'Networking',
    useCase: 'Compress firewall rule while preserving IPv6 CIDR.',
    testStrategy: 'IPv6 CIDR exactness with forbidden IPv4 replacement.',
    cavemanStrength: 'Keeps network identifiers exact.',
    utkApproach: 'Rule tuple without explanatory prose.',
    sourceText: 'Allow outbound HTTPS to IPv6 range 2001:db8:85a3::/64 and deny all other egress.',
    cavemanBaseline: 'Firewall: allow HTTPS to `2001:db8:85a3::/64`; deny other egress.',
    utkCandidate: 'Allow HTTPS `2001:db8:85a3::/64`; deny rest.',
    requiredTerms: ['HTTPS', '2001:db8:85a3::/64', 'deny'],
    exactTerms: ['2001:db8:85a3::/64'],
    forbiddenPatterns: ['\\b\\d+\\.\\d+\\.\\d+\\.\\d+\\b']
  }),
  fixture({
    name: 'dns-cname-chain',
    category: 'DNS',
    useCase: 'Summarize DNS routing while preserving CNAME chain order.',
    testStrategy: 'Ordered DNS CNAME chain retention.',
    cavemanStrength: 'Turns DNS chain into compact arrows.',
    utkApproach: 'Bare hostname chain.',
    sourceText: 'The DNS path is app.example.com CNAME edge.example.net CNAME cdn.vendor.net, and the A record is not on app.example.com.',
    cavemanBaseline: 'DNS: `app.example.com -> edge.example.net -> cdn.vendor.net`; no A on app host.',
    utkCandidate: '`app.example.com -> edge.example.net -> cdn.vendor.net`; no app A.',
    requiredTerms: ['app.example.com', 'edge.example.net', 'cdn.vendor.net', 'no app A'],
    orderedTerms: ['app.example.com', 'edge.example.net', 'cdn.vendor.net']
  }),
  fixture({
    name: 'http-retry-after',
    category: 'HTTP',
    useCase: 'Compress HTTP throttle result while preserving status and Retry-After seconds.',
    testStrategy: 'Header-name exactness and numeric retry delay retention.',
    cavemanStrength: 'Keeps HTTP status/header pairs concise.',
    utkApproach: 'Status/header tuple.',
    sourceText: 'The API returned HTTP 429 Too Many Requests with Retry-After: 120, so clients should retry after 120 seconds.',
    cavemanBaseline: 'HTTP 429 `Too Many Requests`; `Retry-After: 120`; retry after 120s.',
    utkCandidate: 'HTTP 429; `Retry-After: 120`; retry 120s.',
    requiredTerms: ['HTTP 429', 'Retry-After: 120', '120s'],
    exactTerms: ['Retry-After: 120']
  }),
  fixture({
    name: 'grpc-status',
    category: 'gRPC',
    useCase: 'Summarize gRPC failure while preserving canonical code and retryability.',
    testStrategy: 'gRPC code/name pair retention with retry flag.',
    cavemanStrength: 'Keeps status code and retry decision visible.',
    utkApproach: 'Code/name/retry tuple.',
    sourceText: 'The RPC failed with gRPC status code 14 UNAVAILABLE and is retryable with exponential backoff.',
    cavemanBaseline: 'gRPC `14 UNAVAILABLE`; retryable with exponential backoff.',
    utkCandidate: 'gRPC 14/UNAVAILABLE; retry with backoff.',
    requiredTerms: ['gRPC', '14', 'UNAVAILABLE', 'retry'],
    requiredPatterns: ['gRPC\\s+14/UNAVAILABLE']
  }),
  fixture({
    name: 'otel-trace-span',
    category: 'Observability',
    useCase: 'Compress trace handoff while preserving trace id and span id.',
    testStrategy: 'Hex trace/span length pattern checks.',
    cavemanStrength: 'Preserves trace identifiers exactly.',
    utkApproach: 'Trace/span tuple.',
    sourceText: 'Investigate trace id 4bf92f3577b34da6a3ce929d0e0e4736 and span id 00f067aa0ba902b7 for the slow request.',
    cavemanBaseline: 'Investigate trace `4bf92f3577b34da6a3ce929d0e0e4736`, span `00f067aa0ba902b7`.',
    utkCandidate: 'trace 4bf92f3577b34da6a3ce929d0e0e4736; span 00f067aa0ba902b7.',
    requiredTerms: ['4bf92f3577b34da6a3ce929d0e0e4736', '00f067aa0ba902b7'],
    requiredPatterns: ['trace\\s+[0-9a-f]{32}', 'span\\s+[0-9a-f]{16}']
  }),
  fixture({
    name: 'jwt-redaction',
    category: 'Token safety',
    useCase: 'Compress JWT leak report while preserving header algorithm and redacting payload.',
    testStrategy: 'Allowed JWT header claim retention plus forbidden JWT-looking token pattern.',
    cavemanStrength: 'Redacts sensitive token body while keeping useful header fact.',
    utkApproach: 'Header alg plus redaction marker only.',
    sourceText: 'The log includes JWT eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature. Report alg RS256 but do not echo the token.',
    cavemanBaseline: 'JWT leak: alg `RS256`; token `[REDACTED]`; do not echo token.',
    utkCandidate: 'JWT leak: alg RS256; token [REDACTED].',
    requiredTerms: ['JWT leak', 'RS256', '[REDACTED]'],
    forbiddenPatterns: ['eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.signature']
  }),
  fixture({
    name: 'email-redaction',
    category: 'PII redaction',
    useCase: 'Summarize user report while redacting email local-part.',
    testStrategy: 'Domain retention with forbidden full email address.',
    cavemanStrength: 'Keeps useful PII context without full value leakage.',
    utkApproach: 'Masked email only.',
    sourceText: 'The affected account is jane.doe+trial@example.com. Redact the local-part but keep example.com.',
    cavemanBaseline: 'Affected account: `[REDACTED]@example.com`; full local-part redacted.',
    utkCandidate: 'Account `[REDACTED]@example.com`.',
    requiredTerms: ['[REDACTED]@example.com'],
    exactTerms: ['[REDACTED]@example.com'],
    forbiddenTerms: ['jane.doe+trial@example.com']
  }),
  fixture({
    name: 'csv-quoted-comma',
    category: 'CSV',
    useCase: 'Compress CSV row while preserving a quoted comma field.',
    testStrategy: 'Quoted CSV field exactness with comma inside quotes.',
    cavemanStrength: 'Keeps CSV escaping intact.',
    utkApproach: 'Row literal only.',
    sourceText: 'The CSV row is id,name,note then 7,"Smith, Ada","needs review". The comma inside Smith, Ada must stay quoted.',
    cavemanBaseline: 'CSV row: `7,"Smith, Ada","needs review"`; keep quoted comma.',
    utkCandidate: '`7,"Smith, Ada","needs review"`.',
    requiredTerms: ['7', 'Smith, Ada', 'needs review'],
    exactTerms: ['7,"Smith, Ada","needs review"']
  }),
  fixture({
    name: 'glob-negation',
    category: 'Glob patterns',
    useCase: 'Summarize file filter while preserving include and negation globs.',
    testStrategy: 'Exact glob include/exclude pattern retention.',
    cavemanStrength: 'Keeps glob syntax exact.',
    utkApproach: 'Include/exclude tuple.',
    sourceText: 'Search files matching **/*.test.ts but exclude **/*.snap.ts.',
    cavemanBaseline: 'Search `**/*.test.ts`; exclude `**/*.snap.ts`.',
    utkCandidate: '`**/*.test.ts`; !`**/*.snap.ts`.',
    requiredTerms: ['**/*.test.ts', '**/*.snap.ts'],
    exactTerms: ['**/*.test.ts', '**/*.snap.ts']
  }),
  fixture({
    name: 'regex-literal',
    category: 'Regex',
    useCase: 'Compress regex guidance while preserving anchors and groups.',
    testStrategy: 'Exact regex literal retention with forbidden unanchored variant.',
    cavemanStrength: 'Preserves punctuation-heavy regex.',
    utkApproach: 'Regex-only note.',
    sourceText: 'Use the regex ^(feat|fix|test)\\([^)]+\\): .+$ for commit subjects. Do not drop the anchors.',
    cavemanBaseline: 'Regex required: `^(feat|fix|test)\\([^)]+\\): .+$`; anchors stay.',
    utkCandidate: '`^(feat|fix|test)\\([^)]+\\): .+$`; keep anchors.',
    requiredTerms: ['^(feat|fix|test)\\([^)]+\\): .+$', 'anchors'],
    exactTerms: ['^(feat|fix|test)\\([^)]+\\): .+$']
  }),
  fixture({
    name: 'feature-flag-rollout',
    category: 'Feature flags',
    useCase: 'Compress rollout status while preserving flag, cohort, and percentage.',
    testStrategy: 'Flag name plus staged percentage retention.',
    cavemanStrength: 'Summarizes rollout knobs compactly.',
    utkApproach: 'Flag/cohort/percent tuple.',
    sourceText: 'The feature flag agentv_caveman_bench is enabled for beta-users at 25 percent and disabled for everyone else.',
    cavemanBaseline: 'Flag `agentv_caveman_bench`: beta-users 25%, everyone else off.',
    utkCandidate: '`agentv_caveman_bench`: beta-users 25%; others off.',
    requiredTerms: ['agentv_caveman_bench', 'beta-users', '25%', 'off']
  }),
  fixture({
    name: 'ab-cohort',
    category: 'Experimentation',
    useCase: 'Report A/B split without swapping control and variant.',
    testStrategy: 'Control/variant association pattern checks.',
    cavemanStrength: 'Keeps experiment splits compact.',
    utkApproach: 'Arm=value pairs only.',
    sourceText: 'Experiment exp-17 sends control to 60 percent and variant B to 40 percent.',
    cavemanBaseline: '`exp-17`: control 60%, variant B 40%.',
    utkCandidate: '`exp-17`: control=60%, B=40%.',
    requiredTerms: ['exp-17', 'control=60%', 'B=40%'],
    requiredPatterns: ['control=60%,\\s+B=40%']
  }),
  fixture({
    name: 'matrix-shape',
    category: 'ML tensors',
    useCase: 'Summarize tensor shape and dtype without transposing dimensions.',
    testStrategy: 'Dimension order pattern retention.',
    cavemanStrength: 'Keeps tensor metadata concise.',
    utkApproach: 'Shape/dtype tuple.',
    sourceText: 'The tensor has shape [2, 3, 768] and dtype float16. Do not transpose to [3, 2, 768].',
    cavemanBaseline: 'Tensor: shape `[2, 3, 768]`, dtype `float16`; do not transpose.',
    utkCandidate: 'Tensor [2,3,768] float16; no transpose.',
    requiredTerms: ['[2,3,768]', 'float16', 'no transpose'],
    forbiddenTerms: ['[3,2,768]']
  }),
  fixture({
    name: 'unit-preservation',
    category: 'Units',
    useCase: 'Compress measurement while preserving original units and no-conversion rule.',
    testStrategy: 'Original unit retention with forbidden converted value.',
    cavemanStrength: 'Avoids accidental unit conversion.',
    utkApproach: 'Value/unit plus no-convert guard.',
    sourceText: 'The memory budget is 512 MiB and should not be converted to MB in the report.',
    cavemanBaseline: 'Memory budget `512 MiB`; do not convert to MB.',
    utkCandidate: '`512 MiB`; no MB conversion.',
    requiredTerms: ['512 MiB', 'no MB conversion'],
    forbiddenTerms: ['536 MB', '512 MB']
  }),
  fixture({
    name: 'crlf-warning',
    category: 'Line endings',
    useCase: 'Summarize Git line-ending warning without changing LF/CRLF terms.',
    testStrategy: 'Exact Git warning phrase retention.',
    cavemanStrength: 'Keeps warning text exact.',
    utkApproach: 'Warning phrase only.',
    sourceText: 'Git warns that LF will be replaced by CRLF the next time Git touches docs/evals.md.',
    cavemanBaseline: 'Git warning: `LF will be replaced by CRLF`; file `docs/evals.md`.',
    utkCandidate: '`LF will be replaced by CRLF`; `docs/evals.md`.',
    requiredTerms: ['LF will be replaced by CRLF', 'docs/evals.md'],
    exactTerms: ['LF will be replaced by CRLF']
  }),
  fixture({
    name: 'escaped-json-string',
    category: 'Escaped strings',
    useCase: 'Compress JSON string note while preserving escaped newline.',
    testStrategy: 'Exact escaped sequence retention and forbidden real newline expansion.',
    cavemanStrength: 'Keeps escape sequences literal.',
    utkApproach: 'Escaped field literal only.',
    sourceText: 'The JSON field message must stay as "line1\\nline2" with the backslash-n sequence, not an actual newline.',
    cavemanBaseline: 'JSON `message`: `"line1\\nline2"`; keep literal `\\n`, no real newline.',
    utkCandidate: '`message="line1\\nline2"`; literal `\\n`.',
    requiredTerms: ['message', 'line1\\nline2', '`\\n`'],
    exactTerms: ['line1\\nline2']
  }),
  fixture({
    name: 'xml-attribute',
    category: 'XML',
    useCase: 'Compress XML note while preserving namespace attribute.',
    testStrategy: 'Exact XML attribute retention.',
    cavemanStrength: 'Keeps XML punctuation intact.',
    utkApproach: 'Element literal only.',
    sourceText: 'The XML tag <x:tool id="detok" enabled="true" /> must keep the x namespace prefix and enabled attribute.',
    cavemanBaseline: 'Keep XML `<x:tool id="detok" enabled="true" />`; preserve `x:` and `enabled`.',
    utkCandidate: '`<x:tool id="detok" enabled="true" />`; keep `x:`.',
    requiredTerms: ['<x:tool id="detok" enabled="true" />', 'x:'],
    exactTerms: ['<x:tool id="detok" enabled="true" />']
  }),
  fixture({
    name: 'docker-digest',
    category: 'Containers',
    useCase: 'Summarize image pin while preserving digest.',
    testStrategy: 'Docker image digest exactness and no latest tag.',
    cavemanStrength: 'Preserves image pins.',
    utkApproach: 'Image@digest only.',
    sourceText: 'Deploy ghcr.io/acme/utk@sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd and do not use the latest tag.',
    cavemanBaseline: 'Deploy `ghcr.io/acme/utk@sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd`; no `latest`.',
    utkCandidate: '`ghcr.io/acme/utk@sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd`; no latest.',
    requiredTerms: ['ghcr.io/acme/utk@sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd', 'no latest'],
    exactTerms: ['ghcr.io/acme/utk@sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd']
  }),
  fixture({
    name: 'k8s-resource-limit',
    category: 'Kubernetes',
    useCase: 'Compress Kubernetes limits without swapping requests and limits.',
    testStrategy: 'requests/limits association check.',
    cavemanStrength: 'Keeps resource fields associated.',
    utkApproach: 'K8s resource tuple.',
    sourceText: 'Set requests.cpu to 250m and limits.memory to 512Mi for the worker container.',
    cavemanBaseline: 'K8s worker: `requests.cpu=250m`; `limits.memory=512Mi`.',
    utkCandidate: 'Worker: req.cpu=250m; limit.mem=512Mi.',
    requiredTerms: ['req.cpu=250m', 'limit.mem=512Mi'],
    requiredPatterns: ['req\\.cpu=250m;\\s+limit\\.mem=512Mi']
  }),
  fixture({
    name: 's3-uri',
    category: 'Cloud storage',
    useCase: 'Compress artifact location while preserving S3 URI and region.',
    testStrategy: 'S3 URI exactness with region retention.',
    cavemanStrength: 'Keeps cloud object locations exact.',
    utkApproach: 'URI plus region tuple.',
    sourceText: 'The artifact is stored at s3://utk-evals/prod/reports/caveman.json in region us-east-2.',
    cavemanBaseline: 'Artifact: `s3://utk-evals/prod/reports/caveman.json`, region `us-east-2`.',
    utkCandidate: 's3://utk-evals/prod/reports/caveman.json; us-east-2.',
    requiredTerms: ['s3://utk-evals/prod/reports/caveman.json', 'us-east-2'],
    exactTerms: ['s3://utk-evals/prod/reports/caveman.json']
  }),
  fixture({
    name: 'azure-resource-id',
    category: 'Cloud resource id',
    useCase: 'Summarize Azure resource without truncating resource id.',
    testStrategy: 'Azure resource id exactness with subscription segment.',
    cavemanStrength: 'Keeps long cloud ids intact.',
    utkApproach: 'ID-only summary.',
    sourceText: 'The resource id is /subscriptions/0000/resourceGroups/rg-utk/providers/Microsoft.CognitiveServices/accounts/aoai-prod.',
    cavemanBaseline: 'Azure resource id `/subscriptions/0000/resourceGroups/rg-utk/providers/Microsoft.CognitiveServices/accounts/aoai-prod`; preserve full path.',
    utkCandidate: '`/subscriptions/0000/resourceGroups/rg-utk/providers/Microsoft.CognitiveServices/accounts/aoai-prod`.',
    requiredTerms: ['/subscriptions/0000/resourceGroups/rg-utk/providers/Microsoft.CognitiveServices/accounts/aoai-prod'],
    exactTerms: ['/subscriptions/0000/resourceGroups/rg-utk/providers/Microsoft.CognitiveServices/accounts/aoai-prod']
  }),
  fixture({
    name: 'git-refspec',
    category: 'Git',
    useCase: 'Compress push instruction while preserving refspec.',
    testStrategy: 'Exact refspec retention with branch namespace.',
    cavemanStrength: 'Keeps Git ref syntax safe.',
    utkApproach: 'Command fragment only.',
    sourceText: 'Push the branch with git push origin HEAD:refs/heads/codex/caveman-bench-edge-cases.',
    cavemanBaseline: 'Push refspec `git push origin HEAD:refs/heads/codex/caveman-bench-edge-cases`; preserve branch.',
    utkCandidate: '`git push origin HEAD:refs/heads/codex/caveman-bench-edge-cases`.',
    requiredTerms: ['git push origin HEAD:refs/heads/codex/caveman-bench-edge-cases'],
    exactTerms: ['HEAD:refs/heads/codex/caveman-bench-edge-cases']
  }),
  fixture({
    name: 'scoped-package',
    category: 'Package names',
    useCase: 'Compress workspace command while preserving scoped package.',
    testStrategy: 'Scoped npm package exactness.',
    cavemanStrength: 'Keeps package scope and command recognizable.',
    utkApproach: 'Command-only guidance.',
    sourceText: 'Run npm test --workspace @utk/evals to validate the eval package.',
    cavemanBaseline: 'Run `npm test --workspace @utk/evals`.',
    utkCandidate: '`npm test -w @utk/evals`.',
    requiredTerms: ['npm test', '@utk/evals'],
    exactTerms: ['@utk/evals']
  }),
  fixture({
    name: 'npm-audit-count',
    category: 'Security counts',
    useCase: 'Summarize npm audit result without hiding severity.',
    testStrategy: 'Severity count retention with forbidden zero-vuln claim.',
    cavemanStrength: 'Keeps vulnerability counts terse.',
    utkApproach: 'Severity=count tuple.',
    sourceText: 'npm audit reports 1 moderate severity vulnerability and 0 critical vulnerabilities.',
    cavemanBaseline: '`npm audit`: 1 moderate, 0 critical vulnerabilities.',
    utkCandidate: '`npm audit`: moderate=1, critical=0.',
    requiredTerms: ['npm audit', 'moderate=1', 'critical=0'],
    forbiddenTerms: ['0 vulnerabilities', 'clean audit']
  }),
  fixture({
    name: 'node-options-memory',
    category: 'Runtime flags',
    useCase: 'Compress Node memory flag while preserving exact option.',
    testStrategy: 'Exact NODE_OPTIONS value retention.',
    cavemanStrength: 'Keeps env-var flags intact.',
    utkApproach: 'Env assignment only.',
    sourceText: 'Set NODE_OPTIONS=--max-old-space-size=8192 before running verify:agent-browser.',
    cavemanBaseline: 'Set `NODE_OPTIONS=--max-old-space-size=8192`; run `verify:agent-browser`.',
    utkCandidate: '`NODE_OPTIONS=--max-old-space-size=8192` -> `verify:agent-browser`.',
    requiredTerms: ['NODE_OPTIONS=--max-old-space-size=8192', 'verify:agent-browser'],
    exactTerms: ['NODE_OPTIONS=--max-old-space-size=8192']
  }),
  fixture({
    name: 'tri-state-null',
    category: 'Data modeling',
    useCase: 'Summarize tri-state field semantics without collapsing null and false.',
    testStrategy: 'Null/false/true semantic separation with forbidden boolean-only simplification.',
    cavemanStrength: 'Keeps three states distinct.',
    utkApproach: 'State mapping tuple.',
    sourceText: 'The field consent can be true for allowed, false for denied, or null for unknown. Do not collapse null to false.',
    cavemanBaseline: '`consent`: true=allowed, false=denied, null=unknown. Do not collapse null to false.',
    utkCandidate: '`consent`: true allowed; false denied; null unknown.',
    requiredTerms: ['true allowed', 'false denied', 'null unknown'],
    forbiddenTerms: ['null to false', 'boolean only']
  }),
  fixture({
    name: 'graphql-selection',
    category: 'GraphQL',
    useCase: 'Compress GraphQL query note while preserving selected fields.',
    testStrategy: 'GraphQL selection field set retention.',
    cavemanStrength: 'Keeps selection syntax readable.',
    utkApproach: 'Selection-only summary.',
    sourceText: 'The GraphQL query should select repository { name owner { login } defaultBranchRef { name } }.',
    cavemanBaseline: 'GraphQL fields: `repository { name owner { login } defaultBranchRef { name } }`; keep owner/default branch.',
    utkCandidate: '`repository { name owner { login } defaultBranchRef { name } }`.',
    requiredTerms: ['repository', 'owner { login }', 'defaultBranchRef { name }'],
    exactTerms: ['repository { name owner { login } defaultBranchRef { name } }']
  }),
  fixture({
    name: 'protobuf-field-number',
    category: 'Protobuf',
    useCase: 'Summarize proto change while preserving field number and reserved range.',
    testStrategy: 'Field number exactness plus forbidden reuse of reserved number.',
    cavemanStrength: 'Keeps schema evolution details compact.',
    utkApproach: 'Field/reserved tuple.',
    sourceText: 'Add string benchmark_id = 7 and reserve field numbers 8 through 12. Do not reuse 9.',
    cavemanBaseline: 'Proto: add `string benchmark_id = 7`; reserve `8 to 12`; do not reuse 9.',
    utkCandidate: '`string benchmark_id = 7`; reserve 8-12; no 9 reuse.',
    requiredTerms: ['string benchmark_id = 7', 'reserve 8-12', 'no 9 reuse'],
    exactTerms: ['string benchmark_id = 7']
  }),
  fixture({
    name: 'cron-expression',
    category: 'Scheduling',
    useCase: 'Compress schedule while preserving cron expression and timezone.',
    testStrategy: 'Cron field count and timezone exactness.',
    cavemanStrength: 'Keeps compact schedule syntax intact.',
    utkApproach: 'Cron plus timezone only.',
    sourceText: 'The job runs on cron 15 4 * * 1-5 in UTC, which means weekdays at 04:15 UTC.',
    cavemanBaseline: 'Cron schedule `15 4 * * 1-5` UTC, weekdays 04:15.',
    utkCandidate: '`15 4 * * 1-5` UTC; weekdays 04:15.',
    requiredTerms: ['15 4 * * 1-5', 'UTC', 'weekdays 04:15'],
    requiredPatterns: ['15\\s+4\\s+\\*\\s+\\*\\s+1-5']
  }),
  fixture({
    name: 'rate-limit-window',
    category: 'Rate limits',
    useCase: 'Summarize quota rule with limit and rolling window.',
    testStrategy: 'Limit/window tuple retention.',
    cavemanStrength: 'Keeps quota math concise.',
    utkApproach: 'Quota equation.',
    sourceText: 'The API allows 600 requests per 5 minute rolling window per user.',
    cavemanBaseline: 'Rate limit: 600 requests / 5-minute rolling window / user.',
    utkCandidate: 'Limit 600 req / 5 min rolling / user.',
    requiredTerms: ['600 req', '5 min rolling', 'user']
  }),
  fixture({
    name: 'cache-control',
    category: 'HTTP cache',
    useCase: 'Compress cache policy while preserving directives.',
    testStrategy: 'Cache-Control directive exactness with max-age value.',
    cavemanStrength: 'Keeps header directives exact.',
    utkApproach: 'Header value only.',
    sourceText: 'Set Cache-Control to public, max-age=31536000, immutable for versioned assets.',
    cavemanBaseline: '`Cache-Control: public, max-age=31536000, immutable` for versioned assets.',
    utkCandidate: '`Cache-Control: public, max-age=31536000, immutable`.',
    requiredTerms: ['Cache-Control', 'public', 'max-age=31536000', 'immutable'],
    exactTerms: ['Cache-Control: public, max-age=31536000, immutable']
  }),
  fixture({
    name: 'csp-directive',
    category: 'Browser security',
    useCase: 'Summarize CSP update without weakening source list.',
    testStrategy: 'CSP directive exactness plus forbidden unsafe-inline.',
    cavemanStrength: 'Keeps security header syntax safe.',
    utkApproach: 'Directive literal only.',
    sourceText: 'The CSP directive is script-src self https://cdn.example.com and it must not include unsafe-inline.',
    cavemanBaseline: "CSP: `script-src 'self' https://cdn.example.com`; no `unsafe-inline`.",
    utkCandidate: "`script-src 'self' https://cdn.example.com`; no unsafe-inline.",
    requiredTerms: ["script-src 'self' https://cdn.example.com", 'no unsafe-inline'],
    exactTerms: ["script-src 'self' https://cdn.example.com"],
    forbiddenTerms: ["'unsafe-inline' allowed"]
  }),
  fixture({
    name: 'html-entity',
    category: 'HTML escaping',
    useCase: 'Compress HTML note while preserving escaped entity.',
    testStrategy: 'Escaped entity retention with forbidden raw tag.',
    cavemanStrength: 'Keeps escaped HTML safe.',
    utkApproach: 'Escaped literal only.',
    sourceText: 'Render the label as &lt;Admin&gt; rather than <Admin> so it is not parsed as a tag.',
    cavemanBaseline: 'Render `&lt;Admin&gt;`, not raw `<Admin>`.',
    utkCandidate: '`&lt;Admin&gt;`; not raw tag.',
    requiredTerms: ['&lt;Admin&gt;', 'not raw tag'],
    exactTerms: ['&lt;Admin&gt;'],
    forbiddenTerms: ['<Admin>']
  }),
  fixture({
    name: 'markdown-table-alignment',
    category: 'Markdown table',
    useCase: 'Summarize table alignment without losing colon markers.',
    testStrategy: 'Markdown alignment row exactness.',
    cavemanStrength: 'Keeps markdown punctuation exact.',
    utkApproach: 'Alignment row literal only.',
    sourceText: 'The Markdown alignment row should be | --- | ---: | :---: | for left, right, and centered columns.',
    cavemanBaseline: 'Markdown align markers: `| --- | ---: | :---: |`; keep colons.',
    utkCandidate: '`| --- | ---: | :---: |`.',
    requiredTerms: ['| --- | ---: | :---: |'],
    exactTerms: ['| --- | ---: | :---: |']
  }),
  fixture({
    name: 'algebra-boundary',
    category: 'Math',
    useCase: 'Compress boundary condition while preserving inclusive/exclusive operators.',
    testStrategy: 'Inequality operator exactness.',
    cavemanStrength: 'Keeps math boundary symbols concise.',
    utkApproach: 'Expression only.',
    sourceText: 'The valid range is 0 <= score < 1, which includes zero but excludes one.',
    cavemanBaseline: 'Valid range: `0 <= score < 1`; includes 0, excludes 1.',
    utkCandidate: '`0 <= score < 1`; 0 in, 1 out.',
    requiredTerms: ['0 <= score < 1', '0 in', '1 out'],
    exactTerms: ['0 <= score < 1']
  }),
  fixture({
    name: 'git-diff-hunk',
    category: 'Patch syntax',
    useCase: 'Compress diff note while preserving plus/minus line meanings.',
    testStrategy: 'Added/removed line prefix exactness.',
    cavemanStrength: 'Keeps patch markers distinct.',
    utkApproach: 'Prefix-labeled lines only.',
    sourceText: 'The diff removes - oldRoute(); and adds + newRoute();. Do not swap the signs.',
    cavemanBaseline: 'Diff: remove `- oldRoute();`; add `+ newRoute();`; signs matter.',
    utkCandidate: '`- oldRoute();` removed; `+ newRoute();` added.',
    requiredTerms: ['- oldRoute();', '+ newRoute();', 'removed', 'added'],
    orderedTerms: ['- oldRoute();', '+ newRoute();']
  }),
  fixture({
    name: 'binary-size',
    category: 'Binary size',
    useCase: 'Summarize binary size with IEC unit and byte count.',
    testStrategy: 'IEC unit and exact byte count retention.',
    cavemanStrength: 'Keeps storage units exact.',
    utkApproach: 'Size tuple.',
    sourceText: 'The bundle size is 1.5 MiB, equal to 1,572,864 bytes, and should not be reported as 1.5 MB.',
    cavemanBaseline: 'Bundle: 1.5 MiB = 1,572,864 bytes; not 1.5 MB.',
    utkCandidate: 'Bundle 1.5 MiB / 1,572,864 bytes; not MB.',
    requiredTerms: ['1.5 MiB', '1,572,864 bytes', 'not MB'],
    forbiddenTerms: ['1.5 MB']
  }),
  fixture({
    name: 'mimetype-charset',
    category: 'MIME',
    useCase: 'Compress content-type guidance while preserving MIME type and charset.',
    testStrategy: 'MIME type plus charset exactness with forbidden fallback phrase.',
    cavemanStrength: 'Keeps media-type parameters exact.',
    utkApproach: 'Header value plus fallback guard only.',
    sourceText: 'The response must use Content-Type application/json; charset=utf-8 and must not fall back to text/plain.',
    cavemanBaseline: 'Content-Type `application/json; charset=utf-8`; no `text/plain` fallback.',
    utkCandidate: '`application/json; charset=utf-8`; no text/plain fallback.',
    requiredTerms: ['application/json; charset=utf-8', 'no text/plain fallback'],
    exactTerms: ['application/json; charset=utf-8'],
    forbiddenTerms: ['charset=ascii', 'application/javascript']
  })
];

export const CAVEMAN_PARITY_EVALS = CAVEMAN_PARITY_FIXTURES.map((fixture) => fixture.name);
export const CAVEMAN_PARITY_MODE_EVALS = CAVEMAN_PARITY_FIXTURES.flatMap((fixture) => CAVEMAN_MODES.map((mode) => `${fixture.name}-${mode}`));

export function cavemanBaselineForMode(fixture: CavemanParityFixture, mode: CavemanMode): string {
  return fixture.cavemanBaselines[mode];
}

export function cavemanParityExpectedPayload(fixture: CavemanParityFixture, mode: CavemanMode = 'full'): string {
  const cavemanBaseline = cavemanBaselineForMode(fixture, mode);
  return JSON.stringify({
    scenario: fixture.name,
    caveman_mode: mode,
    caveman_baseline: cavemanBaseline,
    required_terms: fixture.requiredTerms,
    exact_terms: fixture.exactTerms ?? [],
    ordered_terms: fixture.orderedTerms ?? [],
    forbidden_terms: fixture.forbiddenTerms ?? [],
    required_patterns: fixture.requiredPatterns ?? [],
    forbidden_patterns: fixture.forbiddenPatterns ?? [],
    max_token_ratio: fixture.maxTokenRatio,
    min_fact_score: fixture.minFactScore,
    caveman_tokens: estimateTokens(cavemanBaseline)
  }, null, 2);
}
