export const TOOL_CALLING_BYPASS_LEVELS = ['slash-commands', 'exact-lexical-match', 'regex-patterns', 'lexical-similarity'] as const;
export type ToolCallingBypassLevel = (typeof TOOL_CALLING_BYPASS_LEVELS)[number];

export const TOOL_CALLING_BYPASS_CATEGORIES = [
  'slash-command',
  'exact-lexical-match',
  'regex-pattern',
  'lexical-similarity',
  'embedding',
  'arguments',
  'local-execution',
  'api-shape',
  'protected',
  'denied',
  'ambiguous',
  'safety-negative'
] as const;
export type ToolCallingBypassCategory = (typeof TOOL_CALLING_BYPASS_CATEGORIES)[number];

export type ToolCallingBypassReason = 'slash-command' | 'embedding' | 'exact-lexical-match' | 'regex-pattern' | 'lexical-similarity';
export type ToolCallingBypassRoute = '/v1/chat/completions' | '/v1/responses';

export type ToolCallingBypassExpected = {
  shouldBypass: boolean;
  shouldExecute?: boolean;
  shouldForwardUpstream?: boolean;
  expectedTool?: string;
  expectedReason?: ToolCallingBypassReason;
  expectedArgs?: Record<string, unknown>;
  expectedOutputContains?: string[];
  expectedMissReason?: 'ambiguous' | 'denied-tool' | 'protected-tool' | 'negated' | 'explanatory' | 'missing-required-args' | 'no-match';
  clarificationContains?: string[];
};

export type ToolCallingBypassFixture = {
  name: string;
  category: ToolCallingBypassCategory;
  level: ToolCallingBypassLevel;
  route: ToolCallingBypassRoute;
  input: string;
  availableTools: string[];
  protectedTools?: string[];
  deniedTools?: string[];
  configuredRegex?: boolean;
  localEmbedding?: boolean;
  testStrategy: string;
  notes: string;
  expected: ToolCallingBypassExpected;
};

export const TOOL_CALLING_BYPASS_SCENARIO_MULTIPLIER = 4;
const GENERATED_MISS_REASONS: readonly GeneratedMissReason[] = ['ambiguous', 'denied-tool', 'protected-tool', 'negated', 'explanatory', 'missing-required-args', 'no-match'];

const DEFAULT_AVAILABLE_TOOLS = [
  'run_tests',
  'grep',
  'read_file',
  'fetch',
  'list_files',
  'create_file',
  'delete_file',
  'edit_file',
  'web_search',
  'send_email'
] as const;

function scenario(params: Omit<ToolCallingBypassFixture, 'route' | 'availableTools'> & Partial<Pick<ToolCallingBypassFixture, 'route' | 'availableTools'>>): ToolCallingBypassFixture {
  return {
    ...params,
    route: params.route ?? '/v1/chat/completions',
    availableTools: params.availableTools ?? [...DEFAULT_AVAILABLE_TOOLS]
  };
}

