# Caveman Parity Benchmark Results

Generated from `packages/evals/fixtures/cavemanParityFixtures.ts`.

## Summary

- Scenarios: 80
- Outperformed caveman token baseline: 80/80
- Average UTK/caveman token ratio: 0.756
- Total estimated token savings vs caveman: 375
- Autoevals fact retention: 1.000 all scenarios
- Exact/order/forbidden/pattern edge gates: 1.000 all scenarios

## Findings

- Caveman is strongest at terse human-facing prose: review comments, commit subjects, status notes, command help, and incident handoffs.
- UTK outperforms when it uses structured field order, removes labels that syntax already implies, and treats exact commands, paths, ids, errors, and secrets as protected anchors.
- Safety clarity remains special: UTK can be shorter than caveman only when the irreversible consequence and mitigation stay explicit.

## Results

| Scenario | Category | Caveman Tokens | UTK Tokens | Delta | Ratio | Facts | Edge Gates |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ci-failure-triage | Failure triage | 48 | 45 | 3 | 0.938 | 1.000 | 1.000 |
| review-finding | Code review | 46 | 41 | 5 | 0.891 | 1.000 | 1.000 |
| artifact-recovery | Artifact recovery | 53 | 50 | 3 | 0.943 | 1.000 | 1.000 |
| implementation-status | Status reporting | 53 | 45 | 8 | 0.849 | 1.000 | 1.000 |
| commit-message | Commit prose | 18 | 11 | 7 | 0.611 | 1.000 | 1.000 |
| slash-command-help | Command help | 25 | 19 | 6 | 0.760 | 1.000 | 1.000 |
| security-auto-clarity | Safety clarity | 33 | 26 | 7 | 0.788 | 1.000 | 1.000 |
| mcp-tool-metadata | Tool metadata | 32 | 26 | 6 | 0.813 | 1.000 | 1.000 |
| benchmark-result | Benchmark reporting | 24 | 17 | 7 | 0.708 | 1.000 | 1.000 |
| incident-handoff | Operational handoff | 27 | 21 | 6 | 0.778 | 1.000 | 1.000 |
| api-contract-change | API contract | 32 | 28 | 4 | 0.875 | 1.000 | 1.000 |
| test-plan | Test planning | 33 | 30 | 3 | 0.909 | 1.000 | 1.000 |
| exact-error-string | Exact errors | 35 | 27 | 8 | 0.771 | 1.000 | 1.000 |
| windows-paths | Path preservation | 51 | 49 | 2 | 0.961 | 1.000 | 1.000 |
| json-config-diff | JSON/config | 29 | 25 | 4 | 0.862 | 1.000 | 1.000 |
| destructive-migration-warning | Safety clarity | 33 | 28 | 5 | 0.848 | 1.000 | 1.000 |
| negative-review-result | Code review | 20 | 15 | 5 | 0.750 | 1.000 | 1.000 |
| ordered-publish-steps | Ordered operations | 25 | 21 | 4 | 0.840 | 1.000 | 1.000 |
| secret-redaction | Secret safety | 27 | 21 | 6 | 0.778 | 1.000 | 1.000 |
| latency-regression | Performance | 27 | 20 | 7 | 0.741 | 1.000 | 1.000 |
| timestamp-timezone | Time precision | 20 | 18 | 2 | 0.900 | 1.000 | 1.000 |
| url-query-fragment | URL preservation | 34 | 28 | 6 | 0.824 | 1.000 | 1.000 |
| semver-range | Version constraints | 22 | 14 | 8 | 0.636 | 1.000 | 1.000 |
| env-precedence | Configuration precedence | 22 | 19 | 3 | 0.864 | 1.000 | 1.000 |
| zero-failure-summary | Negative metrics | 11 | 8 | 3 | 0.727 | 1.000 | 1.000 |
| percentage-delta | Numeric precision | 11 | 6 | 5 | 0.545 | 1.000 | 1.000 |
| table-row | Table compression | 14 | 6 | 8 | 0.429 | 1.000 | 1.000 |
| stack-trace-top-frame | Stack traces | 28 | 22 | 6 | 0.786 | 1.000 | 1.000 |
| shell-quote-command | Shell quoting | 17 | 16 | 1 | 0.941 | 1.000 | 1.000 |
| sql-where-clause | SQL safety | 25 | 16 | 9 | 0.640 | 1.000 | 1.000 |
| yaml-frontmatter | YAML metadata | 17 | 13 | 4 | 0.765 | 1.000 | 1.000 |
| graph-edge-path | Graph state | 23 | 20 | 3 | 0.870 | 1.000 | 1.000 |
| wcag-contrast | Accessibility | 20 | 13 | 7 | 0.650 | 1.000 | 1.000 |
| icu-placeholder | Localization | 22 | 19 | 3 | 0.864 | 1.000 | 1.000 |
| markdown-link | Markdown | 28 | 25 | 3 | 0.893 | 1.000 | 1.000 |
| sha256-checksum | Integrity | 24 | 22 | 2 | 0.917 | 1.000 | 1.000 |
| exit-code-signal | Process status | 23 | 18 | 5 | 0.783 | 1.000 | 1.000 |
| partial-success | Mixed outcomes | 18 | 14 | 4 | 0.778 | 1.000 | 1.000 |
| license-notice | License | 18 | 14 | 4 | 0.778 | 1.000 | 1.000 |
| retention-policy | Privacy | 16 | 10 | 6 | 0.625 | 1.000 | 1.000 |
| currency-rounding | Finance | 17 | 13 | 4 | 0.765 | 1.000 | 1.000 |
| scientific-notation | Numeric precision | 10 | 5 | 5 | 0.500 | 1.000 | 1.000 |
| ipv6-cidr | Networking | 17 | 11 | 6 | 0.647 | 1.000 | 1.000 |
| dns-cname-chain | DNS | 20 | 17 | 3 | 0.850 | 1.000 | 1.000 |
| http-retry-after | HTTP | 17 | 11 | 6 | 0.647 | 1.000 | 1.000 |
| grpc-status | gRPC | 15 | 10 | 5 | 0.667 | 1.000 | 1.000 |
| otel-trace-span | Observability | 20 | 16 | 4 | 0.800 | 1.000 | 1.000 |
| jwt-redaction | Token safety | 16 | 10 | 6 | 0.625 | 1.000 | 1.000 |
| email-redaction | PII redaction | 18 | 9 | 9 | 0.500 | 1.000 | 1.000 |
| csv-quoted-comma | CSV | 15 | 8 | 7 | 0.533 | 1.000 | 1.000 |
| glob-negation | Glob patterns | 12 | 8 | 4 | 0.667 | 1.000 | 1.000 |
| regex-literal | Regex | 15 | 12 | 3 | 0.800 | 1.000 | 1.000 |
| feature-flag-rollout | Feature flags | 16 | 13 | 3 | 0.813 | 1.000 | 1.000 |
| ab-cohort | Experimentation | 10 | 8 | 2 | 0.800 | 1.000 | 1.000 |
| matrix-shape | ML tensors | 16 | 10 | 6 | 0.625 | 1.000 | 1.000 |
| unit-preservation | Units | 12 | 7 | 5 | 0.583 | 1.000 | 1.000 |
| crlf-warning | Line endings | 17 | 12 | 5 | 0.706 | 1.000 | 1.000 |
| escaped-json-string | Escaped strings | 18 | 10 | 8 | 0.556 | 1.000 | 1.000 |
| xml-attribute | XML | 20 | 13 | 7 | 0.650 | 1.000 | 1.000 |
| docker-digest | Containers | 28 | 26 | 2 | 0.929 | 1.000 | 1.000 |
| k8s-resource-limit | Kubernetes | 14 | 10 | 4 | 0.714 | 1.000 | 1.000 |
| s3-uri | Cloud storage | 19 | 13 | 6 | 0.684 | 1.000 | 1.000 |
| azure-resource-id | Cloud resource id | 30 | 26 | 4 | 0.867 | 1.000 | 1.000 |
| git-refspec | Git | 18 | 17 | 1 | 0.944 | 1.000 | 1.000 |
| scoped-package | Package names | 10 | 7 | 3 | 0.700 | 1.000 | 1.000 |
| npm-audit-count | Security counts | 13 | 9 | 4 | 0.692 | 1.000 | 1.000 |
| node-options-memory | Runtime flags | 19 | 17 | 2 | 0.895 | 1.000 | 1.000 |
| tri-state-null | Data modeling | 21 | 13 | 8 | 0.619 | 1.000 | 1.000 |
| graphql-selection | GraphQL | 20 | 16 | 4 | 0.800 | 1.000 | 1.000 |
| protobuf-field-number | Protobuf | 18 | 13 | 5 | 0.722 | 1.000 | 1.000 |
| cron-expression | Scheduling | 10 | 9 | 1 | 0.900 | 1.000 | 1.000 |
| rate-limit-window | Rate limits | 15 | 10 | 5 | 0.667 | 1.000 | 1.000 |
| cache-control | HTTP cache | 19 | 14 | 5 | 0.737 | 1.000 | 1.000 |
| csp-directive | Browser security | 18 | 16 | 2 | 0.889 | 1.000 | 1.000 |
| html-entity | HTML escaping | 11 | 8 | 3 | 0.727 | 1.000 | 1.000 |
| markdown-table-alignment | Markdown table | 12 | 7 | 5 | 0.583 | 1.000 | 1.000 |
| algebra-boundary | Math | 14 | 8 | 6 | 0.571 | 1.000 | 1.000 |
| git-diff-hunk | Patch syntax | 16 | 12 | 4 | 0.750 | 1.000 | 1.000 |
| binary-size | Binary size | 12 | 11 | 1 | 0.917 | 1.000 | 1.000 |
| mimetype-charset | MIME | 19 | 15 | 4 | 0.789 | 1.000 | 1.000 |

