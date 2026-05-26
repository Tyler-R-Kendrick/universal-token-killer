# RTK Parity Benchmark Results

Generated from `packages/evals/fixtures/rtkParityFixtures.ts`.

Aggregate benchmark table: `docs/internal/benchmark-summary.md`.

## Summary

- Scenarios: 61
- RTK-supported shell scenarios: 29
- Generalized tool-output scenarios: 32
- Passed RTK/UTK thresholds: 61/61
- Average UTK/RTK token ratio for RTK-supported scenarios: 0.271
- Total estimated token savings vs RTK-supported baselines: 417
- Autoevals fact retention: 1.000 all scenarios
- Recoverability: 1.000 all scenarios

## Findings

- RTK is strongest on common shell outputs: git, grep, test runners, package managers, process/network tables, cloud CLIs, Docker, kubectl, curl, audit logs, and compact tables.
- UTK wins by not rewriting facts into chat. It stores raw output, emits compact schema-backed artifacts, and keeps response text as recoverable handles.
- Generalized tool outputs are where UTK moves beyond RTK: nested JSON, Copilot tool objects, SARIF, OpenAPI, GraphQL, CSV, XML, HAR, traces, lockfiles, protocol logs, coverage, metrics, calendars, manifests, binary payloads, multipart bodies, ANSI output, Unicode tables, and secret-bearing logs.

## Results

