export type ToolMatchingLevelName = 'slash-commands' | 'exact-lexical-match' | 'regex-patterns' | 'lexical-similarity';

export type ToolMatchingPositiveCase = {
  input: string;
  expectedTool: string;
  minLevel?: ToolMatchingLevelName;
  expectedArgs?: Record<string, unknown>;
};

export type ToolMatchingNegativeCase = {
  input: string;
  level?: ToolMatchingLevelName;
};

export const toolMatchingTools = [
  tool('run_tests', 'Run unit integration vitest jest tests and return diagnostics.', {
    pattern: { type: 'string', description: 'Test name, file, or grep pattern.' },
    suite: { type: 'string', default: 'unit' }
  }),
  tool('grep', 'Search local project files for text, TODO markers, symbols, and regex matches.', {
    pattern: { type: 'string', description: 'Text or regex to find.' },
    path: { type: 'string', default: 'src' }
  }),
  tool('read_file', 'Read file content from a workspace path such as package.json or src/app.ts.', {
    path: { type: 'string', description: 'File path to read.' }
  }),
  tool('fetch', 'Fetch or open URL content from http and https links.', {
    url: { type: 'string', description: 'URL to fetch.' }
  }),
  tool('list_files', 'List files and directories under a workspace path.', {
    path: { type: 'string', default: '.' }
  }),
  tool('create_file', 'Create a file at a workspace path with optional content.', {
    path: { type: 'string' },
    content: { type: 'string', default: '' }
  }),
  tool('delete_file', 'Delete a workspace file by path.', {
    path: { type: 'string' }
  }),
  tool('edit_file', 'Edit a workspace file by replacing old text with new text.', {
    path: { type: 'string' },
    old_string: { type: 'string' },
    new_string: { type: 'string' }
  }, ['path', 'old_string', 'new_string']),
  tool('web_search', 'Search the public web for pages, news, docs, and current information.', {
    query: { type: 'string' }
  }),
  tool('send_email', 'Send outbound email to a recipient with subject and message body.', {
    to: { type: 'string' },
    subject: { type: 'string', default: '' },
    body: { type: 'string', default: '' }
  })
];

const positives: ToolMatchingPositiveCase[] = [
  { input: '/run_tests --pattern unit', expectedTool: 'run_tests', minLevel: 'slash-commands', expectedArgs: { pattern: 'unit' } },
  { input: '/run-tests --pattern unit', expectedTool: 'run_tests', minLevel: 'slash-commands', expectedArgs: { pattern: 'unit' } },
  { input: '/run.tests --pattern unit', expectedTool: 'run_tests', minLevel: 'slash-commands', expectedArgs: { pattern: 'unit' } },
  { input: '/run_tests {"pattern":"smoke","suite":"integration"}', expectedTool: 'run_tests', minLevel: 'slash-commands', expectedArgs: { pattern: 'smoke', suite: 'integration' } },
  { input: '/grep --pattern TODO --path src', expectedTool: 'grep', minLevel: 'slash-commands', expectedArgs: { pattern: 'TODO', path: 'src' } },
  { input: '/read_file package.json', expectedTool: 'read_file', minLevel: 'slash-commands', expectedArgs: { path: 'package.json' } },
  { input: '/read-file --path "src/app.ts"', expectedTool: 'read_file', minLevel: 'slash-commands', expectedArgs: { path: 'src/app.ts' } },
  { input: '/fetch https://example.com', expectedTool: 'fetch', minLevel: 'slash-commands', expectedArgs: { url: 'https://example.com' } },
  { input: '/web_search query="typescript release notes"', expectedTool: 'web_search', minLevel: 'slash-commands', expectedArgs: { query: 'typescript release notes' } },
  { input: '/list_files --path src', expectedTool: 'list_files', minLevel: 'slash-commands', expectedArgs: { path: 'src' } },
  { input: '/create_file --path docs/notes.md --content "hello"', expectedTool: 'create_file', minLevel: 'slash-commands', expectedArgs: { path: 'docs/notes.md', content: 'hello' } },
  { input: '/delete_file --path tmp.txt', expectedTool: 'delete_file', minLevel: 'slash-commands', expectedArgs: { path: 'tmp.txt' } },
  { input: 'run tests', expectedTool: 'run_tests', minLevel: 'exact-lexical-match' },
  { input: 'run vitest tests', expectedTool: 'run_tests', minLevel: 'regex-patterns' },
  { input: 'find TODO in src', expectedTool: 'grep', minLevel: 'regex-patterns', expectedArgs: { pattern: 'TODO', path: 'src' } },
  { input: 'read package json', expectedTool: 'read_file', minLevel: 'regex-patterns', expectedArgs: { path: 'package.json' } },
  { input: 'open https://example.com', expectedTool: 'fetch', minLevel: 'regex-patterns', expectedArgs: { url: 'https://example.com' } },
  { input: 'list files in src/components', expectedTool: 'list_files', minLevel: 'regex-patterns', expectedArgs: { path: 'src/components' } },
  { input: 'search web for openai docs', expectedTool: 'web_search', minLevel: 'regex-patterns', expectedArgs: { query: 'openai docs' } },
  { input: 'send email to ada@example.com', expectedTool: 'send_email', minLevel: 'regex-patterns', expectedArgs: { to: 'ada@example.com' } }
];