## Scenario Notes

### ci-failure-triage

- Use case: Summarize a failed validation run with enough detail for the next fix.
- Test strategy: Required fact retention for command, TypeScript error, file, cause, and rerun step.
- Caveman good at: Compact technical triage with command, error, file, cause, and rerun step.
- UTK attempt: Drop connective prose and keep exact command/error/path symbols as anchors.
- Caveman: CI red. `npm run typecheck` fails in `packages/core/src/router/router.ts:87`: TS2345. Cause: `schemaId` may be undefined. Fix guard before `routeToSchema(schemaId)`. Rerun `npm run typecheck`.
- UTK: CI red. `npm run typecheck` fails: TS2345 `packages/core/src/router/router.ts:87`. `schemaId` may be undefined. Guard before `routeToSchema(schemaId)`. Rerun `npm run typecheck`.

### review-finding

- Use case: Compress a code-review finding without dropping file, line, risk, or fix.
- Test strategy: Line-specific risk/fix retention with exact file-line anchor.
- Caveman good at: Line-specific actionable feedback with minimal review prose.
- UTK attempt: Use path-first structure and collapse risk/fix into terse clauses.
- Caveman: `packages/model-proxy/src/proxy.ts:142` retries POST after partial body forwarded. Risk: duplicate side effects. Fix: retry only idempotent methods or failures before body forwarding.
- UTK: `packages/model-proxy/src/proxy.ts:142` retries POST after partial body. Duplicate side effects possible. Fix: retry only idempotent methods or pre-body failures.

### artifact-recovery

- Use case: Preserve recovery handles while shrinking a tool-output mediation summary.
- Test strategy: Recovery artifact path retention with schema and confidence anchors.
- Caveman good at: Short recovery summaries that still protect paths, schema ids, and confidence.
- UTK attempt: Omit explanatory wrapper text and keep recoverability handles verbatim.
- Caveman: Payload omitted from chat. Raw: `.utk/tools/git.status/observations/run-9/output.raw.txt`. Compact: `.utk/tools/git.status/observations/run-9/output.compact.toon`. Schema `shell.git-status.v1`, confidence 0.97.
- UTK: Payload omitted. Raw `.utk/tools/git.status/observations/run-9/output.raw.txt`; compact `.utk/tools/git.status/observations/run-9/output.compact.toon`. Schema `shell.git-status.v1`; confidence 0.97.