| Scenario | Category | Kind | RTK Tokens | UTK Compact Tokens | Delta | Ratio | Facts | Autoevals | Recoverable |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| shell-git-status | Git status | RTK-supported | 21 | 5 | 16 | 0.238 | 1.000 | 1.000 | 1.000 |
| shell-git-diff | Git diff | RTK-supported | 23 | 5 | 18 | 0.217 | 1.000 | 1.000 | 1.000 |
| shell-gh-pr-list | GitHub CLI | RTK-supported | 19 | 6 | 13 | 0.316 | 1.000 | 1.000 | 1.000 |
| shell-rg | Search output | RTK-supported | 18 | 5 | 13 | 0.278 | 1.000 | 1.000 | 1.000 |
| shell-vitest | Test output | RTK-supported | 10 | 5 | 5 | 0.500 | 1.000 | 1.000 | 1.000 |
| shell-tsc | Typecheck output | RTK-supported | 21 | 5 | 16 | 0.238 | 1.000 | 1.000 | 1.000 |
| large-json-object | JSON object | generalized | 106 | 9 | 97 | 0.085 | 1.000 | 1.000 | 1.000 |
| large-json-array | JSON array | generalized | 377 | 4 | 373 | 0.011 | 1.000 | 1.000 | 1.000 |
| deeply-nested-response | Nested JSON | generalized | 207 | 8 | 199 | 0.039 | 1.000 | 1.000 | 1.000 |
| repeated-text-logs | Logs | generalized | 137 | 6 | 131 | 0.044 | 1.000 | 1.000 | 1.000 |
| tabular-text | Tables | generalized | 18 | 5 | 13 | 0.278 | 1.000 | 1.000 | 1.000 |
| markdown-report | Markdown | generalized | 10 | 5 | 5 | 0.500 | 1.000 | 1.000 | 1.000 |
| arbitrary-structured-tool-output | Structured tools | generalized | 175 | 10 | 165 | 0.057 | 1.000 | 1.000 | 1.000 |
| synthetic-copilot-tool-output | Copilot tools | generalized | 114 | 10 | 104 | 0.088 | 1.000 | 1.000 | 1.000 |
| shell-npm-audit | Security audit | RTK-supported | 18 | 5 | 13 | 0.278 | 1.000 | 1.000 | 1.000 |
| shell-pytest-failure | Test failures | RTK-supported | 21 | 5 | 16 | 0.238 | 1.000 | 1.000 | 1.000 |
| shell-docker-ps | Container status | RTK-supported | 13 | 5 | 8 | 0.385 | 1.000 | 1.000 | 1.000 |
| shell-kubectl-pods | Kubernetes | RTK-supported | 18 | 5 | 13 | 0.278 | 1.000 | 1.000 | 1.000 |
| shell-curl-headers | HTTP headers | RTK-supported | 16 | 5 | 11 | 0.313 | 1.000 | 1.000 | 1.000 |
| shell-du-sizes | Disk usage | RTK-supported | 13 | 5 | 8 | 0.385 | 1.000 | 1.000 | 1.000 |
| shell-rg-json-lines | Search JSON | RTK-supported | 19 | 5 | 14 | 0.263 | 1.000 | 1.000 | 1.000 |
| shell-git-log-oneline | Git history | RTK-supported | 20 | 5 | 15 | 0.250 | 1.000 | 1.000 | 1.000 |
| sarif-results | Static analysis | generalized | 42 | 8 | 34 | 0.190 | 1.000 | 1.000 | 1.000 |
| junit-xml | XML reports | generalized | 15 | 5 | 10 | 0.333 | 1.000 | 1.000 | 1.000 |
| csv-export | CSV | generalized | 7 | 5 | 2 | 0.714 | 1.000 | 1.000 | 1.000 |
| graphql-response | GraphQL | generalized | 20 | 6 | 14 | 0.300 | 1.000 | 1.000 | 1.000 |
| openapi-fragment | API schemas | generalized | 21 | 9 | 12 | 0.429 | 1.000 | 1.000 | 1.000 |
| secret-bearing-log | Secret safety | generalized | 12 | 5 | 7 | 0.417 | 1.000 | 1.000 | 1.000 |
| shell-terraform-plan | Infrastructure plan | RTK-supported | 18 | 5 | 13 | 0.278 | 1.000 | 1.000 | 1.000 |
| shell-helm-status | Helm release | RTK-supported | 21 | 5 | 16 | 0.238 | 1.000 | 1.000 | 1.000 |
| shell-ps-memory | Process table | RTK-supported | 17 | 5 | 12 | 0.294 | 1.000 | 1.000 | 1.000 |
| shell-netstat-listen | Network sockets | RTK-supported | 23 | 5 | 18 | 0.217 | 1.000 | 1.000 | 1.000 |
| shell-openssl-cert | Certificate inspection | RTK-supported | 23 | 5 | 18 | 0.217 | 1.000 | 1.000 | 1.000 |
| shell-pnpm-install | Package install | RTK-supported | 20 | 5 | 15 | 0.250 | 1.000 | 1.000 | 1.000 |
| shell-go-test-race | Go tests | RTK-supported | 21 | 5 | 16 | 0.238 | 1.000 | 1.000 | 1.000 |
| shell-cargo-test | Rust tests | RTK-supported | 21 | 5 | 16 | 0.238 | 1.000 | 1.000 | 1.000 |
| shell-dotnet-test | Dotnet tests | RTK-supported | 23 | 5 | 18 | 0.217 | 1.000 | 1.000 | 1.000 |
| shell-powershell-error | PowerShell | RTK-supported | 25 | 5 | 20 | 0.200 | 1.000 | 1.000 | 1.000 |
| shell-azure-deployment | Azure CLI | RTK-supported | 27 | 5 | 22 | 0.185 | 1.000 | 1.000 | 1.000 |
| shell-ffmpeg-progress | Media processing | RTK-supported | 16 | 5 | 11 | 0.313 | 1.000 | 1.000 | 1.000 |
| shell-mysql-explain | Database plan | RTK-supported | 22 | 5 | 17 | 0.227 | 1.000 | 1.000 | 1.000 |
| shell-windows-dir | Windows filesystem | RTK-supported | 20 | 5 | 15 | 0.250 | 1.000 | 1.000 | 1.000 |
| shell-jq-filter | JSON CLI transform | RTK-supported | 16 | 5 | 11 | 0.313 | 1.000 | 1.000 | 1.000 |
| ndjson-event-stream | NDJSON | generalized | 106 | 6 | 100 | 0.057 | 1.000 | 1.000 | 1.000 |
| lcov-coverage-report | Coverage | generalized | 15 | 6 | 9 | 0.400 | 1.000 | 1.000 | 1.000 |
| prometheus-metrics | Metrics exposition | generalized | 29 | 5 | 24 | 0.172 | 1.000 | 1.000 | 1.000 |
| har-network-log | Browser HAR | generalized | 42 | 6 | 36 | 0.143 | 1.000 | 1.000 | 1.000 |
| playwright-trace-summary | Browser trace | generalized | 32 | 11 | 21 | 0.344 | 1.000 | 1.000 | 1.000 |
| package-lock-subtree | Lockfile | generalized | 24 | 7 | 17 | 0.292 | 1.000 | 1.000 | 1.000 |
| tsserver-protocol-log | Editor protocol | generalized | 29 | 5 | 24 | 0.172 | 1.000 | 1.000 | 1.000 |
| sqlite-query-result | Database rows | generalized | 28 | 4 | 24 | 0.143 | 1.000 | 1.000 | 1.000 |
| rfc822-email | Email | generalized | 20 | 5 | 15 | 0.250 | 1.000 | 1.000 | 1.000 |
| icalendar-event | Calendar | generalized | 16 | 5 | 11 | 0.313 | 1.000 | 1.000 | 1.000 |
| yaml-k8s-manifest | YAML manifests | generalized | 21 | 6 | 15 | 0.286 | 1.000 | 1.000 | 1.000 |
| toml-config-fragment | TOML config | generalized | 12 | 5 | 7 | 0.417 | 1.000 | 1.000 | 1.000 |
| protobuf-json-diagnostic | Protobuf JSON | generalized | 33 | 8 | 25 | 0.242 | 1.000 | 1.000 | 1.000 |
| binary-png-header | Binary output | generalized | 85 | 6 | 79 | 0.071 | 1.000 | 1.000 | 1.000 |
| multipart-form-data | Multipart payload | generalized | 31 | 6 | 25 | 0.194 | 1.000 | 1.000 | 1.000 |
| ansi-colored-output | ANSI terminal | generalized | 13 | 5 | 8 | 0.385 | 1.000 | 1.000 | 1.000 |
| unicode-width-table | Unicode table | generalized | 13 | 5 | 8 | 0.385 | 1.000 | 1.000 | 1.000 |
| patch-with-renames | Patch metadata | generalized | 22 | 5 | 17 | 0.227 | 1.000 | 1.000 | 1.000 |

