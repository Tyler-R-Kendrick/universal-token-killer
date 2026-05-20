export type ModelProxyCompetitiveFixture = {
  id: string;
  source: 'compresr' | 'headroom' | 'kompress' | 'cavegemma' | 'lean-ctx' | 'openslimedit' | 'prompt-compression' | 'opencode-dcp';
  routeReason: string;
  rawTokens: number;
  expectedCompactTokens: number;
  requiredFacts: string[];
  mustRecover: boolean;
};

export const modelProxyCompetitiveFixtures: ModelProxyCompetitiveFixture[] = [
  {
    id: 'compresr-large-tool-output',
    source: 'compresr',
    routeReason: 'tool-output',
    rawTokens: 8200,
    expectedCompactTokens: 1100,
    requiredFacts: ['tool name', 'query intent', 'artifact id', 'route reason'],
    mustRecover: true
  },
  {
    id: 'headroom-structured-json-array',
    source: 'headroom',
    routeReason: 'structured-json',
    rawTokens: 6400,
    expectedCompactTokens: 900,
    requiredFacts: ['row count', 'keys', 'serializer id', 'recovery id'],
    mustRecover: true
  },
  {
    id: 'kompress-natural-language-field',
    source: 'kompress',
    routeReason: 'natural-language',
    rawTokens: 4200,
    expectedCompactTokens: 1400,
    requiredFacts: ['query', 'compression provider', 'protected spans'],
    mustRecover: true
  },
  {
    id: 'cavegemma-protected-spans',
    source: 'cavegemma',
    routeReason: 'protected-spans',
    rawTokens: 3000,
    expectedCompactTokens: 1200,
    requiredFacts: ['code fence', 'command', 'path', 'exact error'],
    mustRecover: true
  },
  {
    id: 'leanctx-context-pressure',
    source: 'lean-ctx',
    routeReason: 'context-pressure',
    rawTokens: 12000,
    expectedCompactTokens: 1800,
    requiredFacts: ['budget', 'reserve output tokens', 'context ir event'],
    mustRecover: true
  },
  {
    id: 'openslimedit-file-read-edit-loop',
    source: 'openslimedit',
    routeReason: 'edit-loop',
    rawTokens: 2600,
    expectedCompactTokens: 700,
    requiredFacts: ['relative path', 'line range', 'edit status'],
    mustRecover: true
  },
  {
    id: 'prompt-system-surface',
    source: 'compresr',
    routeReason: 'prompt-surface',
    rawTokens: 3600,
    expectedCompactTokens: 1300,
    requiredFacts: ['security warning', 'priority order', 'tool names', 'artifact id'],
    mustRecover: true
  },
  {
    id: 'prompt-ghcp-agent-definition',
    source: 'lean-ctx',
    routeReason: 'prompt-surface',
    rawTokens: 2400,
    expectedCompactTokens: 800,
    requiredFacts: ['frontmatter', 'tools', 'grammar hash', 'output contract'],
    mustRecover: true
  },
  {
    id: 'prompt-agent-skill-pack',
    source: 'cavegemma',
    routeReason: 'prompt-surface',
    rawTokens: 3000,
    expectedCompactTokens: 950,
    requiredFacts: ['name', 'description', 'Use when', 'default_prompt', 'references'],
    mustRecover: true
  },
  {
    id: 'prompt-verbose-tool-schema',
    source: 'openslimedit',
    routeReason: 'tool-definition',
    rawTokens: 2800,
    expectedCompactTokens: 700,
    requiredFacts: ['tool name', 'required params', 'protected arg names'],
    mustRecover: true
  },
  {
    id: 'prompt-recovery-tool-injection',
    source: 'headroom',
    routeReason: 'recovery-tool',
    rawTokens: 1800,
    expectedCompactTokens: 500,
    requiredFacts: ['utk_expand_context', 'artifact id', 'local recovery'],
    mustRecover: true
  },
  {
    id: 'compresr-history-compaction',
    source: 'compresr',
    routeReason: 'history-summary',
    rawTokens: 22000,
    expectedCompactTokens: 2600,
    requiredFacts: ['75 percent threshold', 'output reserve', 'history summary'],
    mustRecover: true
  },
  {
    id: 'compresr-tool-discovery',
    source: 'compresr',
    routeReason: 'tool-discovery',
    rawTokens: 5200,
    expectedCompactTokens: 900,
    requiredFacts: ['required tool', 'recovery tool', 'removed tool names'],
    mustRecover: true
  },
  {
    id: 'headroom-cache-aligner',
    source: 'headroom',
    routeReason: 'cache-volatility',
    rawTokens: 1800,
    expectedCompactTokens: 1700,
    requiredFacts: ['timestamp', 'uuid', 'observe-only'],
    mustRecover: true
  },
  {
    id: 'headroom-ccr-range-search',
    source: 'headroom',
    routeReason: 'artifact-recovery',
    rawTokens: 8400,
    expectedCompactTokens: 600,
    requiredFacts: ['range', 'query', 'artifact id'],
    mustRecover: true
  },
  {
    id: 'leanctx-shell-patterns',
    source: 'lean-ctx',
    routeReason: 'build-log',
    rawTokens: 7600,
    expectedCompactTokens: 1200,
    requiredFacts: ['command family', 'exact error', 'path'],
    mustRecover: true
  },
  {
    id: 'leanctx-artifact-proof-hash',
    source: 'lean-ctx',
    routeReason: 'context-proof',
    rawTokens: 3400,
    expectedCompactTokens: 750,
    requiredFacts: ['hash', 'route reason', 'line count'],
    mustRecover: true
  },
  {
    id: 'prompt-compression-agent-context-index',
    source: 'prompt-compression',
    routeReason: 'prompt-surface',
    rawTokens: 6200,
    expectedCompactTokens: 1400,
    requiredFacts: ['AGENTS.md', 'retrieval-led', 'pipe-index', 'security warning'],
    mustRecover: true
  },
  {
    id: 'gateway-session-block-compaction',
    source: 'compresr',
    routeReason: 'session-block',
    rawTokens: 26000,
    expectedCompactTokens: 2300,
    requiredFacts: ['block id', 'artifact id', 'history-summary'],
    mustRecover: true
  },
  {
    id: 'gateway-deferred-tool-discovery',
    source: 'compresr',
    routeReason: 'tool-discovery',
    rawTokens: 7000,
    expectedCompactTokens: 900,
    requiredFacts: ['utk_find_tool', 'utk_expand_context', 'required tool'],
    mustRecover: true
  },
  {
    id: 'gateway-dedupe-repeated-tools',
    source: 'opencode-dcp',
    routeReason: 'dedupe',
    rawTokens: 5400,
    expectedCompactTokens: 600,
    requiredFacts: ['tool identity', 'older artifact', 'newer artifact'],
    mustRecover: true
  },
  {
    id: 'gateway-purge-stale-errors',
    source: 'opencode-dcp',
    routeReason: 'stale-error',
    rawTokens: 4200,
    expectedCompactTokens: 500,
    requiredFacts: ['turn threshold', 'protected tool', 'raw artifact'],
    mustRecover: true
  },
  {
    id: 'gateway-context-proof',
    source: 'lean-ctx',
    routeReason: 'context-proof',
    rawTokens: 3600,
    expectedCompactTokens: 650,
    requiredFacts: ['raw hash', 'compact hash', 'required facts', 'recovery'],
    mustRecover: true
  },
  {
    id: 'gateway-provider-fail-open',
    source: 'kompress',
    routeReason: 'provider-error',
    rawTokens: 2400,
    expectedCompactTokens: 2300,
    requiredFacts: ['auth', 'rate-limit', 'timeout', 'fail-open'],
    mustRecover: true
  },
  {
    id: 'gateway-v3-replace-history',
    source: 'compresr',
    routeReason: 'session-block',
    rawTokens: 28000,
    expectedCompactTokens: 1800,
    requiredFacts: ['replaced old span', 'current user untouched', 'block id', 'artifact id'],
    mustRecover: true
  },
  {
    id: 'gateway-v3-find-tool-loop',
    source: 'compresr',
    routeReason: 'tool-discovery',
    rawTokens: 8200,
    expectedCompactTokens: 850,
    requiredFacts: ['utk_find_tool', 'tool catalog', 'one retry', 'stream pass-through'],
    mustRecover: true
  },
  {
    id: 'gateway-v3-route-specific-compactors',
    source: 'headroom',
    routeReason: 'structured-json-array',
    rawTokens: 9000,
    expectedCompactTokens: 1100,
    requiredFacts: ['row count', 'keys', 'matches', 'exact diagnostic', 'OK edit status'],
    mustRecover: true
  },
  {
    id: 'gateway-v3-stored-proof',
    source: 'lean-ctx',
    routeReason: 'context-proof',
    rawTokens: 4100,
    expectedCompactTokens: 650,
    requiredFacts: ['stored compact artifact', 'hash-match', 'required facts', 'no raw leakage'],
    mustRecover: true
  },
  {
    id: 'gateway-v3-durable-ledger',
    source: 'opencode-dcp',
    routeReason: 'session-block',
    rawTokens: 6600,
    expectedCompactTokens: 700,
    requiredFacts: ['session id', 'monotonic message id', 'monotonic tool id', 'block id'],
    mustRecover: true
  }
];