### implementation-status

- Use case: Report implementation status with validation proof and remaining blocker.
- Test strategy: Validation proof plus blocker string retention.
- Caveman good at: Dense implementation status with validation proof and blocker evidence.
- UTK attempt: Front-load done/proof/blocker/diff fields and remove labels where syntax is clear.
- Caveman: Implementation done: run checkpoint persistence. Validation passed: `npm test --workspace @utk/evals`. Publish blocked: `"The token in default is invalid"`. Diff: `C:/Users/conta/.codex/automations/tk39.diff`.
- UTK: Run checkpoint persistence done. `npm test --workspace @utk/evals` passed. Publish blocked: `"The token in default is invalid"`. Diff `C:/Users/conta/.codex/automations/tk39.diff`.

### commit-message

- Use case: Compress a Conventional Commit message while preserving scope and behavior.
- Test strategy: Conventional Commit scope/type preservation with compact subject gate.
- Caveman good at: Very short commit subjects that keep type, scope, and concrete behavior.
- UTK attempt: Use normal Conventional Commit syntax and move only essential behavior into subject.
- Caveman: test(evals): add caveman parity benchmarks and AgentV autoevals grader
- UTK: test(evals): add caveman parity autoevals

### slash-command-help

- Use case: Explain a command switch compactly without losing mode names or stop phrase.
- Test strategy: Slash-command syntax retention with stop-phrase coverage.
- Caveman good at: Tiny command help that preserves exact slash commands and mode names.
- UTK attempt: Use one-line syntax plus stop phrase, no explanatory preface.
- Caveman: `/caveman lite|full|ultra|wenyan` sets compression level. Stop with `stop caveman` or `normal mode`.
- UTK: `/caveman lite|full|ultra|wenyan`; stop: `stop caveman` or `normal mode`.

### security-auto-clarity

- Use case: Keep a security warning clear while still removing redundant prose.
- Test strategy: Security warning consequence and mitigation retention.
- Caveman good at: Auto-clarity expands enough for irreversible or security-sensitive actions.
- UTK attempt: Keep explicit warning and irreversible consequence, then short mitigation.
- Caveman: Warning: rotating production signing key invalidates all active sessions. Backup old key and confirm rollback plan before applying.
- UTK: Warning: rotate prod signing key -> all sessions invalid. Backup old key; confirm rollback plan first.

### mcp-tool-metadata

- Use case: Shrink MCP tool metadata while preserving tool name, scope, and safety boundary.
- Test strategy: Tool identity plus safety-boundary term retention.
- Caveman good at: Removes tool-description filler without changing tool identity or boundaries.
- UTK attempt: Use schema-like fragments that keep tool name, allowed input, and local-only boundary.
- Caveman: `detok` rewrites bulky natural-language text locally before model use. Avoid secrets, private keys, code blocks, exact errors.
- UTK: `detok`: local rewrite for bulky natural language. No secrets, private keys, code blocks, exact errors.

### benchmark-result

- Use case: Report benchmark result with pass counts, ratio, and next action.
- Test strategy: Numeric result tuple retention: count, ratio, next action.
- Caveman good at: Dense numeric status with no dashboard-style prose.
- UTK attempt: Use metric-first result line with exact counts and ratio.
- Caveman: Caveman parity green: 11/11 tests. Avg candidate/caveman token ratio 0.89. Next: publish report.
- UTK: Caveman parity green: 11/11. Avg ratio 0.89. Next publish report.

### incident-handoff

- Use case: Condense an incident handoff while preserving owner, severity, impact, and mitigation.
- Test strategy: Incident handoff field retention for severity, owner, impact, mitigation.
- Caveman good at: Fast incident handoff with exactly the operational fields humans scan.
- UTK attempt: Field-prefix only the critical values and drop narrative sequence.
- Caveman: SEV2. Owner `platform-oncall`. Impact: 12% 500s on `/api/codex/chat`. Mitigation: roll back `2026.05.20.4`.
- UTK: SEV2. `platform-oncall`. 12% 500s on `/api/codex/chat`. Roll back `2026.05.20.4`.

### api-contract-change

- Use case: Summarize an API contract change with endpoint, field, compatibility, and migration.
- Test strategy: API endpoint/field/value exactness under terse release-note compression.
- Caveman good at: Keeps endpoint and field names exact while stripping release-note filler.
- UTK attempt: Endpoint-first line with compatibility and migration tokens only.
- Caveman: `POST /api/codex/chat` adds optional `providerOptions.reasoningEffort`. Backward compatible. Values: `low|medium|high|xhigh`.
- UTK: `POST /api/codex/chat`: optional `providerOptions.reasoningEffort`; compatible. Values `low|medium|high|xhigh`.

### test-plan

- Use case: Compress a TDD plan while retaining red/green/refactor order and named gate.
- Test strategy: TDD sequence retention with validation command anchor.
- Caveman good at: Short phased plans with exact validation commands.
- UTK attempt: Arrow-sequence plan with one final gate.
- Caveman: TDD: red test for missing artifact refs -> compact response fix -> refactor after green. Gate: `npm test --workspace @utk/evals`.
- UTK: TDD: red missing artifact refs -> fix compact response -> refactor after green. Gate `npm test --workspace @utk/evals`.

### exact-error-string

- Use case: Compress a failure report while preserving exact quoted Windows error text.
- Test strategy: Case-sensitive exact error string retention.
- Caveman good at: Keeps exact error strings visible while dropping cause speculation.
- UTK attempt: Use blocker-first line and preserve quoted error verbatim.
- Caveman: Publish blocked by env error: `Cannot read directory "../../../../..": Access is denied.` Treat as environment blocker, not code failure.
- UTK: Publish blocked: `Cannot read directory "../../../../..": Access is denied.` Env blocker, not code failure.

### windows-paths

