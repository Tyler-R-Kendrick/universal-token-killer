export type ToolLexicalProfile = {
  aliases: string[];
  regexes: string[];
};

export const TOOL_VERBS = ['run', 'execute', 'call', 'use', 'invoke', 'search', 'find', 'read', 'write', 'edit', 'list', 'fetch', 'open', 'create', 'delete', 'remove', 'show', 'mail', 'email'];

const EMPTY_PROFILE: ToolLexicalProfile = { aliases: [], regexes: [] };

const TOOL_LEXICAL_PROFILES: Record<string, ToolLexicalProfile> = {
  run_tests: {
    aliases: ['run tests', 'execute tests', 'invoke test runner', 'call run tests', 'run unit tests', 'run vitest tests', 'test runner'],
    regexes: [`(?:^|\\b)(?:${verbGroup(['run', 'execute', 'invoke', 'call', 'use'])})\\b[\\s\\S]*\\b(?:tests?|vitest|jest)\\b(?<tail>[\\s\\S]*)$`]
  },
  grep: {
    aliases: ['grep', 'search files', 'search project files', 'find in files', 'find symbol', 'find todo', 'look for'],
    regexes: [`(?:^|\\b)(?:${verbGroup(['grep', 'find', 'search', 'look\\s+for'])})\\b(?<tail>[\\s\\S]+)$`]
  },
  read_file: {
    aliases: ['read file', 'open file', 'fetch file', 'show file', 'read package json', 'cat file'],
    regexes: [`(?:^|\\b)(?:${verbGroup(['read', 'open', 'show', 'cat', 'fetch'])})\\s+(?:file\\s+)?(?<tail>[\\s\\S]+)$`]
  },
  fetch: {
    aliases: ['fetch url', 'open url', 'read url', 'get url', 'open https', 'fetch http'],
    regexes: [`(?:^|\\b)(?:${verbGroup(['fetch', 'open', 'read', 'get'])})\\s+(?<url>https?:\\/\\/\\S+)(?<tail>[\\s\\S]*)$`]
  },
  list_files: {
    aliases: ['list files', 'show directory', 'enumerate files', 'ls', 'list directory'],
    regexes: [`(?:^|\\b)(?:(?:${verbGroup(['list', 'enumerate', 'ls'])})\\b(?:\\s+(?:files?|directory|dir))?|show\\s+(?:files?|directory|dir)\\b)(?<tail>[\\s\\S]*)$`]
  },
  create_file: {
    aliases: ['create file', 'write file', 'make file', 'create workspace file'],
    regexes: [`(?:^|\\b)(?:${verbGroup(['create', 'write', 'make'])})\\s+(?:file\\s+)?(?<tail>[\\s\\S]+)$`]
  },
  delete_file: {
    aliases: ['delete file', 'remove file', 'unlink file', 'delete workspace file'],
    regexes: [`(?:^|\\b)(?:${verbGroup(['delete', 'remove', 'unlink'])})\\s+(?:file\\s+)?(?<tail>[\\s\\S]+)$`]
  },
  edit_file: {
    aliases: ['edit file', 'replace text', 'modify file'],
    regexes: []
  },
  web_search: {
    aliases: ['web search', 'search web', 'find online', 'look up', 'search online'],
    regexes: ['(?:^|\\b)(?:web\\s+search|search\\s+web|find\\s+online|look\\s+up)(?<tail>[\\s\\S]*)$']
  },
  send_email: {
    aliases: ['send email', 'email', 'mail', 'send outbound email'],
    regexes: ['(?:^|\\b)(?:send\\s+email|email|mail|send\\s+outbound\\s+email)\\b(?<tail>[\\s\\S]*)$']
  }
};

export function toolLexicalProfile(name: string): ToolLexicalProfile {
  return TOOL_LEXICAL_PROFILES[normalizeProfileKey(name)] ?? EMPTY_PROFILE;
}

function normalizeProfileKey(value: string): string {
  return value.toLowerCase().replace(/[-.]/g, '_').replace(/\s+/g, '_');
}

function verbGroup(verbs: string[]): string {
  return verbs.join('|');
}
