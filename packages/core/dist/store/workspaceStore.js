import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
export const DEFAULT_CONFIG = {
    version: 1,
    mode: 'copilot-only',
    storageRoot: '.utk',
    structuredOutput: {
        canonical: ['json-schema', 'toon'],
        decoder: 'llguidance.ts',
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
};
const STORE_GITIGNORE = `/tools/*/observations/\n/routing-telemetry/\n/evals/results/\n/traces/\n/tmp/\n*.raw.json\n*.raw.txt\n*.raw.bin\n`;
const DIRECTORIES = [
    'routes',
    'grammars',
    'tools',
    'routing-telemetry',
    'evals/fixtures',
    'evals/results',
    'traces',
    'quarantine',
    'tmp'
];
export async function initializeWorkspaceStore(workspaceRoot) {
    const storageRoot = path.join(workspaceRoot, '.utk');
    await mkdir(storageRoot, { recursive: true });
    await Promise.all(DIRECTORIES.map((segment) => mkdir(path.join(storageRoot, segment), { recursive: true })));
    const gitignorePath = path.join(storageRoot, '.gitignore');
    await ensureFile(gitignorePath, STORE_GITIGNORE);
    const configPath = path.join(storageRoot, 'config.json');
    await ensureFile(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
    return { storageRoot, configPath };
}
async function ensureFile(filePath, contents) {
    try {
        await readFile(filePath, 'utf8');
    }
    catch {
        await writeFile(filePath, contents, 'utf8');
    }
}