const directCommands: Array<[string, string, string[]]> = [
  ['run_tests', 'run tests', ['run tests', 'execute tests', 'invoke test runner', 'use run tests', 'call run tests', 'run unit tests', 'run vitest tests']],
  ['grep', 'grep', ['grep TODO', 'search files for TODO', 'find TODO in src', 'search project files for token', 'find symbol in repo', 'look for TODO markers']],
  ['read_file', 'read file', ['read file package.json', 'read package json', 'fetch file src/app.ts', 'open file README.md', 'show src/index.ts']],
  ['fetch', 'fetch url', ['fetch https://example.com', 'open https://example.com', 'read url https://docs.example.com', 'get https://example.org/page']],
  ['list_files', 'list files', ['list files', 'list files in src', 'show directory src', 'enumerate files under packages/core', 'ls src/components']],
  ['create_file', 'create file', ['create file notes.md', 'write file docs/plan.md', 'make file src/new.ts', 'create docs/todo.md with content hello']],
  ['delete_file', 'delete file', ['delete file tmp.txt', 'remove file build/out.txt', 'unlink tmp/cache.json', 'delete workspace file notes.md']],
  ['web_search', 'web search', ['web search openai', 'search web for release notes', 'find online docs for vitest', 'look up node latest']],
  ['send_email', 'send email', ['send email to ada@example.com', 'email ada@example.com subject hello', 'mail user@example.com body hi', 'send outbound email']]
];

for (const [expectedTool, exactAlias, commands] of directCommands) {
  positives.push({ input: exactAlias, expectedTool, minLevel: 'exact-lexical-match' });
  for (const command of commands) {
    positives.push({ input: command, expectedTool, minLevel: command === exactAlias ? 'exact-lexical-match' : 'regex-patterns' });
    positives.push({ input: `please ${command}`, expectedTool, minLevel: 'regex-patterns' });
    positives.push({ input: `${command}.`, expectedTool, minLevel: 'regex-patterns' });
  }
}

const slashTools = ['run_tests', 'grep', 'read_file', 'list_files', 'create_file', 'delete_file'];
for (const name of slashTools) {
  for (const variant of slashVariants(name)) {
    positives.push({ input: `${variant} --path src --pattern TODO`, expectedTool: name, minLevel: 'slash-commands' });
  }
}

for (const [input, expectedTool] of [
  ['RUN TESTS', 'run_tests'],
  ['Run    tests', 'run_tests'],
  ['run-tests', 'run_tests'],
  ['runn tests', 'run_tests'],
  ['fnd TODO in src', 'grep'],
  ['serch files TODO', 'grep'],
  ['reed package json', 'read_file'],
  ['read package.json', 'read_file'],
  ['opne https://example.com', 'fetch'],
  ['fetchh https://example.com', 'fetch'],
  ['lst files src', 'list_files'],
  ['creat file notes.md', 'create_file'],
  ['delet file tmp.txt', 'delete_file'],
  ['web serch vite docs', 'web_search'],
  ['snd email ada@example.com', 'send_email']
] satisfies Array<[string, string]>) {
  positives.push({ input, expectedTool, minLevel: 'lexical-similarity' });
}

while (positives.length < 320) {
  const index = positives.length;
  const templates = directCommands[index % directCommands.length]!;
  const command = templates[2][index % templates[2].length]!;
  const suffix = index % 3 === 0 ? ` --path src/${index}.ts` : index % 3 === 1 ? ` pattern=TODO_${index}` : ` "quoted value ${index}"`;
  positives.push({
    input: `${command}${suffix}`,
    expectedTool: templates[0],
    minLevel: 'regex-patterns'
  });
}

export const toolMatchingPositiveCases = positives;

const negatives: ToolMatchingNegativeCase[] = [
  { input: 'do not run tests' },
  { input: "don't run tests" },
  { input: 'never delete file tmp.txt' },
  { input: 'explain how to edit files' },
  { input: 'how to run tests in vitest' },
  { input: 'tell me what grep means' },
  { input: 'ambiguous search project' },
  { input: 'search project' },
  { input: 'read my mind about the plan' },
  { input: 'open the discussion about urls' },
  { input: 'delete fear from the roadmap' },
  { input: 'create a strategy, not a file' },
  { input: 'email is hard to configure' },
  { input: 'fetch sounds like a command' }
];

const unrelatedSubjects = [
  'architecture note', 'budget narrative', 'release summary', 'customer persona', 'design review',
  'pricing model', 'meeting agenda', 'risk register', 'migration story', 'roadmap question',
  'database theory', 'css cascade', 'api contract', 'queue latency', 'incident timeline',
  'deployment memory', 'token estimate', 'model comparison', 'security posture', 'retrospective'
];

for (let i = 0; negatives.length < 230; i += 1) {
  const subject = unrelatedSubjects[i % unrelatedSubjects.length]!;
  const phrase = [
    `summarize ${subject} without calling tools`,
    `compare ${subject} options in prose`,
    `draft notes about ${subject}`,
    `why did ${subject} change yesterday`,
    `think through ${subject} before implementation`
  ][i % 5]!;
  negatives.push({ input: phrase });
}

export const toolMatchingNegativeCases = negatives;

function slashVariants(name: string): string[] {
  return [
    `/${name}`,
    `/${name.replace(/_/g, '-')}`,
    `/${name.replace(/_/g, '.')}`
  ];
}

function tool(name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        required
      }
    }
  };
}
