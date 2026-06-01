import { readFile } from 'node:fs/promises';
import { safeJoin } from '../security/pathSafety.js';
import {
  ensureInside,
  findArtifactRecord,
  splitLines,
  validateArtifactId
} from './artifactRecords.js';

export type ArtifactHandle = {
  artifactId: string;
  routeId?: string;
  schemaId?: string;
  relativePath?: string;
  range?: string;
  snippet?: string;
};

export async function expandArtifactReference(workspaceRoot: string, request: {
  id?: string;
  range?: string;
  query?: string;
  blockId?: string;
  handle?: ArtifactHandle;
}): Promise<{ id: string; content: string }> {
  const id = request.handle?.artifactId ?? request.id;
  if (!id && request.blockId) {
    const blockPath = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'blocks', `${request.blockId}.txt`);
    return { id: request.blockId, content: await readFile(ensureInside(workspaceRoot, blockPath), 'utf8') };
  }
  if (!id) throw new Error('Context artifact id required');
  validateArtifactId(id);
  if (request.blockId) {
    const blockPath = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'blocks', `${request.blockId}.txt`);
    try {
      return { id, content: await readFile(ensureInside(workspaceRoot, blockPath), 'utf8') };
    } catch {
      // Fall through to artifact recovery.
    }
  }
  const record = await findArtifactRecord(workspaceRoot, id);
  const artifactPath = record?.path ?? safeJoin(workspaceRoot, '.utk', 'model-proxy', 'artifacts', `${id}.txt`);
  const content = await readFile(ensureInside(workspaceRoot, artifactPath), 'utf8');
  let lines = splitLines(content);
  const range = request.handle?.range ?? request.range;
  const query = request.query;
  if (range) {
    const parsed = parseRange(range, lines.length);
    lines = lines.slice(parsed.start - 1, parsed.end);
  }
  if (query) {
    const needle = query.toLowerCase();
    lines = lines.filter((line) => line.toLowerCase().includes(needle));
  }
  return { id, content: lines.join('\n') };
}

function parseRange(range: string, lineCount: number): { start: number; end: number } {
  const match = /^(\d+)(?:-(\d+))?$/.exec(range);
  if (!match) throw new Error('Invalid artifact range');
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (start < 1 || end < start || end > lineCount) throw new Error('Invalid artifact range');
  return { start, end };
}