- Use case: Shrink a handoff containing Windows paths without normalizing separators.
- Test strategy: Windows path separator preservation with exact-term checks.
- Caveman good at: Keeps file paths exact even in terse prose.
- UTK attempt: Use path-only evidence fields and keep backslashes untouched.
- Caveman: Report: `C:\Users\conta\.codex\worktrees\2f15\utk\docs\internal\caveman-parity-benchmark-results.md`. Fixture: `C:\Users\conta\.codex\worktrees\2f15\utk\packages\evals\fixtures\cavemanParityFixtures.ts`.
- UTK: Report=C:\Users\conta\.codex\worktrees\2f15\utk\docs\internal\caveman-parity-benchmark-results.md; Fixture=C:\Users\conta\.codex\worktrees\2f15\utk\packages\evals\fixtures\cavemanParityFixtures.ts

### json-config-diff

- Use case: Summarize a config change while preserving JSON keys and numeric values exactly.
- Test strategy: Quoted JSON key and before/after number preservation.
- Caveman good at: Retains quoted config keys and numbers without long explanation.
- UTK attempt: Use compact before/after key-value fragments.
- Caveman: Config change: `"max_context_tokens": 5000 -> 3000`; `"prompt_compression_min_tokens": 10 -> 1`. Keep quoted keys.
- UTK: `"max_context_tokens": 5000 -> 3000`; `"prompt_compression_min_tokens": 10 -> 1`. Quoted keys kept.

### destructive-migration-warning

- Use case: Keep destructive database migration warning clear and ordered.
- Test strategy: Order-sensitive destructive operation sequence check.
- Caveman good at: Expands enough for irreversible actions and order-sensitive instructions.
- UTK attempt: Use explicit warning plus ordered action list with no extra prose.
- Caveman: Warning: `DROP legacy_events.payload` irreversible after migration. Order: backup -> migrate -> verify row counts -> delete backup.
- UTK: Warning: `DROP legacy_events.payload` irreversible. Order: backup -> migrate -> verify rows -> delete backup.

### negative-review-result

- Use case: Report no findings without implying hidden defects.
- Test strategy: Negative finding guard with forbidden false-positive defect terms.
- Caveman good at: Short no-issue result with residual test gap.
- UTK attempt: State no actionable findings, then one residual risk.
- Caveman: No actionable findings. Residual risk: browser visual smoke not run in this env.
- UTK: No actionable findings. Risk: browser visual smoke not run.

### ordered-publish-steps

- Use case: Compress publish instructions where order matters.
- Test strategy: Publish chain order check using ordered terms.
- Caveman good at: Keeps multi-step operational order with arrows.
- UTK attempt: Drop labels and preserve ordered command chain.
- Caveman: Publish order: rebase `origin/main` -> resolve conflicts -> `npm test` -> push branch -> open PR.
- UTK: Publish: rebase `origin/main` -> resolve conflicts -> `npm test` -> push -> open PR.

### secret-redaction

- Use case: Compress secret-leak finding while proving the secret is not repeated.
- Test strategy: Redaction exactness plus forbidden secret leakage check.
- Caveman good at: Warns and redacts rather than echoing sensitive values.
- UTK attempt: Preserve variable/path/action and replace secret with redaction token.
- Caveman: Secret leak in `.env.local`: `OPENAI_API_KEY=[REDACTED]`. Rotate key; remove from file. Do not echo value.
- UTK: Secret leak `.env.local`: `OPENAI_API_KEY=[REDACTED]`. Rotate; remove. Do not echo.

### latency-regression

- Use case: Report a performance regression with exact p95 and budget values.
- Test strategy: Metric inequality exactness with p95/budget pattern.
- Caveman good at: Condenses metric deltas while keeping threshold math readable.
- UTK attempt: Use metric equation with exact p95, budget, and culprit.
- Caveman: Perf regression: p95 184ms > 150ms budget. Culprit likely autoevals JSONDiff setup during report generation.
- UTK: Perf red: p95 184ms > 150ms. Culprit: autoevals JSONDiff setup in report gen.

### timestamp-timezone

- Use case: Compress a scheduling note while preserving offset timestamp and local timezone.
- Test strategy: Regex-gate ISO-like timestamp with UTC offset and timezone label.
- Caveman good at: Keeps date/time exact without calendar prose.
- UTK attempt: Use timestamp-first note and drop sentence wrapper.
- Caveman: Reminder at `2026-05-21 14:03:22-05:00 America/Chicago`; do not convert to UTC.
- UTK: Reminder `2026-05-21 14:03:22-05:00 America/Chicago`; no UTC conversion.

### url-query-fragment

- Use case: Shrink a link handoff while preserving query params and fragment.
- Test strategy: Exact URL preservation including query order and fragment.
- Caveman good at: Keeps full URLs intact while cutting link explanation.
- UTK attempt: Use URL as the primary payload and one short action.
- Caveman: Reviewer link: `https://agentv.dev/docs/integrations/autoevals-integration/?tab=typescript#code-grader`; verify TS code-grader example.
- UTK: Verify TS code-grader: https://agentv.dev/docs/integrations/autoevals-integration/?tab=typescript#code-grader

### semver-range

- Use case: Compress dependency guidance while preserving a complex semver range.
- Test strategy: Exact semver range check with forbidden simplified range.
- Caveman good at: Keeps version expressions exact.
- UTK attempt: Remove rationale, keep package and range only.
- Caveman: `autoevals` range: `^0.0.132 || >=0.1.0 <0.2.0`. Do not use `latest`; CI deterministic.
- UTK: `autoevals`: `^0.0.132 || >=0.1.0 <0.2.0`; no `latest`.

### env-precedence

- Use case: Summarize config precedence without changing order.
- Test strategy: Ordered precedence chain check with three exact sources.
- Caveman good at: Turns precedence rules into a compact ordered chain.
- UTK attempt: Use highest-to-lowest arrow chain.
- Caveman: Precedence: CLI flag -> `UTK_CONFIG_PATH` -> `.utk/config.toml` -> built-in defaults.
- UTK: Precedence: CLI flag -> `UTK_CONFIG_PATH` -> `.utk/config.toml` -> defaults.

