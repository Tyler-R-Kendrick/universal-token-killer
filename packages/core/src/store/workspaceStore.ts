import { lstat, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG_TOML } from '../config/config.js';

export const DEFAULT_CONFIG = {
  version: 1,
  mode: 'copilot-only',
  storageRoot: '.utk',
  structuredOutput: {
    canonical: ['json-schema', 'toon'],
    decoder: 'guidance-ts',
    fallback: 'validate-and-retry',
    maxRetries: 2
  },
  router: {
    strategy: 'deterministic-first',
    agentEnabledBelowConfidence: 0.95,
    maxRouteCandidatesPerTool: 8,
    maxRouterPromptTokens: 700,
    maxRouterOutputTokens: 32,
    persistRoutingTelemetry: true
  },
  returnPolicy: {
    default: 'reference-only',
    includeDiskPath: true,
    includeSchemaId: true,
    includeSchemaSummary: false,
    maxInlineChars: 400
  },
  schemaPolicy: {
    schemaIdFormat: '<normalized-tool-id>.v<N>.<short-content-hash>',
    historyRetention: 'keep-all-until-explicit-compact',
    markTentativeOnInit: true
  },
  ruleEngine: {
    allowedRuleKinds: [
      'constant',
      'homogeneous-array',
      'optional-field',
      'required-field',
      'enum-candidate',
      'format',
      'range',
      'cardinality',
      'free-text',
      'opaque'
    ],
    forbidUseCaseSpecificRules: true,
    forbidCliSpecificRules: true
  }
} as const;

const STORE_GITIGNORE = `/tools/*/observations/\n/routing-telemetry/\n/evals/results/\n/traces/\n/tmp/\n*.raw.json\n*.raw.txt\n*.raw.bin\n`;

export type WorkspaceInitResult = {
  storageRoot: string;
  configPath: string;
  sessionAgentsRoot: string;
  githubAgentsPath: string;
  sessionSkillsRoot: string;
  agentsSkillsPath: string;
};

const DIRECTORIES = [
  'routes',
  'grammars',
  'session-agents',
  'session-skills',
  'tools',
  'routing-telemetry',
  'evals/fixtures',
  'evals/results',
  'traces',
  'quarantine',
  'tmp'
] as const;

export async function initializeWorkspaceStore(workspaceRoot: string): Promise<WorkspaceInitResult> {
  const storageRoot = path.join(workspaceRoot, '.utk');
  const sessionAgentsRoot = path.join(storageRoot, 'session-agents');
  const githubAgentsPath = path.join(workspaceRoot, '.github', 'agents');
  const sessionSkillsRoot = path.join(storageRoot, 'session-skills');
  const agentsSkillsPath = path.join(workspaceRoot, '.agents', 'skills');
  await mkdir(storageRoot, { recursive: true });
  await Promise.all(DIRECTORIES.map((segment) => mkdir(path.join(storageRoot, segment), { recursive: true })));
  await ensureDirectoryLink(sessionAgentsRoot, githubAgentsPath);
  await ensureDirectoryLink(sessionSkillsRoot, agentsSkillsPath);

  const gitignorePath = path.join(storageRoot, '.gitignore');
  await ensureFile(gitignorePath, STORE_GITIGNORE);

  const configPath = path.join(storageRoot, 'config.json');
  await ensureFile(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  await ensureFile(path.join(storageRoot, 'config.toml'), DEFAULT_CONFIG_TOML);

  return { storageRoot, configPath, sessionAgentsRoot, githubAgentsPath, sessionSkillsRoot, agentsSkillsPath };
}

async function ensureDirectoryLink(targetRoot: string, linkPath: string): Promise<void> {
  await mkdir(path.dirname(linkPath), { recursive: true });
  try {
    const info = await lstat(linkPath);
    if (info.isSymbolicLink()) return;
    return;
  } catch {
    /* v8 ignore next -- non-Windows symlink type is covered on POSIX CI */
    await symlink(targetRoot, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  }
}

async function ensureFile(filePath: string, contents: string): Promise<void> {
  try {
    await readFile(filePath, 'utf8');
  } catch {
    await writeFile(filePath, contents, 'utf8');
  }
}
