# Tool-Calling Bypass Eval Scenarios

Generated from `packages/evals/fixtures/toolCallingBypassFixtures.ts`.

## Summary

- Scenarios: 296
- Positive bypasses: 263
- Fail-open / clarification cases: 33
- Local execution required: 24
- Matching levels: slash-commands, exact-lexical-match, regex-patterns, lexical-similarity

## Level Coverage

| Level | Cases |
| --- | ---: |
| slash-commands | 80 |
| exact-lexical-match | 42 |
| regex-patterns | 101 |
| lexical-similarity | 73 |

## Category Coverage

| Category | Cases |
| --- | ---: |
| slash-command | 39 |
| exact-lexical-match | 32 |
| regex-pattern | 56 |
| lexical-similarity | 38 |
| embedding | 20 |
| arguments | 36 |
| local-execution | 24 |
| api-shape | 13 |
| protected | 11 |
| denied | 8 |
| ambiguous | 8 |
| safety-negative | 11 |

## Scenario Matrix

| Scenario | Category | Level | Route | Expected | Tool | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| slash-run-tests-flags | slash-command | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| slash-run-tests-hyphen-alias | slash-command | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| slash-run-tests-dot-alias-json | slash-command | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| slash-grep-flags | slash-command | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| slash-read-file-target | slash-command | slash-commands | /v1/chat/completions | bypass | read_file | slash-command |
| slash-read-file-hyphen-quoted-path | slash-command | slash-commands | /v1/chat/completions | bypass | read_file | slash-command |
| slash-fetch-url | slash-command | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| slash-web-search-key-value | slash-command | slash-commands | /v1/chat/completions | bypass | web_search | slash-command |
| slash-list-files-default-path | slash-command | slash-commands | /v1/chat/completions | bypass | list_files | slash-command |
| slash-create-file-content | slash-command | slash-commands | /v1/chat/completions | bypass | create_file | slash-command |
| slash-send-email-required-arg | slash-command | slash-commands | /v1/chat/completions | bypass | send_email | slash-command |
| slash-missing-required-clarifies | safety-negative | slash-commands | /v1/chat/completions | missing-required-args |  |  |
| exact-run-tests | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| exact-read-file-with-target | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| exact-list-files | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | list_files | exact-lexical-match |
| exact-web-search | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | web_search | exact-lexical-match |
| exact-fetch-url | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | fetch | exact-lexical-match |
| exact-case-folding | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| exact-punctuation-spacing | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| exact-hyphen-phrase | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| regex-run-vitest-politeness | regex-pattern | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| regex-find-todo-in-src | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| regex-read-package-json | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| regex-open-url-fetch | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| regex-list-files-path | regex-pattern | regex-patterns | /v1/chat/completions | bypass | list_files | regex-pattern |
| regex-search-web | regex-pattern | regex-patterns | /v1/chat/completions | bypass | web_search | regex-pattern |
| regex-send-email | regex-pattern | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| regex-create-file-content | regex-pattern | regex-patterns | /v1/chat/completions | bypass | create_file | regex-pattern |
| regex-delete-file-path | regex-pattern | regex-patterns | /v1/chat/completions | bypass | delete_file | regex-pattern |
| regex-fetch-trailing-punctuation | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| regex-grep-quoted-pattern | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| regex-read-file-windows-path | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| similarity-runn-tests | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | run_tests | lexical-similarity |
| similarity-fnd-todo | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| similarity-serch-files | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| similarity-reed-package-json | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | read_file | lexical-similarity |
| similarity-opne-url | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | fetch | lexical-similarity |
| similarity-lst-files | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | list_files | lexical-similarity |
| similarity-creat-file | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | create_file | lexical-similarity |
| similarity-delet-file | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | delete_file | lexical-similarity |
| similarity-web-serch | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | web_search | lexical-similarity |
| similarity-snd-email | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | send_email | lexical-similarity |
| embedding-outranks-overlapping-search | embedding | lexical-similarity | /v1/chat/completions | bypass | send_email | embedding |
| embedding-semantic-read-config | embedding | lexical-similarity | /v1/chat/completions | bypass | read_file | embedding |
| embedding-semantic-directory | embedding | lexical-similarity | /v1/chat/completions | bypass | list_files | embedding |
| embedding-unavailable-fallback-open | embedding | lexical-similarity | /v1/chat/completions | ambiguous |  |  |
| args-json-tail | arguments | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| args-cli-flag-boolean | arguments | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| args-key-value-dot-normalization | arguments | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| args-path-like-text | arguments | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| args-url-like-text | arguments | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| args-quoted-email-body | arguments | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| args-default-run-suite | arguments | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| args-registry-default-path | arguments | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| local-exec-chat-slash | local-execution | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| local-exec-chat-exact | local-execution | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| local-exec-chat-regex | local-execution | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| local-exec-chat-similarity | local-execution | lexical-similarity | /v1/chat/completions | bypass | run_tests | lexical-similarity |
| local-exec-responses-slash | local-execution | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| local-exec-mediated-artifact | local-execution | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| local-exec-no-upstream-synthetic | api-shape | slash-commands | /v1/chat/completions | bypass | read_file | slash-command |
| api-shape-chat-tool-call | api-shape | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| api-shape-responses-function-call | api-shape | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| protected-edit-natural-fails-open | protected | regex-patterns | /v1/chat/completions | protected-tool |  |  |
| protected-edit-slash-allowed | protected | slash-commands | /v1/chat/completions | bypass | edit_file | slash-command |
| protected-edit-configured-regex | protected | regex-patterns | /v1/chat/completions | bypass | edit_file | regex-pattern |
| denied-delete-slash-blocked | denied | slash-commands | /v1/chat/completions | denied-tool |  |  |
| denied-delete-regex-blocked | denied | regex-patterns | /v1/chat/completions | denied-tool |  |  |
| ambiguous-search-project | ambiguous | regex-patterns | /v1/chat/completions | ambiguous |  |  |
| ambiguous-search-project-with-extra-tool-order | ambiguous | lexical-similarity | /v1/chat/completions | ambiguous |  |  |
| negative-do-not-run-tests | safety-negative | lexical-similarity | /v1/chat/completions | negated |  |  |
| negative-explain-edit-files | safety-negative | regex-patterns | /v1/chat/completions | explanatory |  |  |
| negative-delete-metaphor | safety-negative | lexical-similarity | /v1/chat/completions | no-match |  |  |
| negative-create-strategy | safety-negative | lexical-similarity | /v1/chat/completions | explanatory |  |  |
| matrix-slash-run-tests-0 | slash-command | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-slash-run-tests-1 | slash-command | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-slash-run-tests-2 | slash-command | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-slash-run-tests-3 | slash-command | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-slash-grep-0 | slash-command | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-slash-grep-1 | slash-command | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-slash-grep-2 | slash-command | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-slash-grep-3 | slash-command | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-slash-read-file-0 | slash-command | slash-commands | /v1/chat/completions | bypass | read_file | slash-command |
| matrix-slash-read-file-1 | slash-command | slash-commands | /v1/chat/completions | bypass | read_file | slash-command |
| matrix-slash-read-file-2 | slash-command | slash-commands | /v1/chat/completions | bypass | read_file | slash-command |
| matrix-slash-read-file-3 | slash-command | slash-commands | /v1/chat/completions | bypass | read_file | slash-command |
| matrix-slash-fetch-0 | slash-command | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| matrix-slash-fetch-1 | slash-command | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| matrix-slash-fetch-2 | slash-command | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| matrix-slash-fetch-3 | slash-command | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| matrix-slash-list-files-0 | slash-command | slash-commands | /v1/chat/completions | bypass | list_files | slash-command |
| matrix-slash-list-files-1 | slash-command | slash-commands | /v1/chat/completions | bypass | list_files | slash-command |
| matrix-slash-list-files-2 | slash-command | slash-commands | /v1/chat/completions | bypass | list_files | slash-command |
| matrix-slash-list-files-3 | slash-command | slash-commands | /v1/chat/completions | bypass | list_files | slash-command |
| matrix-slash-create-file-0 | slash-command | slash-commands | /v1/chat/completions | bypass | create_file | slash-command |
| matrix-slash-create-file-1 | slash-command | slash-commands | /v1/chat/completions | bypass | create_file | slash-command |
| matrix-slash-create-file-2 | slash-command | slash-commands | /v1/chat/completions | bypass | create_file | slash-command |
| matrix-slash-create-file-3 | slash-command | slash-commands | /v1/chat/completions | bypass | create_file | slash-command |
| matrix-slash-send-email-0 | slash-command | slash-commands | /v1/chat/completions | bypass | send_email | slash-command |
| matrix-slash-send-email-1 | slash-command | slash-commands | /v1/chat/completions | bypass | send_email | slash-command |
| matrix-slash-send-email-2 | slash-command | slash-commands | /v1/chat/completions | bypass | send_email | slash-command |
| matrix-slash-send-email-3 | slash-command | slash-commands | /v1/chat/completions | bypass | send_email | slash-command |
| matrix-exact-run-tests-0 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| matrix-exact-run-tests-1 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| matrix-exact-run-tests-2 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| matrix-exact-run-tests-3 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| matrix-exact-read-file-0 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| matrix-exact-read-file-1 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| matrix-exact-read-file-2 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| matrix-exact-read-file-3 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| matrix-exact-list-files-0 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | list_files | exact-lexical-match |
| matrix-exact-list-files-1 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | list_files | exact-lexical-match |
| matrix-exact-list-files-2 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | list_files | exact-lexical-match |
| matrix-exact-list-files-3 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | list_files | exact-lexical-match |
| matrix-exact-fetch-0 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | fetch | exact-lexical-match |
| matrix-exact-fetch-1 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | fetch | exact-lexical-match |
| matrix-exact-fetch-2 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | fetch | exact-lexical-match |
| matrix-exact-fetch-3 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | fetch | exact-lexical-match |
| matrix-exact-web-search-0 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | web_search | exact-lexical-match |
| matrix-exact-web-search-1 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | web_search | exact-lexical-match |
| matrix-exact-web-search-2 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | web_search | exact-lexical-match |
| matrix-exact-web-search-3 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | web_search | exact-lexical-match |
| matrix-exact-send-email-0 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | send_email | exact-lexical-match |
| matrix-exact-send-email-1 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | send_email | exact-lexical-match |
| matrix-exact-send-email-2 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | send_email | exact-lexical-match |
| matrix-exact-send-email-3 | exact-lexical-match | exact-lexical-match | /v1/chat/completions | bypass | send_email | exact-lexical-match |
| matrix-regex-run-vitest-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-regex-run-vitest-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-regex-run-vitest-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-regex-run-vitest-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-regex-run-jest-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-regex-run-jest-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-regex-run-jest-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-regex-run-jest-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-regex-find-in-path-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| matrix-regex-find-in-path-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| matrix-regex-find-in-path-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| matrix-regex-find-in-path-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| matrix-regex-look-under-path-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| matrix-regex-look-under-path-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| matrix-regex-look-under-path-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| matrix-regex-look-under-path-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | grep | regex-pattern |
| matrix-regex-read-file-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| matrix-regex-read-file-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| matrix-regex-read-file-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| matrix-regex-read-file-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| matrix-regex-open-file-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| matrix-regex-open-file-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| matrix-regex-open-file-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| matrix-regex-open-file-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | read_file | regex-pattern |
| matrix-regex-open-url-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-regex-open-url-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-regex-open-url-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-regex-open-url-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-regex-get-url-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-regex-get-url-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-regex-get-url-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-regex-get-url-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-regex-list-files-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | list_files | regex-pattern |
| matrix-regex-list-files-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | list_files | regex-pattern |
| matrix-regex-list-files-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | list_files | regex-pattern |
| matrix-regex-list-files-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | list_files | regex-pattern |
| matrix-regex-search-web-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | web_search | regex-pattern |
| matrix-regex-search-web-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | web_search | regex-pattern |
| matrix-regex-search-web-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | web_search | regex-pattern |
| matrix-regex-search-web-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | web_search | regex-pattern |
| matrix-regex-email-0 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| matrix-regex-email-1 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| matrix-regex-email-2 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| matrix-regex-email-3 | regex-pattern | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| matrix-similarity-runn-tests-0 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | run_tests | lexical-similarity |
| matrix-similarity-runn-tests-1 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | run_tests | lexical-similarity |
| matrix-similarity-runn-tests-2 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | run_tests | lexical-similarity |
| matrix-similarity-runn-tests-3 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | run_tests | lexical-similarity |
| matrix-similarity-fnd-grep-0 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| matrix-similarity-fnd-grep-1 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| matrix-similarity-fnd-grep-2 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| matrix-similarity-fnd-grep-3 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| matrix-similarity-serch-files-0 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| matrix-similarity-serch-files-1 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| matrix-similarity-serch-files-2 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| matrix-similarity-serch-files-3 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | grep | lexical-similarity |
| matrix-similarity-reed-file-0 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | read_file | lexical-similarity |
| matrix-similarity-reed-file-1 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | read_file | lexical-similarity |
| matrix-similarity-reed-file-2 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | read_file | lexical-similarity |
| matrix-similarity-reed-file-3 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | read_file | lexical-similarity |
| matrix-similarity-opne-url-0 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | fetch | lexical-similarity |
| matrix-similarity-opne-url-1 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | fetch | lexical-similarity |
| matrix-similarity-opne-url-2 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | fetch | lexical-similarity |
| matrix-similarity-opne-url-3 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | fetch | lexical-similarity |
| matrix-similarity-lst-files-0 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | list_files | lexical-similarity |
| matrix-similarity-lst-files-1 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | list_files | lexical-similarity |
| matrix-similarity-lst-files-2 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | list_files | lexical-similarity |
| matrix-similarity-lst-files-3 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | list_files | lexical-similarity |
| matrix-similarity-snd-email-0 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | send_email | lexical-similarity |
| matrix-similarity-snd-email-1 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | send_email | lexical-similarity |
| matrix-similarity-snd-email-2 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | send_email | lexical-similarity |
| matrix-similarity-snd-email-3 | lexical-similarity | lexical-similarity | /v1/chat/completions | bypass | send_email | lexical-similarity |
| matrix-embedding-manifest-0 | embedding | lexical-similarity | /v1/chat/completions | bypass | read_file | embedding |
| matrix-embedding-manifest-1 | embedding | lexical-similarity | /v1/chat/completions | bypass | read_file | embedding |
| matrix-embedding-manifest-2 | embedding | lexical-similarity | /v1/chat/completions | bypass | read_file | embedding |
| matrix-embedding-manifest-3 | embedding | lexical-similarity | /v1/chat/completions | bypass | read_file | embedding |
| matrix-embedding-tree-0 | embedding | lexical-similarity | /v1/chat/completions | bypass | list_files | embedding |
| matrix-embedding-tree-1 | embedding | lexical-similarity | /v1/chat/completions | bypass | list_files | embedding |
| matrix-embedding-tree-2 | embedding | lexical-similarity | /v1/chat/completions | bypass | list_files | embedding |
| matrix-embedding-tree-3 | embedding | lexical-similarity | /v1/chat/completions | bypass | list_files | embedding |
| matrix-embedding-contact-0 | embedding | lexical-similarity | /v1/chat/completions | bypass | send_email | embedding |
| matrix-embedding-contact-1 | embedding | lexical-similarity | /v1/chat/completions | bypass | send_email | embedding |
| matrix-embedding-contact-2 | embedding | lexical-similarity | /v1/chat/completions | bypass | send_email | embedding |
| matrix-embedding-contact-3 | embedding | lexical-similarity | /v1/chat/completions | bypass | send_email | embedding |
| matrix-embedding-retrieve-page-0 | embedding | lexical-similarity | /v1/chat/completions | bypass | fetch | embedding |
| matrix-embedding-retrieve-page-1 | embedding | lexical-similarity | /v1/chat/completions | bypass | fetch | embedding |
| matrix-embedding-retrieve-page-2 | embedding | lexical-similarity | /v1/chat/completions | bypass | fetch | embedding |
| matrix-embedding-retrieve-page-3 | embedding | lexical-similarity | /v1/chat/completions | bypass | fetch | embedding |
| matrix-args-json-run-0 | arguments | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-args-json-run-1 | arguments | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-args-json-run-2 | arguments | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-args-json-run-3 | arguments | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-args-quoted-grep-0 | arguments | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-args-quoted-grep-1 | arguments | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-args-quoted-grep-2 | arguments | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-args-quoted-grep-3 | arguments | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-args-key-value-0 | arguments | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-args-key-value-1 | arguments | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-args-key-value-2 | arguments | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-args-key-value-3 | arguments | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-args-content-file-0 | arguments | regex-patterns | /v1/chat/completions | bypass | create_file | regex-pattern |
| matrix-args-content-file-1 | arguments | regex-patterns | /v1/chat/completions | bypass | create_file | regex-pattern |
| matrix-args-content-file-2 | arguments | regex-patterns | /v1/chat/completions | bypass | create_file | regex-pattern |
| matrix-args-content-file-3 | arguments | regex-patterns | /v1/chat/completions | bypass | create_file | regex-pattern |
| matrix-args-url-query-0 | arguments | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-args-url-query-1 | arguments | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-args-url-query-2 | arguments | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-args-url-query-3 | arguments | regex-patterns | /v1/chat/completions | bypass | fetch | regex-pattern |
| matrix-args-email-body-0 | arguments | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| matrix-args-email-body-1 | arguments | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| matrix-args-email-body-2 | arguments | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| matrix-args-email-body-3 | arguments | regex-patterns | /v1/chat/completions | bypass | send_email | regex-pattern |
| matrix-args-read-file-0 | arguments | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| matrix-args-read-file-1 | arguments | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| matrix-args-read-file-2 | arguments | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| matrix-args-read-file-3 | arguments | exact-lexical-match | /v1/chat/completions | bypass | read_file | exact-lexical-match |
| matrix-local-exec-slash-run-0 | local-execution | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-local-exec-slash-run-1 | local-execution | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-local-exec-slash-run-2 | local-execution | slash-commands | /v1/chat/completions | bypass | run_tests | slash-command |
| matrix-local-exec-exact-run-0 | local-execution | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| matrix-local-exec-exact-run-1 | local-execution | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| matrix-local-exec-exact-run-2 | local-execution | exact-lexical-match | /v1/chat/completions | bypass | run_tests | exact-lexical-match |
| matrix-local-exec-regex-run-0 | local-execution | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-local-exec-regex-run-1 | local-execution | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-local-exec-regex-run-2 | local-execution | regex-patterns | /v1/chat/completions | bypass | run_tests | regex-pattern |
| matrix-local-exec-fuzzy-run-0 | local-execution | lexical-similarity | /v1/chat/completions | bypass | run_tests | lexical-similarity |
| matrix-local-exec-fuzzy-run-1 | local-execution | lexical-similarity | /v1/chat/completions | bypass | run_tests | lexical-similarity |
| matrix-local-exec-fuzzy-run-2 | local-execution | lexical-similarity | /v1/chat/completions | bypass | run_tests | lexical-similarity |
| matrix-local-exec-responses-run-0 | local-execution | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| matrix-local-exec-responses-run-1 | local-execution | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| matrix-local-exec-responses-run-2 | local-execution | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| matrix-local-exec-mediated-grep-0 | local-execution | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-local-exec-mediated-grep-1 | local-execution | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-local-exec-mediated-grep-2 | local-execution | slash-commands | /v1/chat/completions | bypass | grep | slash-command |
| matrix-api-chat-tool-call-0 | api-shape | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| matrix-api-chat-tool-call-1 | api-shape | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| matrix-api-chat-tool-call-2 | api-shape | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| matrix-api-chat-tool-call-3 | api-shape | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| matrix-api-chat-tool-call-4 | api-shape | slash-commands | /v1/chat/completions | bypass | fetch | slash-command |
| matrix-api-responses-function-call-0 | api-shape | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| matrix-api-responses-function-call-1 | api-shape | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| matrix-api-responses-function-call-2 | api-shape | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| matrix-api-responses-function-call-3 | api-shape | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| matrix-api-responses-function-call-4 | api-shape | slash-commands | /v1/responses | bypass | run_tests | slash-command |
| matrix-protected-natural-edit-0 | protected | regex-patterns | /v1/chat/completions | protected-tool |  |  |
| matrix-protected-natural-edit-1 | protected | regex-patterns | /v1/chat/completions | protected-tool |  |  |
| matrix-protected-natural-edit-2 | protected | regex-patterns | /v1/chat/completions | protected-tool |  |  |
| matrix-protected-natural-edit-3 | protected | regex-patterns | /v1/chat/completions | protected-tool |  |  |
| matrix-protected-configured-edit-0 | protected | regex-patterns | /v1/chat/completions | bypass | edit_file | regex-pattern |
| matrix-protected-configured-edit-1 | protected | regex-patterns | /v1/chat/completions | bypass | edit_file | regex-pattern |
| matrix-protected-configured-edit-2 | protected | regex-patterns | /v1/chat/completions | bypass | edit_file | regex-pattern |
| matrix-protected-configured-edit-3 | protected | regex-patterns | /v1/chat/completions | bypass | edit_file | regex-pattern |
| matrix-denied-slash-delete-0 | denied | slash-commands | /v1/chat/completions | denied-tool |  |  |
| matrix-denied-slash-delete-1 | denied | slash-commands | /v1/chat/completions | denied-tool |  |  |
| matrix-denied-slash-delete-2 | denied | slash-commands | /v1/chat/completions | denied-tool |  |  |
| matrix-denied-regex-delete-0 | denied | regex-patterns | /v1/chat/completions | denied-tool |  |  |
| matrix-denied-regex-delete-1 | denied | regex-patterns | /v1/chat/completions | denied-tool |  |  |
| matrix-denied-regex-delete-2 | denied | regex-patterns | /v1/chat/completions | denied-tool |  |  |
| matrix-ambiguous-search-0 | ambiguous | regex-patterns | /v1/chat/completions | ambiguous |  |  |
| matrix-ambiguous-search-1 | ambiguous | lexical-similarity | /v1/chat/completions | ambiguous |  |  |
| matrix-ambiguous-search-2 | ambiguous | regex-patterns | /v1/chat/completions | ambiguous |  |  |
| matrix-ambiguous-search-3 | ambiguous | lexical-similarity | /v1/chat/completions | ambiguous |  |  |
| matrix-ambiguous-search-4 | ambiguous | regex-patterns | /v1/chat/completions | ambiguous |  |  |
| matrix-ambiguous-search-5 | ambiguous | lexical-similarity | /v1/chat/completions | ambiguous |  |  |
| matrix-safety-negative-0 | safety-negative | lexical-similarity | /v1/chat/completions | negated |  |  |
| matrix-safety-negative-1 | safety-negative | lexical-similarity | /v1/chat/completions | negated |  |  |
| matrix-safety-negative-2 | safety-negative | regex-patterns | /v1/chat/completions | explanatory |  |  |
| matrix-safety-negative-3 | safety-negative | lexical-similarity | /v1/chat/completions | explanatory |  |  |
| matrix-safety-negative-4 | safety-negative | lexical-similarity | /v1/chat/completions | no-match |  |  |
| matrix-safety-negative-5 | safety-negative | regex-patterns | /v1/chat/completions | no-match |  |  |