### zero-failure-summary

- Use case: Report zero failures without accidentally implying a failure.
- Test strategy: Forbidden-pattern gate blocks failed/failing/failure while preserving zero count.
- Caveman good at: Can state clean result tersely.
- UTK attempt: Use green count and avoid failure-family words.
- Caveman: Green: 312 passing, 0 failures, 0 skipped.
- UTK: Green: 312 pass, 0 fail, 0 skip.

### percentage-delta

- Use case: Compress a benchmark delta with sign, decimal, and baseline preserved.
- Test strategy: Regex-gate signed decimal percentage and baseline value.
- Caveman good at: Short numeric comparisons with readable directionality.
- UTK attempt: Use equation-style result with signed delta.
- Caveman: Prompt cost: 8,192 -> 7,168 tokens, -12.5%.
- UTK: 8,192->7,168 (-12.5%).

### table-row

- Use case: Compress a table row while preserving column-value associations.
- Test strategy: Pattern checks NAME/STATUS/TOKENS associations in one compact row.
- Caveman good at: Keeps tabular values scannable with less surrounding text.
- UTK attempt: Convert row to key=value tuple.
- Caveman: Table row: NAME=core STATUS=pass TOKENS=124 RATIO=0.82.
- UTK: Row core/pass/124/0.82.

### stack-trace-top-frame

- Use case: Summarize stack trace by preserving top frame and error.
- Test strategy: Exact top frame retention plus lower-frame omission guard.
- Caveman good at: Keeps the actionable top frame and error type.
- UTK attempt: Top-frame-only summary.
- Caveman: `TypeError: Cannot read properties of undefined` at `parseConfig (src/config.ts:42:13)`. Lower frames omitted.
- UTK: `TypeError: Cannot read properties of undefined` @ `parseConfig (src/config.ts:42:13)`.

### shell-quote-command

- Use case: Compress shell guidance without changing quotes or spaces.
- Test strategy: Exact command retention with quoted commit message.
- Caveman good at: Preserves shell syntax while shrinking instructions.
- UTK attempt: Command-only output plus one caution.
- Caveman: Run `git commit -m "fix: handle spaces"` after staging. Keep quotes.
- UTK: `git commit -m "fix: handle spaces"` after staging; keep quotes.

### sql-where-clause

- Use case: Summarize SQL filter change without losing tenant isolation.
- Test strategy: Exact WHERE clause retention and forbidden tenantless query pattern.
- Caveman good at: Keeps SQL predicates exact under compression.
- UTK attempt: Predicate-only summary with risk removed.
- Caveman: SQL must include `WHERE tenant_id = $1 AND deleted_at IS NULL` before `ORDER BY created_at DESC`.
- UTK: SQL: `WHERE tenant_id = $1 AND deleted_at IS NULL` before order.

### yaml-frontmatter

- Use case: Compress documentation metadata while preserving YAML booleans and tag list.
- Test strategy: Exact YAML key/value snippets retained.
- Caveman good at: Keeps metadata literals exact.
- UTK attempt: Inline YAML snippets only.
- Caveman: Frontmatter: `draft: false`; `tags: [evals, caveman, autoevals]`.
- UTK: `draft: false`; `tags: [evals, caveman, autoevals]`.

### graph-edge-path

- Use case: Summarize graph traversal without inserting nonexistent nodes.
- Test strategy: Ordered path check plus forbidden extra node.
- Caveman good at: Keeps compact graph paths readable.
- UTK attempt: Bare path with omitted-node guard.
- Caveman: Path: `agent-browser -> benchmarkModelRouting -> sessionState`. Not through `SettingsPanel`.
- UTK: `agent-browser -> benchmarkModelRouting -> sessionState`; no `SettingsPanel`.

### wcag-contrast

- Use case: Compress accessibility finding with WCAG id, ratio, threshold, and fix.
- Test strategy: WCAG identifier and contrast ratio regex checks.
- Caveman good at: Keeps accessibility standard IDs exact.
- UTK attempt: Metric-first a11y finding.
- Caveman: A11y fail: WCAG 2.2 AA 1.4.3, contrast 3.9:1 < 4.5:1. Fix: darken foreground.
- UTK: A11y: WCAG 2.2 AA 1.4.3; 3.9:1 < 4.5:1. Darken fg.

### icu-placeholder

- Use case: Shrink localization note while preserving ICU placeholder syntax.
- Test strategy: Exact ICU placeholder retention.
- Caveman good at: Keeps placeholder syntax verbatim.
- UTK attempt: Placeholder-only note with no localization prose.
- Caveman: Keep ICU exactly: `{count, plural, one {# file} other {# files}}`; parser depends on it.
- UTK: Keep ICU `{count, plural, one {# file} other {# files}}`; parser needs it.

### markdown-link