## Scenario Notes

### shell-git-status

- Use case: Summarize dirty worktree state without losing modified and untracked files.
- Test strategy: Shell status fixture with literal file retention and strict RTK token win.
- RTK good at: RTK is good at tiny shell status summaries.
- UTK attempt: Store raw status, emit schema-backed compact artifact, and keep response handle-only.
- Result: pass

### shell-git-diff

- Use case: Compress patch output while preserving added and removed lines.
- Test strategy: Diff hunk literal retention with strict RTK token win.
- RTK good at: RTK condenses diff intent well.
- UTK attempt: Preserve raw diff artifact and beat RTK with compact shape metadata.
- Result: pass

### shell-gh-pr-list

- Use case: Summarize PR list output without losing titles or branch names.
- Test strategy: JSON CLI literal retention with strict RTK token win.
- RTK good at: RTK makes CLI list output readable.
- UTK attempt: Persist JSON output and expose compact object schema handles.
- Result: pass

### shell-rg

- Use case: Compress code search hits while preserving relevant file names.
- Test strategy: ripgrep hit retention with strict RTK token win.
- RTK good at: RTK summarizes repetitive search output.
- UTK attempt: Keep raw search results recoverable and send compact text shape.
- Result: pass

### shell-vitest

- Use case: Summarize passing test output with file and test counts.
- Test strategy: Vitest count retention with strict RTK token win.
- RTK good at: RTK trims noisy test runner chrome.
- UTK attempt: Artifact the full runner output and keep compact line/count envelope.
- Result: pass

### shell-tsc

- Use case: Represent clean TypeScript output without inventing diagnostics.
- Test strategy: Clean command retention with strict RTK token win.
- RTK good at: RTK can state no diagnostics tersely.
- UTK attempt: Preserve exact command output and expose a compact no-diagnostic artifact.
- Result: pass

### large-json-object

- Use case: Compress large object payloads while retaining cursor and first record.
- Test strategy: JSONPath fact retention plus raw-output savings threshold.
- RTK good at: RTK has no native structured-object advantage here.
- UTK attempt: Use object key summary plus recoverable raw JSON artifact.
- Result: pass

### large-json-array

