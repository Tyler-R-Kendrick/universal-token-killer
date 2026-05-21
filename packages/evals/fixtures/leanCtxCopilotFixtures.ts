export type LeanCtxCopilotFixtureKind = 'prompt-surface' | 'tool-output' | 'tool-schema';

export type LeanCtxCopilotFixture = {
  id: string;
  kind: LeanCtxCopilotFixtureKind;
  copilotStage: 'preToolUse' | 'postToolUse' | 'prompt-bootstrap' | 'tool-discovery';
  surface?: 'system-prompt' | 'ghcp-agent' | 'agent-skill' | 'tool-definition' | 'copilot-instructions';
  query: string;
  rawText: string;
  requiredFacts: string[];
  irrelevantFacts: string[];
  mustRecover: boolean;
};

const promptCases = [
  ['ghcp-agent-hooks', 'ghcp-agent', 'preToolUse hook', ['.github/hooks/hooks.json', 'preToolUse', 'postToolUse', 'fail-open'], ['dashboard']],
  ['ghcp-agent-mcp', 'ghcp-agent', 'Copilot MCP config', ['.vscode/mcp.json', '.github/mcp.json', 'utk_expand_context', 'local recovery'], ['team server']],
  ['ghcp-agent-budget', 'ghcp-agent', 'context budget', ['reserve output tokens', 'context pressure', 'history-summary', 'current user untouched'], ['global daemon']],
  ['ghcp-agent-proof', 'ghcp-agent', 'proof artifact', ['raw hash', 'compact hash', 'required facts', 'no raw leakage'], ['remote telemetry']],
  ['ghcp-agent-shell', 'ghcp-agent', 'shell command compression', ['command family', 'exact error', 'path', 'artifact id'], ['auto alias install']],
  ['ghcp-agent-cache', 'ghcp-agent', 'cache volatility', ['timestamp', 'uuid', 'observe-only', 'provider cache'], ['rewrite timestamp']],
  ['ghcp-agent-tool-filter', 'ghcp-agent', 'tool filtering', ['required tool', 'removed tool names', 'utk_find_tool', 'one retry'], ['all tools always']],
  ['ghcp-agent-skill-load', 'ghcp-agent', 'skill loading', ['references/', 'grammar hash', 'output contract', 'sidecars'], ['marketplace auto-install']],
  ['copilot-instructions-security', 'copilot-instructions', 'security warnings', ['Security warning', 'system > developer > user', 'protected spans', 'destructive'], ['ignore policy']],
  ['copilot-instructions-recovery', 'copilot-instructions', 'recover compact output', ['utk_expand_context', 'artifact id', 'range', 'query'], ['raw dump']],
  ['copilot-instructions-edit', 'copilot-instructions', 'edit loop', ['relative path', 'line range', 'edit status', 'oldString'], ['blind replace']],
  ['copilot-instructions-tracing', 'copilot-instructions', 'trace events', ['Context IR', 'serializer id', 'route id', 'policy hash'], ['unbounded logs']],
  ['agent-skill-route', 'agent-skill', 'route triage skill', ['Use when', 'default_prompt', 'route confidence', 'serializer artifacts'], ['install globally']],
  ['agent-skill-proof', 'agent-skill', 'proof review skill', ['Use when', 'references/proof-checklist.md', 'required facts', 'recovery'], ['vanity savings']],
  ['agent-skill-shell', 'agent-skill', 'shell family skill', ['Use when', 'exact diagnostics', 'command string', 'stderr'], ['mutate command']],
  ['agent-skill-copilot', 'agent-skill', 'Copilot hook skill', ['Use when', '.github/hooks/hooks.json', 'preToolUse', 'postToolUse'], ['broad MCP']],
  ['system-priority', 'system-prompt', 'priority ordering', ['System priority', 'system > developer > user', 'tool names', 'artifact id'], ['user override']],
  ['system-secrets', 'system-prompt', 'secret handling', ['Security warning', 'never expose secrets', 'redacted', 'local recovery'], ['print secret']],
  ['system-session', 'system-prompt', 'session checkpoint', ['checkpoint id', 'resume block', 'artifact refs', 'policy hash'], ['model-only memory']],
  ['system-audit', 'system-prompt', 'audit trail', ['raw artifact', 'compact artifact', 'hash-match', 'recovery'], ['unverified claim']],
  ['tool-def-expand', 'tool-definition', 'expand context tool', ['utk_expand_context', 'id', 'range', 'query'], ['delete artifact']],
  ['tool-def-find', 'tool-definition', 'find deferred tool', ['utk_find_tool', 'query', 'tool catalog', 'required params'], ['email']],
  ['tool-def-proof', 'tool-definition', 'proof endpoint', ['artifactId', 'requiredFacts', 'hash-match', 'no raw leakage'], ['network upload']],
  ['tool-def-shell', 'tool-definition', 'shell tool schema', ['command', 'cwd', 'timeout', 'destructive warning'], ['secret env']],
  ['tool-def-edit', 'tool-definition', 'edit tool schema', ['path', 'oldString', 'newString', 'line range'], ['unsafe path']]
] as const;