const BASE_TOOL_CALLING_BYPASS_FIXTURES: ToolCallingBypassFixture[] = [
  scenario({
    name: 'slash-run-tests-flags',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/run_tests --pattern unit',
    testStrategy: 'Explicit slash command with CLI-style flag must bypass before upstream.',
    notes: 'Covers canonical slash alias and flag parsing.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'slash-command', expectedArgs: { pattern: 'unit' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-run-tests-hyphen-alias',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/run-tests --pattern smoke',
    testStrategy: 'Hyphenated slash alias maps to underscore tool name.',
    notes: 'Prevents tool-name separator drift.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'slash-command', expectedArgs: { pattern: 'smoke' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-run-tests-dot-alias-json',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/run.tests {"pattern":"api","suite":"integration"}',
    testStrategy: 'Dot slash alias with JSON tail keeps structured args.',
    notes: 'Covers explicit JSON argument precedence.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'slash-command', expectedArgs: { pattern: 'api', suite: 'integration' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-grep-flags',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/grep --pattern TODO --path src',
    testStrategy: 'Slash local search command captures pattern and path.',
    notes: 'Separates project grep from web search.',
    expected: { shouldBypass: true, expectedTool: 'grep', expectedReason: 'slash-command', expectedArgs: { pattern: 'TODO', path: 'src' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-read-file-target',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/read_file package.json',
    testStrategy: 'Single string target resolves to path argument.',
    notes: 'Covers default arg inference for read tools.',
    expected: { shouldBypass: true, expectedTool: 'read_file', expectedReason: 'slash-command', expectedArgs: { path: 'package.json' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-read-file-hyphen-quoted-path',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/read-file --path "src/app.ts"',
    testStrategy: 'Quoted path survives slash command parsing.',
    notes: 'Protects space/quote handling in CLI-like args.',
    expected: { shouldBypass: true, expectedTool: 'read_file', expectedReason: 'slash-command', expectedArgs: { path: 'src/app.ts' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-fetch-url',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/fetch https://example.com/docs',
    testStrategy: 'URL target becomes url arg.',
    notes: 'Prevents URL from being treated as file path.',
    expected: { shouldBypass: true, expectedTool: 'fetch', expectedReason: 'slash-command', expectedArgs: { url: 'https://example.com/docs' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-web-search-key-value',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/web_search query="typescript release notes"',
    testStrategy: 'Key-value quoted query parses into function args.',
    notes: 'Covers public web search explicit call.',
    expected: { shouldBypass: true, expectedTool: 'web_search', expectedReason: 'slash-command', expectedArgs: { query: 'typescript release notes' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-list-files-default-path',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/list_files',
    testStrategy: 'Schema default args fill missing optional path.',
    notes: 'Defaults must exist for registered/request tools.',
    expected: { shouldBypass: true, expectedTool: 'list_files', expectedReason: 'slash-command', expectedArgs: { path: '.' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-create-file-content',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/create_file --path docs/plan.md --content "ship it"',
    testStrategy: 'Slash create captures path and quoted content.',
    notes: 'Covers write-like command with content arg.',
    expected: { shouldBypass: true, expectedTool: 'create_file', expectedReason: 'slash-command', expectedArgs: { path: 'docs/plan.md', content: 'ship it' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-send-email-required-arg',
    category: 'slash-command',
    level: 'slash-commands',
    input: '/send_email to=ada@example.com subject="Status"',
    testStrategy: 'Slash command with email address parses required recipient.',
    notes: 'Covers email capture and quoted key-value args.',
    expected: { shouldBypass: true, expectedTool: 'send_email', expectedReason: 'slash-command', expectedArgs: { to: 'ada@example.com', subject: 'Status' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'slash-missing-required-clarifies',
    category: 'safety-negative',
    level: 'slash-commands',
    input: '/send_email',
    testStrategy: 'Explicit slash without required args returns local clarification, not upstream guess.',
    notes: 'Protects missing required argument behavior.',
    expected: { shouldBypass: false, expectedMissReason: 'missing-required-args', clarificationContains: ['Missing required arguments', 'send_email', 'to'], shouldForwardUpstream: false }
  }),

  scenario({
    name: 'exact-run-tests',
    category: 'exact-lexical-match',
    level: 'exact-lexical-match',
    input: 'run tests',
    testStrategy: 'Bare exact alias bypasses at exact lexical level.',
    notes: 'No regex or embedding needed.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'exact-lexical-match', shouldForwardUpstream: false }
  }),
  scenario({
    name: 'exact-read-file-with-target',
    category: 'exact-lexical-match',
    level: 'exact-lexical-match',
    input: 'read file package.json',
    testStrategy: 'Exact alias plus argument tail resolves file path.',
    notes: 'Covers exact match with argument-looking suffix.',
    expected: { shouldBypass: true, expectedTool: 'read_file', expectedReason: 'exact-lexical-match', expectedArgs: { path: 'package.json' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'exact-list-files',
    category: 'exact-lexical-match',
    level: 'exact-lexical-match',
    input: 'list files',
    testStrategy: 'Bare exact list alias uses default path.',
    notes: 'Checks default arg behavior outside slash calls.',
    expected: { shouldBypass: true, expectedTool: 'list_files', expectedReason: 'exact-lexical-match', expectedArgs: { path: '.' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'exact-web-search',
    category: 'exact-lexical-match',
    level: 'exact-lexical-match',
    input: 'web search openai docs',
    testStrategy: 'Exact alias with query-like tail picks web search.',
    notes: 'Search target is public web, not local grep.',
    expected: { shouldBypass: true, expectedTool: 'web_search', expectedReason: 'exact-lexical-match', expectedArgs: { query: 'openai docs' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'exact-fetch-url',
    category: 'exact-lexical-match',
    level: 'exact-lexical-match',
    input: 'fetch url https://example.org',
    testStrategy: 'Exact fetch alias captures URL argument.',
    notes: 'Covers alias containing parameter name.',
    expected: { shouldBypass: true, expectedTool: 'fetch', expectedReason: 'exact-lexical-match', expectedArgs: { url: 'https://example.org' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'exact-case-folding',
    category: 'exact-lexical-match',
    level: 'exact-lexical-match',
    input: 'RUN TESTS',
    testStrategy: 'Case variants still select exact alias.',
    notes: 'Prevents needless upstream call on shout-case commands.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'exact-lexical-match', shouldForwardUpstream: false }
  }),
  scenario({
    name: 'exact-punctuation-spacing',
    category: 'exact-lexical-match',
    level: 'exact-lexical-match',
    input: 'run    tests',
    testStrategy: 'Whitespace normalization preserves exact lexical intent.',
    notes: 'Covers spacing fuzz around aliases.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'exact-lexical-match', shouldForwardUpstream: false }
  }),
  scenario({
    name: 'exact-hyphen-phrase',
    category: 'exact-lexical-match',
    level: 'exact-lexical-match',
    input: 'run-tests',
    testStrategy: 'Hyphen phrase normalizes to lexical alias.',
    notes: 'Covers natural separator variation.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'exact-lexical-match', shouldForwardUpstream: false }
  }),

  scenario({
    name: 'regex-run-vitest-politeness',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'please run vitest tests --pattern unit',
    testStrategy: 'Polite natural command still bypasses via regex.',
    notes: 'Regex layer handles real user phrasing.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'regex-pattern', expectedArgs: { pattern: 'unit' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-find-todo-in-src',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'find TODO in src',
    testStrategy: 'Local search intent maps to grep with pattern/path args.',
    notes: 'Canonical positive from bypass plan.',
    expected: { shouldBypass: true, expectedTool: 'grep', expectedReason: 'regex-pattern', expectedArgs: { pattern: 'TODO', path: 'src' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-read-package-json',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'read package json',
    testStrategy: 'Package-json phrase resolves to package.json path.',
    notes: 'Common shorthand should not hit LLM.',
    expected: { shouldBypass: true, expectedTool: 'read_file', expectedReason: 'regex-pattern', expectedArgs: { path: 'package.json' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-open-url-fetch',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'open https://example.com',
    testStrategy: 'Open URL selects fetch rather than read_file.',
    notes: 'Canonical URL positive from bypass plan.',
    expected: { shouldBypass: true, expectedTool: 'fetch', expectedReason: 'regex-pattern', expectedArgs: { url: 'https://example.com' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-list-files-path',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'list files in src/components',
    testStrategy: 'Directory phrase captured as path.',
    notes: 'Covers nested path target.',
    expected: { shouldBypass: true, expectedTool: 'list_files', expectedReason: 'regex-pattern', expectedArgs: { path: 'src/components' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-search-web',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'search web for openai docs',
    testStrategy: 'Public-web phrase selects web_search over grep.',
    notes: 'Avoids overlapping search tools.',
    expected: { shouldBypass: true, expectedTool: 'web_search', expectedReason: 'regex-pattern', expectedArgs: { query: 'openai docs' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-send-email',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'send email to ada@example.com subject="hi"',
    testStrategy: 'Email command captures recipient and subject.',
    notes: 'Covers non-file, non-search tool.',
    expected: { shouldBypass: true, expectedTool: 'send_email', expectedReason: 'regex-pattern', expectedArgs: { to: 'ada@example.com', subject: 'hi' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-create-file-content',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'create file docs/notes.md with content "hello"',
    testStrategy: 'Create-file command captures path and quoted content.',
    notes: 'Write-like bypass requires concrete file signal.',
    expected: { shouldBypass: true, expectedTool: 'create_file', expectedReason: 'regex-pattern', expectedArgs: { path: 'docs/notes.md', content: 'hello' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-delete-file-path',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'delete file tmp/cache.json',
    testStrategy: 'Delete-file command selects delete_file only with file target.',
    notes: 'Destructive but explicit path still selects when tool not denied.',
    expected: { shouldBypass: true, expectedTool: 'delete_file', expectedReason: 'regex-pattern', expectedArgs: { path: 'tmp/cache.json' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-fetch-trailing-punctuation',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'fetch https://example.com/docs.',
    testStrategy: 'Trailing punctuation trimmed from URL.',
    notes: 'Real prose often ends commands with period.',
    expected: { shouldBypass: true, expectedTool: 'fetch', expectedReason: 'regex-pattern', expectedArgs: { url: 'https://example.com/docs' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-grep-quoted-pattern',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'grep "TODO item" in packages/core',
    testStrategy: 'Quoted search term remains one pattern.',
    notes: 'Covers quoted argument capture.',
    expected: { shouldBypass: true, expectedTool: 'grep', expectedReason: 'regex-pattern', expectedArgs: { pattern: 'TODO item', path: 'packages/core' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'regex-read-file-windows-path',
    category: 'regex-pattern',
    level: 'regex-patterns',
    input: 'read file src\\app.ts',
    testStrategy: 'Windows path syntax survives capture.',
    notes: 'Important for local Windows workspace users.',
    expected: { shouldBypass: true, expectedTool: 'read_file', expectedReason: 'regex-pattern', expectedArgs: { path: 'src\\app.ts' }, shouldForwardUpstream: false }
  }),

  scenario({
    name: 'similarity-runn-tests',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'runn tests --pattern fuzzy',
    testStrategy: 'Typo in verb still selects run_tests at lexical-similarity level.',
    notes: 'Covers non-embedding lexical fuzzy path.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'lexical-similarity', expectedArgs: { pattern: 'fuzzy' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'similarity-fnd-todo',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'fnd TODO in src',
    testStrategy: 'Dropped vowel still maps to local grep.',
    notes: 'Typo recall without wrong web search.',
    expected: { shouldBypass: true, expectedTool: 'grep', expectedReason: 'lexical-similarity', expectedArgs: { pattern: 'TODO', path: 'src' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'similarity-serch-files',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'serch files TODO',
    testStrategy: 'Misspelled search plus files signal selects grep.',
    notes: 'Covers local search recall.',
    expected: { shouldBypass: true, expectedTool: 'grep', expectedReason: 'lexical-similarity', expectedArgs: { pattern: 'TODO' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'similarity-reed-package-json',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'reed package json',
    testStrategy: 'Misspelled read still resolves package.json.',
    notes: 'Covers common typo.',
    expected: { shouldBypass: true, expectedTool: 'read_file', expectedReason: 'lexical-similarity', expectedArgs: { path: 'package.json' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'similarity-opne-url',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'opne https://example.com',
    testStrategy: 'Transposed open maps to fetch when URL present.',
    notes: 'URL signal keeps tool choice safe.',
    expected: { shouldBypass: true, expectedTool: 'fetch', expectedReason: 'lexical-similarity', expectedArgs: { url: 'https://example.com' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'similarity-lst-files',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'lst files src',
    testStrategy: 'Abbreviated list command selects list_files.',
    notes: 'Covers terse shell-like user phrasing.',
    expected: { shouldBypass: true, expectedTool: 'list_files', expectedReason: 'lexical-similarity', expectedArgs: { path: 'src' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'similarity-creat-file',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'creat file notes.md',
    testStrategy: 'Misspelled create still requires file target.',
    notes: 'Write intent plus path is concrete enough.',
    expected: { shouldBypass: true, expectedTool: 'create_file', expectedReason: 'lexical-similarity', expectedArgs: { path: 'notes.md' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'similarity-delet-file',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'delet file tmp.txt',
    testStrategy: 'Misspelled delete with explicit file target selects delete_file.',
    notes: 'Safety relies on deny/protected config, not typo.',
    expected: { shouldBypass: true, expectedTool: 'delete_file', expectedReason: 'lexical-similarity', expectedArgs: { path: 'tmp.txt' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'similarity-web-serch',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'web serch vite docs',
    testStrategy: 'Typo in public-web phrase selects web_search.',
    notes: 'Embedding optional; lexical fallback should handle it.',
    expected: { shouldBypass: true, expectedTool: 'web_search', expectedReason: 'lexical-similarity', expectedArgs: { query: 'vite docs' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'similarity-snd-email',
    category: 'lexical-similarity',
    level: 'lexical-similarity',
    input: 'snd email ada@example.com',
    testStrategy: 'Abbreviated send still captures email recipient.',
    notes: 'Covers fuzzy non-shell tool.',
    expected: { shouldBypass: true, expectedTool: 'send_email', expectedReason: 'lexical-similarity', expectedArgs: { to: 'ada@example.com' }, shouldForwardUpstream: false }
  }),

  scenario({
    name: 'embedding-outranks-overlapping-search',
    category: 'embedding',
    level: 'lexical-similarity',
    input: 'search project files for ada@example.com',
    localEmbedding: true,
    testStrategy: 'Available local embedding can pick unique non-lexical winner before regex fallback.',
    notes: 'Mock embedding should select send_email over grep in this adversarial overlap.',
    expected: { shouldBypass: true, expectedTool: 'send_email', expectedReason: 'embedding', expectedArgs: { to: 'ada@example.com' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'embedding-semantic-read-config',
    category: 'embedding',
    level: 'lexical-similarity',
    input: 'inspect workspace manifest',
    localEmbedding: true,
    testStrategy: 'Semantic embedding alias can select read_file when exact alias absent.',
    notes: 'Local model preferred when available and unique.',
    expected: { shouldBypass: true, expectedTool: 'read_file', expectedReason: 'embedding', expectedArgs: { path: 'package.json' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'embedding-semantic-directory',
    category: 'embedding',
    level: 'lexical-similarity',
    input: 'show me project tree',
    localEmbedding: true,
    testStrategy: 'Semantic embedding maps tree wording to list_files.',
    notes: 'Covers local embedding recall beyond regex fragments.',
    expected: { shouldBypass: true, expectedTool: 'list_files', expectedReason: 'embedding', expectedArgs: { path: '.' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'embedding-unavailable-fallback-open',
    category: 'embedding',
    level: 'lexical-similarity',
    input: 'search project',
    availableTools: ['grep', 'web_search'],
    testStrategy: 'Unavailable embedding cannot turn ambiguous search into unsafe bypass.',
    notes: 'Safety result unchanged when local embedding is offline.',
    expected: { shouldBypass: false, expectedMissReason: 'ambiguous', shouldForwardUpstream: true }
  }),

  scenario({
    name: 'args-json-tail',
    category: 'arguments',
    level: 'slash-commands',
    input: '/run_tests {"pattern":"models","suite":"unit"}',
    testStrategy: 'JSON tail beats defaults and preserves object values.',
    notes: 'Covers explicit JSON args in AgentV output.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'slash-command', expectedArgs: { pattern: 'models', suite: 'unit' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'args-cli-flag-boolean',
    category: 'arguments',
    level: 'slash-commands',
    input: '/run_tests --watch',
    testStrategy: 'Flag without value becomes string true for schema arg checking.',
    notes: 'Keeps CLI-like bool flag deterministic.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'slash-command', expectedArgs: { watch: 'true' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'args-key-value-dot-normalization',
    category: 'arguments',
    level: 'regex-patterns',
    input: 'run tests pattern=unit suite.name=browser',
    testStrategy: 'Key-value args normalize dotted key names.',
    notes: 'Covers CLI-like arg parser normalization.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'regex-pattern', expectedArgs: { pattern: 'unit', suite_name: 'browser' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'args-path-like-text',
    category: 'arguments',
    level: 'regex-patterns',
    input: 'open file packages/core/src/index.ts',
    testStrategy: 'Path-like text captured as path argument.',
    notes: 'Important for natural file reads.',
    expected: { shouldBypass: true, expectedTool: 'read_file', expectedReason: 'regex-pattern', expectedArgs: { path: 'packages/core/src/index.ts' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'args-url-like-text',
    category: 'arguments',
    level: 'regex-patterns',
    input: 'read url https://docs.example.com/api?x=1',
    testStrategy: 'URL including querystring captured as url argument.',
    notes: 'Covers URL-like argument capture.',
    expected: { shouldBypass: true, expectedTool: 'fetch', expectedReason: 'regex-pattern', expectedArgs: { url: 'https://docs.example.com/api?x=1' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'args-quoted-email-body',
    category: 'arguments',
    level: 'regex-patterns',
    input: 'email ada@example.com subject="Build" body="green"',
    testStrategy: 'Multiple quoted email fields survive parse.',
    notes: 'Covers structured non-file args.',
    expected: { shouldBypass: true, expectedTool: 'send_email', expectedReason: 'regex-pattern', expectedArgs: { to: 'ada@example.com', subject: 'Build', body: 'green' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'args-default-run-suite',
    category: 'arguments',
    level: 'exact-lexical-match',
    input: 'run tests --pattern router',
    testStrategy: 'Schema default suite fills when omitted.',
    notes: 'Defaults must be visible to AgentV grader.',
    expected: { shouldBypass: true, expectedTool: 'run_tests', expectedReason: 'exact-lexical-match', expectedArgs: { pattern: 'router', suite: 'unit' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'args-registry-default-path',
    category: 'arguments',
    level: 'exact-lexical-match',
    input: 'inspect file',
    testStrategy: 'Registry alias can supply default path.',
    notes: 'Covers config-provided aliases/default_args.',
    expected: { shouldBypass: true, expectedTool: 'read_file', expectedReason: 'exact-lexical-match', expectedArgs: { path: 'README.md' }, shouldForwardUpstream: false }
  }),

  scenario({
    name: 'local-exec-chat-slash',
    category: 'local-execution',
    level: 'slash-commands',
    input: '/run_tests --pattern slash',
    testStrategy: 'UTK executes slash-matched tool locally before forwarding result to upstream.',
    notes: 'Regression guard for "UTK should do the toolcall, not the model".',
    expected: { shouldBypass: true, shouldExecute: true, expectedTool: 'run_tests', expectedReason: 'slash-command', expectedArgs: { pattern: 'slash' }, expectedOutputContains: ['passed slash'], shouldForwardUpstream: true }
  }),
  scenario({
    name: 'local-exec-chat-exact',
    category: 'local-execution',
    level: 'exact-lexical-match',
    input: 'run tests --pattern exact',
    testStrategy: 'UTK executes exact-lexical tool locally and appends tool output.',
    notes: 'Checks exact path gets same executor behavior as slash.',
    expected: { shouldBypass: true, shouldExecute: true, expectedTool: 'run_tests', expectedReason: 'exact-lexical-match', expectedArgs: { pattern: 'exact' }, expectedOutputContains: ['passed exact'], shouldForwardUpstream: true }
  }),
  scenario({
    name: 'local-exec-chat-regex',
    category: 'local-execution',
    level: 'regex-patterns',
    input: 'please run vitest tests --pattern regex',
    testStrategy: 'UTK executes regex-selected tool locally.',
    notes: 'Checks composed regex path can execute.',
    expected: { shouldBypass: true, shouldExecute: true, expectedTool: 'run_tests', expectedReason: 'regex-pattern', expectedArgs: { pattern: 'regex' }, expectedOutputContains: ['passed regex'], shouldForwardUpstream: true }
  }),
  scenario({
    name: 'local-exec-chat-similarity',
    category: 'local-execution',
    level: 'lexical-similarity',
    input: 'runn tests --pattern fuzzy',
    testStrategy: 'UTK executes lexical-similarity selected tool locally.',
    notes: 'Completes matching-level execution matrix.',
    expected: { shouldBypass: true, shouldExecute: true, expectedTool: 'run_tests', expectedReason: 'lexical-similarity', expectedArgs: { pattern: 'fuzzy' }, expectedOutputContains: ['passed fuzzy'], shouldForwardUpstream: true }
  }),
  scenario({
    name: 'local-exec-responses-slash',
    category: 'local-execution',
    level: 'slash-commands',
    route: '/v1/responses',
    input: '/run_tests --pattern smoke',
    testStrategy: 'Responses API uses function_call plus function_call_output before upstream.',
    notes: 'Covers Responses output item shape.',
    expected: { shouldBypass: true, shouldExecute: true, expectedTool: 'run_tests', expectedReason: 'slash-command', expectedArgs: { pattern: 'smoke' }, expectedOutputContains: ['executed run_tests smoke'], shouldForwardUpstream: true }
  }),
  scenario({
    name: 'local-exec-mediated-artifact',
    category: 'local-execution',
    level: 'slash-commands',
    input: '/grep --pattern TODO --path src',
    testStrategy: 'Mediated local tool result keeps artifact handle in output.',
    notes: 'Ensures local execution still benefits from UTK result mediation.',
    expected: { shouldBypass: true, shouldExecute: true, expectedTool: 'grep', expectedReason: 'slash-command', expectedArgs: { pattern: 'TODO', path: 'src' }, expectedOutputContains: ['Tool result stored at:', 'Compact artifact:'], shouldForwardUpstream: true }
  }),
  scenario({
    name: 'local-exec-no-upstream-synthetic',
    category: 'api-shape',
    level: 'slash-commands',
    input: '/read_file package.json',
    testStrategy: 'When no executor is configured, proxy returns synthetic tool call without upstream request.',
    notes: 'Separate behavior from local execution path.',
    expected: { shouldBypass: true, shouldExecute: false, expectedTool: 'read_file', expectedReason: 'slash-command', expectedArgs: { path: 'package.json' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'api-shape-chat-tool-call',
    category: 'api-shape',
    level: 'slash-commands',
    input: '/fetch https://example.com',
    testStrategy: 'Chat Completions synthetic bypass returns assistant tool_calls shape.',
    notes: 'AgentV grader parses OpenAI chat completion JSON directly.',
    expected: { shouldBypass: true, shouldExecute: false, expectedTool: 'fetch', expectedReason: 'slash-command', expectedArgs: { url: 'https://example.com' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'api-shape-responses-function-call',
    category: 'api-shape',
    level: 'slash-commands',
    route: '/v1/responses',
    input: '/run_tests --pattern unit',
    testStrategy: 'Responses synthetic bypass returns function_call output item shape.',
    notes: 'AgentV grader parses Responses JSON directly.',
    expected: { shouldBypass: true, shouldExecute: false, expectedTool: 'run_tests', expectedReason: 'slash-command', expectedArgs: { pattern: 'unit' }, shouldForwardUpstream: false }
  }),

  scenario({
    name: 'protected-edit-natural-fails-open',
    category: 'protected',
    level: 'regex-patterns',
    input: 'edit file package.json',
    protectedTools: ['edit_file'],
    testStrategy: 'Protected edit tool cannot bypass from natural regex alone.',
    notes: 'Prevents silent edit execution.',
    expected: { shouldBypass: false, expectedMissReason: 'protected-tool', shouldForwardUpstream: true }
  }),
  scenario({
    name: 'protected-edit-slash-allowed',
    category: 'protected',
    level: 'slash-commands',
    input: '/edit_file --path package.json --old_string old --new_string new',
    protectedTools: ['edit_file'],
    testStrategy: 'Protected tool can bypass with explicit slash command.',
    notes: 'Slash intent is explicit enough for protected tools.',
    expected: { shouldBypass: true, expectedTool: 'edit_file', expectedReason: 'slash-command', expectedArgs: { path: 'package.json', old_string: 'old', new_string: 'new' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'protected-edit-configured-regex',
    category: 'protected',
    level: 'regex-patterns',
    input: 'safely edit package.json from old to new',
    protectedTools: ['edit_file'],
    configuredRegex: true,
    testStrategy: 'Configured protected regex with bypass_on_match can bypass.',
    notes: 'Config must opt in explicitly.',
    expected: { shouldBypass: true, expectedTool: 'edit_file', expectedReason: 'regex-pattern', expectedArgs: { path: 'package.json', old_string: 'old', new_string: 'new' }, shouldForwardUpstream: false }
  }),
  scenario({
    name: 'denied-delete-slash-blocked',
    category: 'denied',
    level: 'slash-commands',
    input: '/delete_file --path tmp.txt',
    deniedTools: ['delete_file'],
    testStrategy: 'Denied tool cannot bypass even with explicit slash.',
    notes: 'Denied list dominates all match levels.',
    expected: { shouldBypass: false, expectedMissReason: 'denied-tool', shouldForwardUpstream: true }
  }),
  scenario({
    name: 'denied-delete-regex-blocked',
    category: 'denied',
    level: 'regex-patterns',
    input: 'delete file tmp.txt',
    deniedTools: ['delete_file'],
    testStrategy: 'Denied tool blocks regex-selected destructive intent.',
    notes: 'Rejects natural command when policy denies tool.',
    expected: { shouldBypass: false, expectedMissReason: 'denied-tool', shouldForwardUpstream: true }
  }),
  scenario({
    name: 'ambiguous-search-project',
    category: 'ambiguous',
    level: 'regex-patterns',
    input: 'search project',
    availableTools: ['grep', 'web_search'],
    testStrategy: 'Ambiguous overlap between grep and web_search fails open.',
    notes: 'Canonical negative from bypass plan.',
    expected: { shouldBypass: false, expectedMissReason: 'ambiguous', shouldForwardUpstream: true }
  }),
  scenario({
    name: 'ambiguous-search-project-with-extra-tool-order',
    category: 'ambiguous',
    level: 'lexical-similarity',
    input: 'ambiguous search project',
    availableTools: ['web_search', 'grep', 'list_files'],
    testStrategy: 'Candidate order change must not pick a winner under tie.',
    notes: 'Fail-open invariant for overlapping search tools.',
    expected: { shouldBypass: false, expectedMissReason: 'ambiguous', shouldForwardUpstream: true }
  }),
  scenario({
    name: 'negative-do-not-run-tests',
    category: 'safety-negative',
    level: 'lexical-similarity',
    input: 'do not run tests',
    testStrategy: 'Negation prevents bypass despite strong run_tests phrase.',
    notes: 'Canonical negative from bypass plan.',
    expected: { shouldBypass: false, expectedMissReason: 'negated', shouldForwardUpstream: true }
  }),
  scenario({
    name: 'negative-explain-edit-files',
    category: 'safety-negative',
    level: 'regex-patterns',
    input: 'explain how to edit files',
    testStrategy: 'Explanatory phrasing does not invoke edit_file.',
    notes: 'Canonical negative from bypass plan.',
    expected: { shouldBypass: false, expectedMissReason: 'explanatory', shouldForwardUpstream: true }
  }),
  scenario({
    name: 'negative-delete-metaphor',
    category: 'safety-negative',
    level: 'lexical-similarity',
    input: 'delete fear from the roadmap',
    testStrategy: 'Metaphorical delete without file target does not call delete_file.',
    notes: 'Prevents literal overmatch on destructive verbs.',
    expected: { shouldBypass: false, expectedMissReason: 'no-match', shouldForwardUpstream: true }
  }),
  scenario({
    name: 'negative-create-strategy',
    category: 'safety-negative',
    level: 'lexical-similarity',
    input: 'create a strategy, not a file',
    testStrategy: 'Create wording without file target does not call create_file.',
    notes: 'Avoids writing files from planning prose.',
    expected: { shouldBypass: false, expectedMissReason: 'explanatory', shouldForwardUpstream: true }
  })
];

type MatrixContext = {
  index: number;
  run: string;
  grep: string;
  path: string;
  file: string;
  url: string;
  email: string;
};

type GeneratedMissReason = NonNullable<ToolCallingBypassExpected['expectedMissReason']>;

type GeneratedPositiveSpec = {
  slug: string;
  category: ToolCallingBypassCategory;
  level: ToolCallingBypassLevel;
  reason: ToolCallingBypassReason;
  tool: string;
  input: (context: MatrixContext) => string;
  args?: (context: MatrixContext) => Record<string, unknown>;
  route?: ToolCallingBypassRoute;
  localEmbedding?: boolean;
  shouldExecute?: boolean;
  outputContains?: (context: MatrixContext) => string[];
  protectedTools?: string[];
  configuredRegex?: boolean;
};

type GeneratedPositiveOptions = Pick<GeneratedPositiveSpec, 'route' | 'localEmbedding' | 'shouldExecute' | 'outputContains' | 'protectedTools' | 'configuredRegex'>;

type GeneratedNegativeSpec = {
  slug: string;
  category: ToolCallingBypassCategory;
  level: ToolCallingBypassLevel | ((context: MatrixContext) => ToolCallingBypassLevel);
  input: (context: MatrixContext) => string;
  missReason: GeneratedMissReason | ((context: MatrixContext) => GeneratedMissReason);
  availableTools?: (context: MatrixContext) => string[];
  protectedTools?: string[];
  deniedTools?: string[];
};

type GeneratedNegativeOptions = Pick<GeneratedNegativeSpec, 'availableTools' | 'protectedTools' | 'deniedTools'>;

const MATRIX_VALUES = {
  grep: ['TODO', 'FIXME', 'ToolInvocationMatch', 'utk-ref'],
  path: ['src', 'packages/core', 'docs', 'test'],
  file: ['package.json', 'src/app.ts', 'docs/evals.md', 'packages/core/src/index.ts'],
  url: ['https://example.com', 'https://docs.example.com/api', 'https://agentv.dev/docs', 'https://openai.com/news'],
  email: ['ada@example.com', 'lin@example.com', 'grace@example.com', 'morgan@example.com']
} satisfies Record<string, readonly string[]>;

const MATRIX_CONTEXTS: MatrixContext[] = ['unit', 'smoke', 'router', 'auth'].map((run, index) => ({
  index,
  run,
  grep: matrixValue(MATRIX_VALUES.grep, index, 'grep'),
  path: matrixValue(MATRIX_VALUES.path, index, 'path'),
  file: matrixValue(MATRIX_VALUES.file, index, 'file'),
  url: matrixValue(MATRIX_VALUES.url, index, 'url'),
  email: matrixValue(MATRIX_VALUES.email, index, 'email')
}));

const generatedStrategy = {
  'slash-command': ['Generated slash command variant.', 'Matrix expands explicit slash command coverage.'],
  'exact-lexical-match': ['Generated exact lexical alias plus argument-tail variant.', 'Matrix expands exact lexical matching coverage.'],
  'regex-pattern': ['Generated composed regex command variant.', 'Matrix expands natural command regex coverage.'],
  'lexical-similarity': ['Generated typo and abbreviated lexical-similarity variant.', 'Matrix expands fuzzy lexical recall coverage.'],
  embedding: ['Generated local embedding semantic winner variant.', 'Matrix expands embedding-preferred bypass coverage.'],
  arguments: ['Generated argument parser variant.', 'Matrix expands JSON, flag, key-value, quoted, URL, path, and email arg coverage.'],
  'local-execution': ['Generated local execution variant.', 'Matrix expands UTK-executes-tool-before-model behavior.'],
  'api-shape': ['Generated synthetic OpenAI API shape variant.', 'Matrix expands no-executor synthetic output coverage.'],
  protected: ['Generated protected-tool policy variant.', 'Matrix expands protected-tool safety coverage.'],
  denied: ['Generated denied-tool policy variant.', 'Matrix expands deny-list dominance coverage.'],
  ambiguous: ['Generated ambiguous search fail-open variant.', 'Matrix expands overlap tie safety coverage.'],
  'safety-negative': ['Generated safety-negative fail-open variant.', 'Matrix expands negation, explanation, and metaphor safety coverage.']
} satisfies Record<ToolCallingBypassCategory, [string, string]>;

function buildGeneratedToolCallingBypassFixtures(targetCount: number): ToolCallingBypassFixture[] {
  const fixtures = [
    ...expandPositive('matrix-slash', MATRIX_CONTEXTS, [
      pos('run-tests', 'slash-command', 'slash-commands', 'slash-command', 'run_tests', (c) => `/run_tests --pattern ${c.run}`, (c) => ({ pattern: c.run })),
      pos('grep', 'slash-command', 'slash-commands', 'slash-command', 'grep', (c) => `/grep --pattern ${c.grep} --path ${c.path}`, (c) => ({ pattern: c.grep, path: c.path })),
      pos('read-file', 'slash-command', 'slash-commands', 'slash-command', 'read_file', (c) => `/read_file --path ${c.file}`, (c) => ({ path: c.file })),
      pos('fetch', 'slash-command', 'slash-commands', 'slash-command', 'fetch', (c) => `/fetch ${c.url}`, (c) => ({ url: c.url })),
      pos('list-files', 'slash-command', 'slash-commands', 'slash-command', 'list_files', (c) => `/list_files --path ${c.path}`, (c) => ({ path: c.path })),
      pos('create-file', 'slash-command', 'slash-commands', 'slash-command', 'create_file', (c) => `/create_file --path docs/generated-${c.index}.md --content "case ${c.index}"`, (c) => ({ path: `docs/generated-${c.index}.md`, content: `case ${c.index}` })),
      pos('send-email', 'slash-command', 'slash-commands', 'slash-command', 'send_email', (c) => `/send_email to=${c.email} subject="case ${c.index}"`, (c) => ({ to: c.email, subject: `case ${c.index}` }))
    ]),
    ...expandPositive('matrix-exact', MATRIX_CONTEXTS, [
      pos('run-tests', 'exact-lexical-match', 'exact-lexical-match', 'exact-lexical-match', 'run_tests', (c) => `run tests --pattern ${c.run}`, (c) => ({ pattern: c.run })),
      pos('read-file', 'exact-lexical-match', 'exact-lexical-match', 'exact-lexical-match', 'read_file', (c) => `read file ${c.file}`, (c) => ({ path: c.file })),
      pos('list-files', 'exact-lexical-match', 'exact-lexical-match', 'exact-lexical-match', 'list_files', (c) => `list files --path ${c.path}`, (c) => ({ path: c.path })),
      pos('fetch', 'exact-lexical-match', 'exact-lexical-match', 'exact-lexical-match', 'fetch', (c) => `fetch url ${c.url}`, (c) => ({ url: c.url })),
      pos('web-search', 'exact-lexical-match', 'exact-lexical-match', 'exact-lexical-match', 'web_search', (c) => `web search ${c.run} docs`, (c) => ({ query: `${c.run} docs` })),
      pos('send-email', 'exact-lexical-match', 'exact-lexical-match', 'exact-lexical-match', 'send_email', (c) => `send email to ${c.email}`, (c) => ({ to: c.email }))
    ]),
    ...expandPositive('matrix-regex', MATRIX_CONTEXTS, [
      pos('run-vitest', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'run_tests', (c) => `please run vitest tests --pattern ${c.run}`, (c) => ({ pattern: c.run })),
      pos('run-jest', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'run_tests', (c) => `execute jest tests pattern=${c.run}`, (c) => ({ pattern: c.run })),
      pos('find-in-path', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'grep', (c) => `find ${c.grep} in ${c.path}`, (c) => ({ pattern: c.grep, path: c.path })),
      pos('look-under-path', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'grep', (c) => `look for "${c.grep}" under ${c.path}`, (c) => ({ pattern: c.grep, path: c.path })),
      pos('read-file', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'read_file', (c) => `read file ${c.file}`, (c) => ({ path: c.file })),
      pos('open-file', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'read_file', (c) => `open file ${c.file}`, (c) => ({ path: c.file })),
      pos('open-url', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'fetch', (c) => `open ${c.url}`, (c) => ({ url: c.url })),
      pos('get-url', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'fetch', (c) => `get ${c.url}`, (c) => ({ url: c.url })),
      pos('list-files', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'list_files', (c) => `list files in ${c.path}`, (c) => ({ path: c.path })),
      pos('search-web', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'web_search', (c) => `search web for ${c.run} release notes`, (c) => ({ query: `${c.run} release notes` })),
      pos('email', 'regex-pattern', 'regex-patterns', 'regex-pattern', 'send_email', (c) => `email ${c.email} subject="case ${c.index}"`, (c) => ({ to: c.email, subject: `case ${c.index}` }))
    ]),
    ...expandPositive('matrix-similarity', MATRIX_CONTEXTS, [
      pos('runn-tests', 'lexical-similarity', 'lexical-similarity', 'lexical-similarity', 'run_tests', (c) => `runn tests --pattern ${c.run}`, (c) => ({ pattern: c.run })),
      pos('fnd-grep', 'lexical-similarity', 'lexical-similarity', 'lexical-similarity', 'grep', (c) => `fnd ${c.grep} in ${c.path}`, (c) => ({ pattern: c.grep, path: c.path })),
      pos('serch-files', 'lexical-similarity', 'lexical-similarity', 'lexical-similarity', 'grep', (c) => `serch files ${c.grep}`, (c) => ({ pattern: c.grep })),
      pos('reed-file', 'lexical-similarity', 'lexical-similarity', 'lexical-similarity', 'read_file', (c) => `reed ${c.file}`, (c) => ({ path: c.file })),
      pos('opne-url', 'lexical-similarity', 'lexical-similarity', 'lexical-similarity', 'fetch', (c) => `opne ${c.url}`, (c) => ({ url: c.url })),
      pos('lst-files', 'lexical-similarity', 'lexical-similarity', 'lexical-similarity', 'list_files', (c) => `lst files ${c.path}`, (c) => ({ path: c.path })),
      pos('snd-email', 'lexical-similarity', 'lexical-similarity', 'lexical-similarity', 'send_email', (c) => `snd email ${c.email}`, (c) => ({ to: c.email }))
    ]),
    ...expandPositive('matrix-embedding', MATRIX_CONTEXTS, [
      pos('manifest', 'embedding', 'lexical-similarity', 'embedding', 'read_file', (c) => `inspect workspace manifest ${c.index}`, () => ({ path: 'package.json' }), { localEmbedding: true }),
      pos('tree', 'embedding', 'lexical-similarity', 'embedding', 'list_files', (c) => `show project tree ${c.index}`, () => ({ path: '.' }), { localEmbedding: true }),
      pos('contact', 'embedding', 'lexical-similarity', 'embedding', 'send_email', (c) => `contact ${c.email} about bypass ${c.index}`, (c) => ({ to: c.email }), { localEmbedding: true }),
      pos('retrieve-page', 'embedding', 'lexical-similarity', 'embedding', 'fetch', (c) => `retrieve current docs page ${c.index}`, (c) => ({ url: c.url }), { localEmbedding: true })
    ]),
    ...expandPositive('matrix-args', MATRIX_CONTEXTS, [
      pos('json-run', 'arguments', 'slash-commands', 'slash-command', 'run_tests', (c) => `/run_tests {"pattern":"${c.run}","suite":"generated"}`, (c) => ({ pattern: c.run, suite: 'generated' })),
      pos('quoted-grep', 'arguments', 'slash-commands', 'slash-command', 'grep', (c) => `/grep --pattern "${c.grep} item" --path ${c.path}`, (c) => ({ pattern: `${c.grep} item`, path: c.path })),
      pos('key-value', 'arguments', 'regex-patterns', 'regex-pattern', 'run_tests', (c) => `run tests pattern=${c.run} suite.name=generated${c.index}`, (c) => ({ pattern: c.run, suite_name: `generated${c.index}` })),
      pos('content-file', 'arguments', 'regex-patterns', 'regex-pattern', 'create_file', (c) => `create file docs/arg-${c.index}.md with content "content ${c.index}"`, (c) => ({ path: `docs/arg-${c.index}.md`, content: `content ${c.index}` })),
      pos('url-query', 'arguments', 'regex-patterns', 'regex-pattern', 'fetch', (c) => `read url ${c.url}?case=${c.index}`, (c) => ({ url: `${c.url}?case=${c.index}` })),
      pos('email-body', 'arguments', 'regex-patterns', 'regex-pattern', 'send_email', (c) => `email ${c.email} subject="Args ${c.index}" body="green ${c.index}"`, (c) => ({ to: c.email, subject: `Args ${c.index}`, body: `green ${c.index}` })),
      pos('read-file', 'arguments', 'exact-lexical-match', 'exact-lexical-match', 'read_file', (c) => `read file ${c.file}`, (c) => ({ path: c.file }))
    ]),
    ...expandPositive('matrix-local-exec', MATRIX_CONTEXTS.slice(0, 3), [
      pos('slash-run', 'local-execution', 'slash-commands', 'slash-command', 'run_tests', (c) => `/run_tests --pattern exec${c.index}`, (c) => ({ pattern: `exec${c.index}` }), { shouldExecute: true, outputContains: (c) => [`passed exec${c.index}`] }),
      pos('exact-run', 'local-execution', 'exact-lexical-match', 'exact-lexical-match', 'run_tests', (c) => `run tests --pattern exactexec${c.index}`, (c) => ({ pattern: `exactexec${c.index}` }), { shouldExecute: true, outputContains: (c) => [`passed exactexec${c.index}`] }),
      pos('regex-run', 'local-execution', 'regex-patterns', 'regex-pattern', 'run_tests', (c) => `please run vitest tests --pattern regexexec${c.index}`, (c) => ({ pattern: `regexexec${c.index}` }), { shouldExecute: true, outputContains: (c) => [`passed regexexec${c.index}`] }),
      pos('fuzzy-run', 'local-execution', 'lexical-similarity', 'lexical-similarity', 'run_tests', (c) => `runn tests --pattern fuzzyexec${c.index}`, (c) => ({ pattern: `fuzzyexec${c.index}` }), { shouldExecute: true, outputContains: (c) => [`passed fuzzyexec${c.index}`] }),
      pos('responses-run', 'local-execution', 'slash-commands', 'slash-command', 'run_tests', (c) => `/run_tests --pattern responseexec${c.index}`, (c) => ({ pattern: `responseexec${c.index}` }), { route: '/v1/responses', shouldExecute: true, outputContains: (c) => [`executed run_tests responseexec${c.index}`] }),
      pos('mediated-grep', 'local-execution', 'slash-commands', 'slash-command', 'grep', (c) => `/grep --pattern EXEC${c.index} --path src`, (c) => ({ pattern: `EXEC${c.index}`, path: 'src' }), { shouldExecute: true, outputContains: () => ['Tool result stored at:'] })
    ]),
    ...expandPositive('matrix-api-chat', cycleContexts(5), [
      pos('tool-call', 'api-shape', 'slash-commands', 'slash-command', 'fetch', (c) => `/fetch ${c.url}`, (c) => ({ url: c.url }))
    ]),
    ...expandPositive('matrix-api-responses', cycleContexts(5), [
      pos('function-call', 'api-shape', 'slash-commands', 'slash-command', 'run_tests', (c) => `/run_tests --pattern api${c.index}`, (c) => ({ pattern: `api${c.index}` }), { route: '/v1/responses' })
    ]),
    ...expandNegative('matrix-protected-natural', MATRIX_CONTEXTS, [
      neg('edit', 'protected', 'regex-patterns', (c) => `edit file ${c.file}`, 'protected-tool', { protectedTools: ['edit_file'] })
    ]),
    ...expandPositive('matrix-protected-configured', MATRIX_CONTEXTS, [
      pos('edit', 'protected', 'regex-patterns', 'regex-pattern', 'edit_file', (c) => `safely edit ${c.file} from old${c.index} to new${c.index}`, (c) => ({ path: c.file, old_string: `old${c.index}`, new_string: `new${c.index}` }), { protectedTools: ['edit_file'], configuredRegex: true })
    ]),
    ...expandNegative('matrix-denied', MATRIX_CONTEXTS.slice(0, 3), [
      neg('slash-delete', 'denied', 'slash-commands', (c) => `/delete_file --path tmp/denied-${c.index}.txt`, 'denied-tool', { deniedTools: ['delete_file'] }),
      neg('regex-delete', 'denied', 'regex-patterns', (c) => `delete file tmp/denied-${c.index}.txt`, 'denied-tool', { deniedTools: ['delete_file'] })
    ]),
    ...expandNegative('matrix-ambiguous', ambiguousContexts(), [
      neg('search', 'ambiguous', (c) => c.index % 2 === 0 ? 'regex-patterns' : 'lexical-similarity', (c) => c.path, 'ambiguous', { availableTools: (c) => c.index % 2 === 0 ? ['grep', 'web_search'] : ['web_search', 'grep', 'list_files'] })
    ]),
    ...expandNegative('matrix-safety', safetyContexts(), [
      neg('negative', 'safety-negative', (c) => c.index % 3 === 2 ? 'regex-patterns' : 'lexical-similarity', (c) => c.path, (c) => generatedMissReason(c.grep))
    ])
  ];

  if (fixtures.length !== targetCount) {
    throw new Error(`Expected ${targetCount} generated tool-calling bypass fixtures, got ${fixtures.length}`);
  }
  return fixtures;
}

function pos(
  slug: string,
  category: ToolCallingBypassCategory,
  level: ToolCallingBypassLevel,
  reason: ToolCallingBypassReason,
  tool: string,
  input: (context: MatrixContext) => string,
  args?: (context: MatrixContext) => Record<string, unknown>,
  options: GeneratedPositiveOptions = {}
): GeneratedPositiveSpec {
  return { slug, category, level, reason, tool, input, args, ...options };
}

function neg(
  slug: string,
  category: ToolCallingBypassCategory,
  level: GeneratedNegativeSpec['level'],
  input: (context: MatrixContext) => string,
  missReason: GeneratedMissReason | ((context: MatrixContext) => GeneratedMissReason),
  options: GeneratedNegativeOptions = {}
): GeneratedNegativeSpec {
  return { slug, category, level, input, missReason, ...options };
}

function expandPositive(prefix: string, contexts: MatrixContext[], specs: GeneratedPositiveSpec[]): ToolCallingBypassFixture[] {
  return specs.flatMap((spec) => contexts.map((context) => positiveFixture(prefix, spec, context)));
}

function expandNegative(prefix: string, contexts: MatrixContext[], specs: GeneratedNegativeSpec[]): ToolCallingBypassFixture[] {
  return specs.flatMap((spec) => contexts.map((context) => negativeFixture(prefix, spec, context)));
}

function positiveFixture(prefix: string, spec: GeneratedPositiveSpec, context: MatrixContext): ToolCallingBypassFixture {
  const [testStrategy, notes] = generatedStrategy[spec.category];
  return scenario({
    name: `${prefix}-${spec.slug}-${context.index}`,
    category: spec.category,
    level: spec.level,
    route: spec.route,
    input: spec.input(context),
    localEmbedding: spec.localEmbedding,
    protectedTools: spec.protectedTools,
    configuredRegex: spec.configuredRegex,
    testStrategy,
    notes,
    expected: {
      shouldBypass: true,
      shouldExecute: spec.shouldExecute,
      shouldForwardUpstream: spec.shouldExecute === true,
      expectedTool: spec.tool,
      expectedReason: spec.reason,
      expectedArgs: spec.args?.(context) ?? {},
      expectedOutputContains: spec.outputContains?.(context)
    }
  });
}

function negativeFixture(prefix: string, spec: GeneratedNegativeSpec, context: MatrixContext): ToolCallingBypassFixture {
  const [testStrategy, notes] = generatedStrategy[spec.category];
  const missReason = typeof spec.missReason === 'function' ? spec.missReason(context) : spec.missReason;
  return scenario({
    name: `${prefix}-${spec.slug}-${context.index}`,
    category: spec.category,
    level: typeof spec.level === 'function' ? spec.level(context) : spec.level,
    input: spec.input(context),
    availableTools: spec.availableTools?.(context),
    protectedTools: spec.protectedTools,
    deniedTools: spec.deniedTools,
    testStrategy,
    notes,
    expected: { shouldBypass: false, expectedMissReason: missReason, shouldForwardUpstream: true }
  });
}

function ambiguousContexts(): MatrixContext[] {
  return ['search project', 'ambiguous search project', 'search project files or web', 'search repo online', 'find project', 'search code docs']
    .map((input, index) => ({ ...matrixContext(index), index, path: input }));
}

function cycleContexts(count: number): MatrixContext[] {
  return Array.from({ length: count }, (_, index) => ({ ...matrixContext(index), index }));
}

function safetyContexts(): MatrixContext[] {
  const contexts: Array<[string, GeneratedMissReason]> = [
    ['do not run tests now', 'negated'],
    ['never delete file tmp.txt', 'negated'],
    ['how to run tests in vitest', 'explanatory'],
    ['explain what web search does', 'explanatory'],
    ['delete fear from roadmap', 'no-match'],
    ['create momentum for launch', 'no-match']
  ];
  return contexts.map(([input, missReason], index) => ({ ...matrixContext(index), index, path: input, grep: missReason }));
}

function matrixContext(index: number): MatrixContext {
  return matrixValue(MATRIX_CONTEXTS, index, 'context');
}

function matrixValue<T>(values: readonly T[], index: number, name: string): T {
  const value = values[index % values.length];
  if (value === undefined) throw new Error(`Missing matrix ${name} value at index ${index}`);
  return value;
}

function generatedMissReason(value: string): GeneratedMissReason {
  if (GENERATED_MISS_REASONS.includes(value as GeneratedMissReason)) return value as GeneratedMissReason;
  throw new Error(`Unsupported generated miss reason: ${value}`);
}

export const TOOL_CALLING_BYPASS_BASE_SCENARIO_COUNT = BASE_TOOL_CALLING_BYPASS_FIXTURES.length;
export const TOOL_CALLING_BYPASS_TARGET_SCENARIO_COUNT = TOOL_CALLING_BYPASS_BASE_SCENARIO_COUNT * TOOL_CALLING_BYPASS_SCENARIO_MULTIPLIER;

const GENERATED_TOOL_CALLING_BYPASS_FIXTURES = buildGeneratedToolCallingBypassFixtures(
  TOOL_CALLING_BYPASS_TARGET_SCENARIO_COUNT - TOOL_CALLING_BYPASS_BASE_SCENARIO_COUNT
);

export const TOOL_CALLING_BYPASS_FIXTURES: ToolCallingBypassFixture[] = [
  ...BASE_TOOL_CALLING_BYPASS_FIXTURES,
  ...GENERATED_TOOL_CALLING_BYPASS_FIXTURES
];

export const TOOL_CALLING_BYPASS_EVALS = TOOL_CALLING_BYPASS_FIXTURES.map((fixture) => fixture.name);

export function toolCallingBypassEvalInput(fixture: ToolCallingBypassFixture): string {
  return JSON.stringify({
    scenario: fixture.name,
    route: fixture.route,
    user_input: fixture.input,
    tool_matching_level: fixture.level,
    available_tools: fixture.availableTools,
    protected_tools: fixture.protectedTools ?? [],
    denied_tools: fixture.deniedTools ?? [],
    configured_regex: fixture.configuredRegex ?? false,
    local_embedding: fixture.localEmbedding ?? false,
    local_tool_executor: fixture.expected.shouldExecute === true ? 'required' : 'optional',
    test_strategy: fixture.testStrategy
  }, null, 2);
}

export function toolCallingBypassExpectedPayload(fixture: ToolCallingBypassFixture): string {
  return JSON.stringify({
    scenario: fixture.name,
    category: fixture.category,
    level: fixture.level,
    should_bypass: fixture.expected.shouldBypass,
    should_execute: fixture.expected.shouldExecute ?? false,
    should_forward_upstream: fixture.expected.shouldForwardUpstream ?? !fixture.expected.shouldBypass,
    expected_tool: fixture.expected.expectedTool,
    expected_reason: fixture.expected.expectedReason,
    expected_args: fixture.expected.expectedArgs ?? {},
    expected_output_contains: fixture.expected.expectedOutputContains ?? [],
    expected_miss_reason: fixture.expected.expectedMissReason,
    clarification_contains: fixture.expected.clarificationContains ?? []
  }, null, 2);
}