- Use case: Compress long arrays while retaining sentinel first and failed last events.
- Test strategy: Literal JSON sentinel retention plus raw-output savings threshold.
- RTK good at: RTK-style shell summarization is weaker on arbitrary arrays.
- UTK attempt: Summarize array cardinality and store raw array for fact recovery.
- Result: pass

### deeply-nested-response

- Use case: Compress nested workflow data while preserving deep artifact reference.
- Test strategy: Deep JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK tends to flatten nested context.
- UTK attempt: Schema-infer nested raw output and keep compact object keys.
- Result: pass

### repeated-text-logs

- Use case: Compress repeated log lines while retaining first and last batch facts.
- Test strategy: Boundary log literal retention plus raw-output savings threshold.
- RTK good at: RTK is strong at repeated shell logs.
- UTK attempt: Use line/count text envelope and raw log artifact recovery.
- Result: pass

### tabular-text

- Use case: Compress text tables while preserving row associations.
- Test strategy: Table row literal retention plus raw-output savings threshold.
- RTK good at: RTK is good at CLI table summaries.
- UTK attempt: Avoid restating table rows in chat; keep raw table artifact.
- Result: pass

### markdown-report

- Use case: Compress report prose while retaining findings.
- Test strategy: Markdown bullet retention plus raw-output savings threshold.
- RTK good at: RTK can shorten markdown-ish terminal output.
- UTK attempt: Store full report and expose schema/compact artifact handles.
- Result: pass

### arbitrary-structured-tool-output

- Use case: Compress arbitrary symbol index output while retaining entry path and symbol.
- Test strategy: Structured JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK is not designed for non-shell tool objects.
- UTK attempt: Schema-backed object summary plus raw artifact recovery.
- Result: pass

### synthetic-copilot-tool-output

- Use case: Compress Copilot tool output while preserving call id and first symbol file.
- Test strategy: Copilot JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK only sees text-like CLI output.
- UTK attempt: Mediate Copilot tool objects directly with recoverable raw JSON.
- Result: pass

### shell-npm-audit

- Use case: Compress npm audit output while preserving severity counts.
- Test strategy: Security count literal retention with strict RTK token win.
- RTK good at: RTK is effective at short audit summaries.
- UTK attempt: Keep full audit output recoverable and send compact text envelope.
- Result: pass

### shell-pytest-failure

- Use case: Compress pytest failure output while retaining failing test and assertion.
- Test strategy: Failure id and assertion literal retention with strict RTK token win.
- RTK good at: RTK can reduce traceback noise to failing test and reason.
- UTK attempt: Store full failure trace, send only compact text metadata.
- Result: pass

### shell-docker-ps

- Use case: Compress docker ps table while preserving unhealthy container.
- Test strategy: Container row literal retention with strict RTK token win.
- RTK good at: RTK is strong at terminal tables.
- UTK attempt: Preserve raw table and expose compact line/count metadata.
- Result: pass

### shell-kubectl-pods

- Use case: Compress kubectl pod table while retaining restart count and CrashLoopBackOff.
- Test strategy: Kubernetes status row retention with strict RTK token win.
- RTK good at: RTK summarizes kubectl tables well.
- UTK attempt: Keep kubectl raw output recoverable and compact response generic.
- Result: pass

### shell-curl-headers

- Use case: Compress curl headers while preserving throttle status and retry delay.
- Test strategy: HTTP status/header literal retention with strict RTK token win.
- RTK good at: RTK can trim curl header noise.
- UTK attempt: Persist headers exactly and send compact text envelope.
- Result: pass

### shell-du-sizes

- Use case: Compress du output while preserving largest directory size.
- Test strategy: Disk size/path literal retention with strict RTK token win.
- RTK good at: RTK handles small CLI size tables well.
- UTK attempt: Store raw size rows and compact to text line/count metadata.
- Result: pass

### shell-rg-json-lines

- Use case: Compress ripgrep JSON lines while retaining match path and line.
- Test strategy: JSON-lines search literal retention with strict RTK token win.
- RTK good at: RTK can summarize search JSON emitted by CLI tools.
- UTK attempt: Keep raw JSONL and avoid lossy in-chat rewriting.
- Result: pass

### shell-git-log-oneline