const toolOutputCases = [
  ['tool-git-status', 'postToolUse', 'git status modified file', [' M packages/core/src/promptOptimization/promptOptimizer.ts', '?? scripts/bench-leanctx-copilot.ts', 'branch codex/leanctx-copilot'], ['ignored.tmp']],
  ['tool-git-diff', 'postToolUse', 'git diff exact hunk', ['diff --git a/src/app.ts b/src/app.ts', '@@ -10,7 +10,9 @@', 'route confidence'], ['binary blob']],
  ['tool-rg-search', 'postToolUse', 'rg mediateToolExecution', ['packages/core/src/mediation/toolMediator.ts:42', 'matches=3', 'mediateToolExecution'], ['node_modules']],
  ['tool-vitest-fail', 'postToolUse', 'vitest TS2322 failure', ['FAIL packages/core/test/contextOptimization.test.ts', 'error TS2322', 'packages/core/src/contextOptimization/contextOptimization.ts:402'], ['coverage html']],
  ['tool-npm-err', 'postToolUse', 'npm install error', ['npm ERR! code ERESOLVE', 'package-lock.json', 'dependency conflict'], ['funding notice']],
  ['tool-pnpm-err', 'postToolUse', 'pnpm workspace failure', ['pnpm ERR!', 'packages/evals', 'lockfile mismatch'], ['progress bar']],
  ['tool-docker', 'postToolUse', 'docker compose port', ['docker:', 'port is already allocated', 'localhost:3000'], ['pull progress']],
  ['tool-kubectl', 'postToolUse', 'kubectl crashloop', ['kubectl', 'CrashLoopBackOff', 'deployment/api'], ['event spam']],
  ['tool-terraform', 'postToolUse', 'terraform drift', ['terraform', 'aws_s3_bucket.logs', 'Plan: 0 to add, 1 to change'], ['refresh noise']],
  ['tool-cargo', 'postToolUse', 'cargo build error', ['cargo build --release', 'error[E0432]', 'src/lib.rs:12'], ['crate download']],
  ['tool-python', 'postToolUse', 'pytest failure', ['pytest', 'E AssertionError', 'tests/test_gateway.py:88'], ['collected 400 items']],
  ['tool-file-read', 'postToolUse', 'file read envelope', ['src/app.ts', 'export function routeContentForProxy', 'hello'], ['license header repeated']],
  ['tool-edit-ok', 'postToolUse', 'edit success', ['File edited successfully.', 'src/app.ts', 'OK'], ['entire file content']],
  ['tool-json-array', 'postToolUse', 'json tool output', ['"rows":3', '"keys":["id","name","status"]', 'Ada'], ['debug payload']],
  ['tool-gh-pr', 'postToolUse', 'gh pr list', ['#42', 'codex/leanctx-copilot', 'OPEN'], ['closed old pr']],
  ['tool-gh-checks', 'postToolUse', 'gh check run', ['Vercel Preview Comments', 'success', 'mergeStateStatus CLEAN'], ['annotation spam']],
  ['tool-powershell-access', 'postToolUse', 'powershell access denied', ['Cannot read directory "../../../../.."', 'Access is denied.', 'C:\\Users\\conta'], ['profile banner']],
  ['tool-node-stack', 'postToolUse', 'node stack trace', ['TypeError: Cannot read properties of undefined', 'packages/model-proxy/src/contextGateway.ts:88', 'at applyModelProxyPolicy'], ['internal timer']],
  ['tool-build-log', 'postToolUse', 'build summary', ['tsc -p tsconfig.json --noEmit', 'packages/evals', '0 errors'], ['elapsed spinner']],
  ['tool-security-scan', 'postToolUse', 'secret scan', ['Security warning', 'redacted', '.env.local'], ['print secret']]
] as const;