- Use case: Compress link guidance while preserving Markdown link target.
- Test strategy: Exact Markdown link retention.
- Caveman good at: Keeps Markdown syntax intact.
- UTK attempt: Use link as command target.
- Caveman: Use `[AgentV autoevals](https://agentv.dev/docs/integrations/autoevals-integration/)`; no bare URL duplicate.
- UTK: Use [AgentV autoevals](https://agentv.dev/docs/integrations/autoevals-integration/); no duplicate.

### sha256-checksum

- Use case: Report artifact checksum without truncation.
- Test strategy: SHA-256 length/pattern and exact checksum retention.
- Caveman good at: Can keep long hashes exact.
- UTK attempt: Hash-first integrity line.
- Caveman: Archive: `sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00123456789abcdef0123456789abcdef`, size 42 MB.
- UTK: Archive sha256:0f1e2d3c4b5a69788796a5b4c3d2e1f00123456789abcdef0123456789abcdef; 42 MB.

### exit-code-signal

- Use case: Compress process failure with exit code and signal.
- Test strategy: Exit code and signal exactness with forbidden wrong-cause phrase.
- Caveman good at: Keeps process result compact and actionable.
- UTK attempt: Exit tuple plus likely cause only.
- Caveman: Worker exit 137 (`SIGKILL`). Likely memory/external kill, not TypeScript compile failure.
- UTK: Worker exit 137/SIGKILL. Likely memory/external kill, not TS compile.

### partial-success

- Use case: Report mixed test result without flattening to pass/fail.
- Test strategy: Fractional outcome retention with forbidden all-green claim.
- Caveman good at: Compactly preserves partial status.
- UTK attempt: Tuple result with next failing slice.
- Caveman: Batch: 3 passed, 1 failed, 2 skipped. Failed shard: `windows-node20`.
- UTK: Batch 3 pass / 1 fail / 2 skip; failed `windows-node20`.

### license-notice

- Use case: Compress license notice while preserving license, copyright holder, and year.
- Test strategy: Legal notice tuple exactness without adding license claims.
- Caveman good at: Keeps legal metadata concise.
- UTK attempt: Tuple style notice.
- Caveman: Third-party snippet: MIT; Copyright 2026 Example Labs; retain NOTICE.
- UTK: Snippet: MIT; Copyright 2026 Example Labs; keep NOTICE.

### retention-policy

- Use case: Summarize data-retention rule without weakening privacy terms.
- Test strategy: Retention window and jurisdiction retention with forbidden over-retention.
- Caveman good at: Keeps policy limits visible.
- UTK attempt: Policy tuple with max retention and deletion action.
- Caveman: Privacy: PII max 30 days, EU regions only, then delete records.
- UTK: PII: max 30 days; EU only; delete after.

### currency-rounding

- Use case: Compress invoice delta while preserving cents and no-rounding instruction.
- Test strategy: Currency literal and decimal-cent exactness with forbidden rounded amount.
- Caveman good at: Keeps money values exact.
- UTK attempt: Equation-only currency delta.
- Caveman: Invoice: `$1,234.56 -> $1,199.99`, delta `-$34.57`; do not round.
- UTK: `$1,234.56->$1,199.99`; delta `-$34.57`; no round.

### scientific-notation

- Use case: Preserve scientific notation and comparison direction.
- Test strategy: Scientific notation pattern retention with inequality direction.
- Caveman good at: Keeps compact numeric notation intact.
- UTK attempt: Metric inequality only.
- Caveman: Epsilon `1.0e-7` < tolerance `2.5e-6`.
- UTK: `1.0e-7 < 2.5e-6`.

### ipv6-cidr

- Use case: Compress firewall rule while preserving IPv6 CIDR.
- Test strategy: IPv6 CIDR exactness with forbidden IPv4 replacement.
- Caveman good at: Keeps network identifiers exact.
- UTK attempt: Rule tuple without explanatory prose.
- Caveman: Firewall: allow HTTPS to `2001:db8:85a3::/64`; deny other egress.
- UTK: Allow HTTPS `2001:db8:85a3::/64`; deny rest.

### dns-cname-chain

- Use case: Summarize DNS routing while preserving CNAME chain order.
- Test strategy: Ordered DNS CNAME chain retention.
- Caveman good at: Turns DNS chain into compact arrows.
- UTK attempt: Bare hostname chain.
- Caveman: DNS: `app.example.com -> edge.example.net -> cdn.vendor.net`; no A on app host.
- UTK: `app.example.com -> edge.example.net -> cdn.vendor.net`; no app A.

### http-retry-after

- Use case: Compress HTTP throttle result while preserving status and Retry-After seconds.
- Test strategy: Header-name exactness and numeric retry delay retention.
- Caveman good at: Keeps HTTP status/header pairs concise.
- UTK attempt: Status/header tuple.
- Caveman: HTTP 429 `Too Many Requests`; `Retry-After: 120`; retry after 120s.
- UTK: HTTP 429; `Retry-After: 120`; retry 120s.

### grpc-status

- Use case: Summarize gRPC failure while preserving canonical code and retryability.
- Test strategy: gRPC code/name pair retention with retry flag.
- Caveman good at: Keeps status code and retry decision visible.
- UTK attempt: Code/name/retry tuple.
- Caveman: gRPC `14 UNAVAILABLE`; retryable with exponential backoff.
- UTK: gRPC 14/UNAVAILABLE; retry with backoff.

### otel-trace-span

- Use case: Compress trace handoff while preserving trace id and span id.
- Test strategy: Hex trace/span length pattern checks.
- Caveman good at: Preserves trace identifiers exactly.
- UTK attempt: Trace/span tuple.
- Caveman: Investigate trace `4bf92f3577b34da6a3ce929d0e0e4736`, span `00f067aa0ba902b7`.
- UTK: trace 4bf92f3577b34da6a3ce929d0e0e4736; span 00f067aa0ba902b7.

### jwt-redaction

- Use case: Compress JWT leak report while preserving header algorithm and redacting payload.
- Test strategy: Allowed JWT header claim retention plus forbidden JWT-looking token pattern.
- Caveman good at: Redacts sensitive token body while keeping useful header fact.
- UTK attempt: Header alg plus redaction marker only.
- Caveman: JWT leak: alg `RS256`; token `[REDACTED]`; do not echo token.
- UTK: JWT leak: alg RS256; token [REDACTED].

### email-redaction

- Use case: Summarize user report while redacting email local-part.
- Test strategy: Domain retention with forbidden full email address.
- Caveman good at: Keeps useful PII context without full value leakage.
- UTK attempt: Masked email only.
- Caveman: Affected account: `[REDACTED]@example.com`; full local-part redacted.
- UTK: Account `[REDACTED]@example.com`.

### csv-quoted-comma

- Use case: Compress CSV row while preserving a quoted comma field.
- Test strategy: Quoted CSV field exactness with comma inside quotes.
- Caveman good at: Keeps CSV escaping intact.
- UTK attempt: Row literal only.
- Caveman: CSV row: `7,"Smith, Ada","needs review"`; keep quoted comma.
- UTK: `7,"Smith, Ada","needs review"`.

### glob-negation

- Use case: Summarize file filter while preserving include and negation globs.
- Test strategy: Exact glob include/exclude pattern retention.
- Caveman good at: Keeps glob syntax exact.
- UTK attempt: Include/exclude tuple.
- Caveman: Search `**/*.test.ts`; exclude `**/*.snap.ts`.
- UTK: `**/*.test.ts`; !`**/*.snap.ts`.

### regex-literal

- Use case: Compress regex guidance while preserving anchors and groups.
- Test strategy: Exact regex literal retention with forbidden unanchored variant.
- Caveman good at: Preserves punctuation-heavy regex.
- UTK attempt: Regex-only note.
- Caveman: Use regex `^(feat|fix|test)\([^)]+\): .+$`; keep anchors.
- UTK: `^(feat|fix|test)\([^)]+\): .+$`; keep anchors.

### feature-flag-rollout

- Use case: Compress rollout status while preserving flag, cohort, and percentage.
- Test strategy: Flag name plus staged percentage retention.
- Caveman good at: Summarizes rollout knobs compactly.
- UTK attempt: Flag/cohort/percent tuple.
- Caveman: Flag `agentv_caveman_bench`: beta-users 25%, everyone else off.
- UTK: `agentv_caveman_bench`: beta-users 25%; others off.

### ab-cohort

- Use case: Report A/B split without swapping control and variant.
- Test strategy: Control/variant association pattern checks.
- Caveman good at: Keeps experiment splits compact.
- UTK attempt: Arm=value pairs only.
- Caveman: `exp-17`: control 60%, variant B 40%.
- UTK: `exp-17`: control=60%, B=40%.

### matrix-shape

- Use case: Summarize tensor shape and dtype without transposing dimensions.
- Test strategy: Dimension order pattern retention.
- Caveman good at: Keeps tensor metadata concise.
- UTK attempt: Shape/dtype tuple.
- Caveman: Tensor: shape `[2, 3, 768]`, dtype `float16`; do not transpose.
- UTK: Tensor [2,3,768] float16; no transpose.

### unit-preservation

- Use case: Compress measurement while preserving original units and no-conversion rule.
- Test strategy: Original unit retention with forbidden converted value.
- Caveman good at: Avoids accidental unit conversion.
- UTK attempt: Value/unit plus no-convert guard.
- Caveman: Memory budget `512 MiB`; do not convert to MB.
- UTK: `512 MiB`; no MB conversion.

### crlf-warning

- Use case: Summarize Git line-ending warning without changing LF/CRLF terms.
- Test strategy: Exact Git warning phrase retention.
- Caveman good at: Keeps warning text exact.
- UTK attempt: Warning phrase only.
- Caveman: Git warning: `LF will be replaced by CRLF`; file `docs/evals.md`.
- UTK: `LF will be replaced by CRLF`; `docs/evals.md`.

### escaped-json-string

- Use case: Compress JSON string note while preserving escaped newline.
- Test strategy: Exact escaped sequence retention and forbidden real newline expansion.
- Caveman good at: Keeps escape sequences literal.
- UTK attempt: Escaped field literal only.
- Caveman: JSON `message`: `"line1\nline2"`; keep literal `\n`, no real newline.
- UTK: `message="line1\nline2"`; literal `\n`.

### xml-attribute

- Use case: Compress XML note while preserving namespace attribute.
- Test strategy: Exact XML attribute retention.
- Caveman good at: Keeps XML punctuation intact.
- UTK attempt: Element literal only.
- Caveman: Keep XML `<x:tool id="detok" enabled="true" />`; preserve `x:` and `enabled`.
- UTK: `<x:tool id="detok" enabled="true" />`; keep `x:`.

### docker-digest

- Use case: Summarize image pin while preserving digest.
- Test strategy: Docker image digest exactness and no latest tag.
- Caveman good at: Preserves image pins.
- UTK attempt: Image@digest only.
- Caveman: Deploy `ghcr.io/acme/utk@sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd`; no `latest`.
- UTK: `ghcr.io/acme/utk@sha256:abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd`; no latest.

### k8s-resource-limit

- Use case: Compress Kubernetes limits without swapping requests and limits.
- Test strategy: requests/limits association check.
- Caveman good at: Keeps resource fields associated.
- UTK attempt: K8s resource tuple.
- Caveman: K8s worker: `requests.cpu=250m`; `limits.memory=512Mi`.
- UTK: Worker: req.cpu=250m; limit.mem=512Mi.

### s3-uri

- Use case: Compress artifact location while preserving S3 URI and region.
- Test strategy: S3 URI exactness with region retention.
- Caveman good at: Keeps cloud object locations exact.
- UTK attempt: URI plus region tuple.
- Caveman: Artifact: `s3://utk-evals/prod/reports/caveman.json`, region `us-east-2`.
- UTK: s3://utk-evals/prod/reports/caveman.json; us-east-2.

### azure-resource-id

- Use case: Summarize Azure resource without truncating resource id.
- Test strategy: Azure resource id exactness with subscription segment.
- Caveman good at: Keeps long cloud ids intact.
- UTK attempt: ID-only summary.
- Caveman: Azure resource: `/subscriptions/0000/resourceGroups/rg-utk/providers/Microsoft.CognitiveServices/accounts/aoai-prod`.
- UTK: `/subscriptions/0000/resourceGroups/rg-utk/providers/Microsoft.CognitiveServices/accounts/aoai-prod`.

### git-refspec

- Use case: Compress push instruction while preserving refspec.
- Test strategy: Exact refspec retention with branch namespace.
- Caveman good at: Keeps Git ref syntax safe.
- UTK attempt: Command fragment only.
- Caveman: Push: `git push origin HEAD:refs/heads/codex/caveman-bench-edge-cases`.
- UTK: `git push origin HEAD:refs/heads/codex/caveman-bench-edge-cases`.

### scoped-package

- Use case: Compress workspace command while preserving scoped package.
- Test strategy: Scoped npm package exactness.
- Caveman good at: Keeps package scope and command recognizable.
- UTK attempt: Command-only guidance.
- Caveman: Run `npm test --workspace @utk/evals`.
- UTK: `npm test -w @utk/evals`.

### npm-audit-count

- Use case: Summarize npm audit result without hiding severity.
- Test strategy: Severity count retention with forbidden zero-vuln claim.
- Caveman good at: Keeps vulnerability counts terse.
- UTK attempt: Severity=count tuple.
- Caveman: `npm audit`: 1 moderate, 0 critical vulnerabilities.
- UTK: `npm audit`: moderate=1, critical=0.

### node-options-memory

- Use case: Compress Node memory flag while preserving exact option.
- Test strategy: Exact NODE_OPTIONS value retention.
- Caveman good at: Keeps env-var flags intact.
- UTK attempt: Env assignment only.
- Caveman: Set `NODE_OPTIONS=--max-old-space-size=8192`; run `verify:agent-browser`.
- UTK: `NODE_OPTIONS=--max-old-space-size=8192` -> `verify:agent-browser`.

### tri-state-null

- Use case: Summarize tri-state field semantics without collapsing null and false.
- Test strategy: Null/false/true semantic separation with forbidden boolean-only simplification.
- Caveman good at: Keeps three states distinct.
- UTK attempt: State mapping tuple.
- Caveman: `consent`: true=allowed, false=denied, null=unknown. Do not collapse null to false.
- UTK: `consent`: true allowed; false denied; null unknown.

### graphql-selection

- Use case: Compress GraphQL query note while preserving selected fields.
- Test strategy: GraphQL selection field set retention.
- Caveman good at: Keeps selection syntax readable.
- UTK attempt: Selection-only summary.
- Caveman: GraphQL select `repository { name owner { login } defaultBranchRef { name } }`.
- UTK: `repository { name owner { login } defaultBranchRef { name } }`.

### protobuf-field-number

- Use case: Summarize proto change while preserving field number and reserved range.
- Test strategy: Field number exactness plus forbidden reuse of reserved number.
- Caveman good at: Keeps schema evolution details compact.
- UTK attempt: Field/reserved tuple.
- Caveman: Proto: add `string benchmark_id = 7`; reserve `8 to 12`; do not reuse 9.
- UTK: `string benchmark_id = 7`; reserve 8-12; no 9 reuse.

### cron-expression

- Use case: Compress schedule while preserving cron expression and timezone.
- Test strategy: Cron field count and timezone exactness.
- Caveman good at: Keeps compact schedule syntax intact.
- UTK attempt: Cron plus timezone only.
- Caveman: Cron `15 4 * * 1-5` UTC; weekdays 04:15.
- UTK: `15 4 * * 1-5` UTC; weekdays 04:15.

### rate-limit-window

- Use case: Summarize quota rule with limit and rolling window.
- Test strategy: Limit/window tuple retention.
- Caveman good at: Keeps quota math concise.
- UTK attempt: Quota equation.
- Caveman: Rate limit: 600 requests / 5-minute rolling window / user.
- UTK: Limit 600 req / 5 min rolling / user.

### cache-control

- Use case: Compress cache policy while preserving directives.
- Test strategy: Cache-Control directive exactness with max-age value.
- Caveman good at: Keeps header directives exact.
- UTK attempt: Header value only.
- Caveman: `Cache-Control: public, max-age=31536000, immutable` for versioned assets.
- UTK: `Cache-Control: public, max-age=31536000, immutable`.

### csp-directive

- Use case: Summarize CSP update without weakening source list.
- Test strategy: CSP directive exactness plus forbidden unsafe-inline.
- Caveman good at: Keeps security header syntax safe.
- UTK attempt: Directive literal only.
- Caveman: CSP: `script-src 'self' https://cdn.example.com`; no `unsafe-inline`.
- UTK: `script-src 'self' https://cdn.example.com`; no unsafe-inline.

### html-entity

- Use case: Compress HTML note while preserving escaped entity.
- Test strategy: Escaped entity retention with forbidden raw tag.
- Caveman good at: Keeps escaped HTML safe.
- UTK attempt: Escaped literal only.
- Caveman: Render `&lt;Admin&gt;`, not raw `<Admin>`.
- UTK: `&lt;Admin&gt;`; not raw tag.

### markdown-table-alignment

- Use case: Summarize table alignment without losing colon markers.
- Test strategy: Markdown alignment row exactness.
- Caveman good at: Keeps markdown punctuation exact.
- UTK attempt: Alignment row literal only.
- Caveman: Markdown align row: `| --- | ---: | :---: |`.
- UTK: `| --- | ---: | :---: |`.

### algebra-boundary

- Use case: Compress boundary condition while preserving inclusive/exclusive operators.
- Test strategy: Inequality operator exactness.
- Caveman good at: Keeps math boundary symbols concise.
- UTK attempt: Expression only.
- Caveman: Valid range: `0 <= score < 1`; includes 0, excludes 1.
- UTK: `0 <= score < 1`; 0 in, 1 out.

### git-diff-hunk

- Use case: Compress diff note while preserving plus/minus line meanings.
- Test strategy: Added/removed line prefix exactness.
- Caveman good at: Keeps patch markers distinct.
- UTK attempt: Prefix-labeled lines only.
- Caveman: Diff: remove `- oldRoute();`; add `+ newRoute();`; signs matter.
- UTK: `- oldRoute();` removed; `+ newRoute();` added.

### binary-size

- Use case: Summarize binary size with IEC unit and byte count.
- Test strategy: IEC unit and exact byte count retention.
- Caveman good at: Keeps storage units exact.
- UTK attempt: Size tuple.
- Caveman: Bundle: 1.5 MiB = 1,572,864 bytes; not 1.5 MB.
- UTK: Bundle 1.5 MiB / 1,572,864 bytes; not MB.

### mimetype-charset

- Use case: Compress content-type guidance while preserving MIME type and charset.
- Test strategy: MIME type plus charset exactness with forbidden fallback phrase.
- Caveman good at: Keeps media-type parameters exact.
- UTK attempt: Header value plus fallback guard only.
- Caveman: Content-Type `application/json; charset=utf-8`; no `text/plain` fallback.
- UTK: `application/json; charset=utf-8`; no text/plain fallback.