- Use case: Compress git log output while preserving commit order and subjects.
- Test strategy: Commit hash/subject retention with strict RTK token win.
- RTK good at: RTK makes short git history scannable.
- UTK attempt: Persist log raw text and send compact text envelope.
- Result: pass

### sarif-results

- Use case: Compress SARIF-like results while retaining rule id and affected file.
- Test strategy: Static-analysis JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK can summarize CLI analyzer text, but not structured SARIF well.
- UTK attempt: Use object schema summary and recoverable raw SARIF artifact.
- Result: pass

### junit-xml

- Use case: Compress JUnit XML while retaining failing testcase and message.
- Test strategy: XML literal retention plus raw-output savings threshold.
- RTK good at: RTK can trim terminal XML but loses structure easily.
- UTK attempt: Persist XML text and expose compact line/count metadata.
- Result: pass

### csv-export

- Use case: Compress CSV exports while retaining quoted fields.
- Test strategy: CSV quoted comma literal retention plus raw-output savings threshold.
- RTK good at: RTK handles small CSV text but has no typed CSV model.
- UTK attempt: Store exact CSV and keep compact text metadata.
- Result: pass

### graphql-response

- Use case: Compress GraphQL response while retaining typename and nested branch.
- Test strategy: GraphQL JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK has no special affordance for GraphQL result shape.
- UTK attempt: Schema summarize GraphQL JSON and keep raw artifact recoverable.
- Result: pass

### openapi-fragment

- Use case: Compress OpenAPI fragments while retaining method and operation id.
- Test strategy: OpenAPI JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK can summarize CLI schema dumps only as text.
- UTK attempt: Preserve schema object and expose compact key summary.
- Result: pass

### secret-bearing-log

- Use case: Compress secret-bearing logs without leaking raw output in response.
- Test strategy: Secret literal retained only via raw artifact plus response leakage guard in fixture test.
- RTK good at: RTK may shorten logs but still risks echoing sensitive substrings.
- UTK attempt: Do not echo raw string in response; keep full raw artifact recoverable.
- Result: pass

### shell-terraform-plan

- Use case: Compress Terraform plan output while preserving add/change/destroy counts.
- Test strategy: Terraform action-count tuple retention with strict RTK token win.
- RTK good at: RTK is strong at collapsing verbose infra plans into action counts.
- UTK attempt: Persist full plan and expose compact text envelope with recoverable raw detail.
- Result: pass

### shell-helm-status

- Use case: Compress Helm release status while preserving namespace, revision, and failed hook.
- Test strategy: Helm release metadata retention with strict RTK token win.
- RTK good at: RTK trims chart status output well.
- UTK attempt: Keep release output as artifact and send only schema-backed compact output.
- Result: pass

### shell-ps-memory

- Use case: Compress process table output while retaining PID and memory hotspot.
- Test strategy: Process memory hotspot retention with strict RTK token win.
- RTK good at: RTK is good at process-table summaries.
- UTK attempt: Store full process table and keep compact artifact metadata model-visible.
- Result: pass

### shell-netstat-listen

- Use case: Compress listening socket output while preserving bound address and owning process.
- Test strategy: Listen-address plus process retention with strict RTK token win.
- RTK good at: RTK summarizes networking CLI tables compactly.
- UTK attempt: Persist exact sockets and expose compact line/count artifact.
- Result: pass

### shell-openssl-cert

- Use case: Compress certificate inspection while retaining expiry and SAN.
- Test strategy: Certificate expiry/SAN retention with strict RTK token win.
- RTK good at: RTK handles verbose openssl output by pulling expiry facts.
- UTK attempt: Store the certificate dump and keep compact schema text in context.
- Result: pass

### shell-pnpm-install

- Use case: Compress package-manager install output while preserving peer dependency warning.
- Test strategy: Peer dependency warning retention with strict RTK token win.
- RTK good at: RTK filters package-manager noise effectively.
- UTK attempt: Keep full install log recoverable and return compact text shape only.
- Result: pass

### shell-go-test-race

- Use case: Compress Go race detector output while retaining race location.
- Test strategy: Go race detector file/function retention with strict RTK token win.
- RTK good at: RTK can reduce long race detector traces to key frames.
- UTK attempt: Store full trace and keep artifact handles in response.
- Result: pass

### shell-cargo-test