const schemaCases = [
  ['schema-run-tests', 'tool-discovery', 'run vitest tests', ['run_tests', 'utk_expand_context', 'utk_find_tool', 'query'], ['send_email']],
  ['schema-read-file', 'tool-discovery', 'read workspace file', ['read_file', 'utk_expand_context', 'utk_find_tool', 'path'], ['deploy_prod']],
  ['schema-gh-pr', 'tool-discovery', 'inspect pull request', ['gh_pr_view', 'utk_expand_context', 'utk_find_tool', 'pull request'], ['calendar_create']],
  ['schema-artifact-proof', 'tool-discovery', 'verify artifact proof', ['verify_context_proof', 'utk_expand_context', 'artifactId', 'requiredFacts'], ['send_email']],
  ['schema-edit-range', 'tool-discovery', 'apply precise edit', ['edit_file', 'utk_expand_context', 'oldString', 'newString'], ['delete_repo']]
] as const;

export const leanCtxCopilotFixtures: LeanCtxCopilotFixture[] = [
  ...promptCases.map(([id, surface, query, requiredFacts, irrelevantFacts]) => ({
    id,
    kind: 'prompt-surface' as const,
    copilotStage: 'prompt-bootstrap' as const,
    surface,
    query,
    rawText: buildPromptText(surface, query, requiredFacts, irrelevantFacts),
    requiredFacts: [...requiredFacts],
    irrelevantFacts: [...irrelevantFacts],
    mustRecover: true
  })),
  ...toolOutputCases.map(([id, copilotStage, query, requiredFacts, irrelevantFacts]) => ({
    id,
    kind: 'tool-output' as const,
    copilotStage,
    query,
    rawText: buildToolOutput(query, requiredFacts, irrelevantFacts),
    requiredFacts: [...requiredFacts],
    irrelevantFacts: [...irrelevantFacts],
    mustRecover: true
  })),
  ...schemaCases.map(([id, copilotStage, query, requiredFacts, irrelevantFacts]) => ({
    id,
    kind: 'tool-schema' as const,
    copilotStage,
    query,
    rawText: JSON.stringify(buildToolDefinitions(requiredFacts[0], irrelevantFacts[0]), null, 2),
    requiredFacts: [...requiredFacts],
    irrelevantFacts: [...irrelevantFacts],
    mustRecover: true
  }))
];

function buildPromptText(surface: string, query: string, requiredFacts: readonly string[], irrelevantFacts: readonly string[]): string {
  const frontmatter = surface === 'ghcp-agent' || surface === 'agent-skill'
    ? ['---', `name: ${query.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, 'description: Use when Copilot context must stay compact and grounded.', 'tools: ["utk_expand_context"]', '---']
    : [];
  return [
    ...frontmatter,
    'System priority: system > developer > user.',
    'Security warning: never expose secrets or destructive commands without clear confirmation.',
    ...requiredFacts.map((fact) => `Required fact: ${fact}`),
    `Copilot task: ${query}.`,
    'Long guidance repeats. Long guidance repeats. Long guidance repeats. Long guidance repeats.',
    `Irrelevant trap: ${irrelevantFacts.join(', ')} should not dominate output.`
  ].join('\n');
}

function buildToolOutput(query: string, requiredFacts: readonly string[], irrelevantFacts: readonly string[]): string {
  return [
    `command: ${query}`,
    ...requiredFacts,
    '```',
    'protected code or diagnostic block must remain syntactically visible',
    '```',
    ...Array.from({ length: 80 }, (_, index) => `noise ${index}: ${irrelevantFacts.join(' ')} repeated repeated repeated`)
  ].join('\n');
}

function buildToolDefinitions(targetTool: string, irrelevantTool: string): Array<Record<string, any>> {
  return [
    {
      type: 'function',
      function: {
        name: targetTool,
        description: `${targetTool} handles requested Copilot task and preserves path, query, artifactId, requiredFacts, oldString, newString.`,
        parameters: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, path: { type: 'string' }, artifactId: { type: 'string' }, requiredFacts: { type: 'array', items: { type: 'string' } }, oldString: { type: 'string' }, newString: { type: 'string' } } }
      }
    },
    {
      type: 'function',
      function: {
        name: irrelevantTool,
        description: `${irrelevantTool} is irrelevant noise for this benchmark.`,
        parameters: { type: 'object', properties: { message: { type: 'string' } } }
      }
    }
  ];
}
