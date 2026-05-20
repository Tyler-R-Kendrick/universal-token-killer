/* c8 ignore file -- covered by model-proxy behavior tests; artifact behavior is validated through expansion tests. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { contentHash, safeJoin } from './utils.js';

export type ContextArtifact = {
  id: string;
  path: string;
  compactPath?: string;
  kind: string;
  rawTokens: number;
  compactTokens: number;
};

export async function persistContextArtifact(params: {
  workspaceRoot: string;
  content: string;
  kind: string;
  rawTokens: number;
  compactTokens: number;
}): Promise<ContextArtifact> {
  const id = `utk_${contentHash(params.content, 16)}`;
  const root = safeJoin(params.workspaceRoot, '.utk', 'model-proxy', 'artifacts');
  await mkdir(root, { recursive: true });
  const artifactPath = safeJoin(root, `${id}.txt`);
  await writeFile(artifactPath, params.content, 'utf8');
  await writeFile(
    safeJoin(root, `${id}.json`),
    `${JSON.stringify({ id, kind: params.kind, rawTokens: params.rawTokens, compactTokens: params.compactTokens, path: artifactPath }, null, 2)}\n`,
    'utf8'
  );
  await indexArtifact(params.workspaceRoot, { id, path: artifactPath, kind: params.kind, rawTokens: params.rawTokens });
  return { id, path: artifactPath, kind: params.kind, rawTokens: params.rawTokens, compactTokens: params.compactTokens };
}

export async function persistCompactContextArtifact(workspaceRoot: string, artifact: ContextArtifact, compactContent: string): Promise<ContextArtifact> {
  const root = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'artifacts');
  await mkdir(root, { recursive: true });
  const compactPath = safeJoin(root, `${artifact.id}.compact.txt`);
  await writeFile(compactPath, compactContent, 'utf8');
  await indexArtifact(workspaceRoot, { id: artifact.id, path: artifact.path, compactPath, kind: artifact.kind, rawTokens: artifact.rawTokens });
  return { ...artifact, compactPath, compactTokens: Math.max(1, Math.ceil(compactContent.length / 4)) };
}

export async function expandContextArtifact(workspaceRoot: string, id: string, options: { range?: string; query?: string; blockId?: string; handle?: Record<string, unknown> } = {}): Promise<{ id: string; content: string }> {
  if (!/^utk_[a-f0-9]{16}$/.test(id)) {
    throw new Error('Invalid context artifact id');
  }
  const core = await import('@utk/core') as any;
  return core.expandArtifactReference(workspaceRoot, { id, ...options });
}

export function buildExpandContextTool(): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: 'utk_expand_context',
      description: 'Recover full UTK-compressed context by artifact id.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Artifact id like utk_0123456789abcdef.' },
          range: { type: 'string', description: 'Optional line range like 10-20.' },
          query: { type: 'string', description: 'Optional search query.' },
          blockId: { type: 'string', description: 'Optional session block id like b0001.' },
          handle: { type: 'object', description: 'Compact artifact handle returned by UTK.' }
        },
        additionalProperties: false
      }
    }
  };
}

async function indexArtifact(workspaceRoot: string, artifact: { id: string; path: string; compactPath?: string; kind: string; rawTokens: number }): Promise<void> {
  const core = await import('@utk/core') as any;
  const index = new core.ArtifactRecoveryIndex(workspaceRoot);
  await index.record({
    id: artifact.id,
    path: artifact.path,
    compactPath: artifact.compactPath,
    kind: artifact.kind,
    route: artifact.kind,
    schema: `${artifact.kind}.v1`,
    hash: contentHash(await readFile(artifact.path, 'utf8'), 16),
    tokenCount: artifact.rawTokens
  });
}