- Use case: Compress Cargo test output while retaining failing test and panic message.
- Test strategy: Rust panic test-name retention with strict RTK token win.
- RTK good at: RTK originated around Rust CLI output and handles Cargo logs well.
- UTK attempt: Recover full Cargo output via raw artifact and send compact text envelope.
- Result: pass

### shell-dotnet-test

- Use case: Compress dotnet test output while preserving failing test and duration.
- Test strategy: Dotnet failure and duration retention with strict RTK token win.
- RTK good at: RTK trims cross-platform test runner noise.
- UTK attempt: Persist test output and return compact artifact handles.
- Result: pass

### shell-powershell-error

- Use case: Compress PowerShell error output while preserving FullyQualifiedErrorId.
- Test strategy: PowerShell error id retention with strict RTK token win.
- RTK good at: RTK can reduce Windows shell noise.
- UTK attempt: Keep raw PowerShell diagnostic and expose compact text metadata.
- Result: pass

### shell-azure-deployment

- Use case: Compress Azure deployment output while retaining failed resource and correlation id.
- Test strategy: Cloud deployment correlation-id retention with strict RTK token win.
- RTK good at: RTK summarizes cloud CLI result blocks well.
- UTK attempt: Store full JSON/text output and keep compact object/text summary only.
- Result: pass

### shell-ffmpeg-progress

- Use case: Compress ffmpeg output while preserving codec error and timestamp.
- Test strategy: Media transcoder timestamp/error retention with strict RTK token win.
- RTK good at: RTK trims noisy progress streams.
- UTK attempt: Persist full ffmpeg stream and expose compact text shape.
- Result: pass

### shell-mysql-explain

- Use case: Compress SQL EXPLAIN table while preserving access type and rows estimate.
- Test strategy: SQL query-plan row retention with strict RTK token win.
- RTK good at: RTK can condense terminal query plans.
- UTK attempt: Raw plan remains recoverable while compact artifact only describes shape.
- Result: pass

### shell-windows-dir

- Use case: Compress Windows dir output while preserving file size and timestamp.
- Test strategy: Windows dir timestamp/size retention with strict RTK token win.
- RTK good at: RTK handles shell listings but can normalize away Windows details.
- UTK attempt: Store exact listing with CRLF-like spacing and return compact text envelope.
- Result: pass

### shell-jq-filter

- Use case: Compress jq output while preserving selected id and null field.
- Test strategy: jq-selected null/value retention with strict RTK token win.
- RTK good at: RTK can summarize filtered JSON output from shell pipelines.
- UTK attempt: Persist filtered output and expose compact shape metadata.
- Result: pass

### ndjson-event-stream

- Use case: Compress newline-delimited JSON while preserving first and last event ids.
- Test strategy: NDJSON boundary-event literal retention plus raw-output savings threshold.
- RTK good at: RTK can summarize text streams but has no event-stream schema.
- UTK attempt: Store exact NDJSON and expose compact text envelope.
- Result: pass

### lcov-coverage-report

- Use case: Compress LCOV text while preserving uncovered line and file.
- Test strategy: LCOV uncovered-line literal retention plus raw-output savings threshold.
- RTK good at: RTK handles terminal coverage summaries but not LCOV semantics.
- UTK attempt: Persist LCOV exactly and send compact text shape.
- Result: pass

### prometheus-metrics

- Use case: Compress Prometheus exposition while preserving metric labels and values.
- Test strategy: Prometheus labeled-sample retention plus raw-output savings threshold.
- RTK good at: RTK can shorten metric dumps but lacks label awareness.
- UTK attempt: Keep raw metrics scrape recoverable and compact only shape metadata.
- Result: pass

### har-network-log

- Use case: Compress HAR-like network logs while preserving failing request status.
- Test strategy: HAR nested request/status JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK can summarize browser CLI output but not nested HAR objects.
- UTK attempt: Schema summarize HAR object and retain raw network log.
- Result: pass

### playwright-trace-summary

- Use case: Compress browser trace summaries while retaining failed action and selector.
- Test strategy: Playwright action selector JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK sees browser traces as plain noisy text.
- UTK attempt: Mediate structured trace output directly with artifact recovery.
- Result: pass

### package-lock-subtree

- Use case: Compress package-lock subtree while preserving resolved version and integrity.
- Test strategy: Lockfile package JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK can summarize npm output, not lockfile trees.
- UTK attempt: Store lock subtree raw and compact only object keys.
- Result: pass

### tsserver-protocol-log

- Use case: Compress TypeScript server protocol logs while preserving request sequence.
- Test strategy: tsserver sequence/event literal retention plus raw-output savings threshold.
- RTK good at: RTK may shrink protocol logs as plain text only.
- UTK attempt: Keep JSON protocol lines exact and expose compact text envelope.
- Result: pass

### sqlite-query-result

- Use case: Compress SQLite query result rows while preserving tenant and deleted marker.
- Test strategy: SQL row object JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK can summarize CLI tables but not typed row objects.
- UTK attempt: Summarize array cardinality and retain raw result rows.
- Result: pass

### rfc822-email

- Use case: Compress RFC822 message output while preserving Message-ID and subject.
- Test strategy: RFC822 header literal retention plus raw-output savings threshold.
- RTK good at: RTK can shorten email-like terminal output but may lose headers.
- UTK attempt: Store full email artifact and expose compact text metadata.
- Result: pass

### icalendar-event

- Use case: Compress iCalendar event output while preserving UID and timezone timestamp.
- Test strategy: iCalendar UID/DTSTART literal retention plus raw-output savings threshold.
- RTK good at: RTK has no calendar-specific structure model.
- UTK attempt: Persist .ics text exactly and keep compact text envelope.
- Result: pass

### yaml-k8s-manifest

- Use case: Compress Kubernetes YAML while preserving image digest and replica count.
- Test strategy: YAML image/replica literal retention plus raw-output savings threshold.
- RTK good at: RTK treats YAML dumps as plain shell text.
- UTK attempt: Store manifest raw and return compact text shape metadata.
- Result: pass

### toml-config-fragment

- Use case: Compress TOML config while preserving serializer override and boolean flag.
- Test strategy: TOML dotted-key literal retention plus raw-output savings threshold.
- RTK good at: RTK can shorten config text but not validate TOML fields.
- UTK attempt: Keep config raw and expose compact artifact reference.
- Result: pass

### protobuf-json-diagnostic

- Use case: Compress protobuf JSON diagnostic output while preserving field number and reserved range.
- Test strategy: Protobuf diagnostic JSONPath retention plus raw-output savings threshold.
- RTK good at: RTK can summarize compiler text but not typed descriptor JSON.
- UTK attempt: Schema summarize descriptor object and retain full raw JSON.
- Result: pass

### binary-png-header

- Use case: Compress binary-ish output while preserving raw artifact recovery for magic bytes.
- Test strategy: Binary magic-byte literal recovery plus raw-output savings threshold.
- RTK good at: RTK is text-first and cannot safely summarize binary payloads.
- UTK attempt: Persist binary-like payload and expose a binary envelope instead of echoing bytes.
- Result: pass

### multipart-form-data

- Use case: Compress multipart payloads while preserving boundary and file field name.
- Test strategy: Multipart boundary/file-field literal retention plus raw-output savings threshold.
- RTK good at: RTK can mangle multipart punctuation under aggressive text compression.
- UTK attempt: Store multipart raw text and keep compact text envelope only.
- Result: pass

### ansi-colored-output

- Use case: Compress colored terminal output while preserving visible error after escape codes.
- Test strategy: ANSI escaped-error literal retention plus raw-output savings threshold.
- RTK good at: RTK often targets terminal text but escape codes can obscure facts.
- UTK attempt: Persist raw ANSI output and expose compact line/count metadata.
- Result: pass

### unicode-width-table

- Use case: Compress wide Unicode table output while preserving emoji/status associations.
- Test strategy: Unicode-width row literal retention plus raw-output savings threshold.
- RTK good at: RTK can lose alignment or glyph associations in wide terminal tables.
- UTK attempt: Keep raw Unicode table recoverable and compact only text shape.
- Result: pass

### patch-with-renames

- Use case: Compress patch metadata while preserving rename similarity and file paths.
- Test strategy: Git rename metadata literal retention plus raw-output savings threshold.
- RTK good at: RTK summarizes diffs but can omit rename metadata.
- UTK attempt: Persist full patch and expose compact text envelope.
- Result: pass
