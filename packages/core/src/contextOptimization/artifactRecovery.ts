import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { contentHash } from '../artifact/canonical.js';
import { safeJoin } from '../security/pathSafety.js';
import type { ArtifactHandle } from './artifactExpansion.js';
import {
  ensureInside,
  lineOffsets,
  readArtifactRecords,
  splitLines,
  validateArtifactId,
  type ArtifactReferenceRecord
} from './artifactRecords.js';

export {
  expandArtifactReference
} from './artifactExpansion.js';
export type {
  ArtifactHandle
} from './artifactExpansion.js';
export {
  createContextProof,
  verifyContextProof
} from './artifactProof.js';
export type {
  ContextProof
} from './artifactProof.js';
export {
  ensureInside,
  findArtifactRecord,
  readArtifactRecords,
  splitLines
} from './artifactRecords.js';
export type {
  ArtifactReferenceRecord
} from './artifactRecords.js';

export class ArtifactRecoveryIndex {
  constructor(protected readonly workspaceRoot: string) {}

  async record(record: ArtifactReferenceRecord): Promise<void> {
    validateArtifactId(record.id);
    const artifactPath = ensureInside(this.workspaceRoot, record.path);
    const content = await readFile(artifactPath, 'utf8');
    const compactPath = record.compactPath ? ensureInside(this.workspaceRoot, record.compactPath) : undefined;
    const compactContent = compactPath ? await readFile(compactPath, 'utf8') : undefined;
    const indexed = {
      ...record,
      path: artifactPath,
      hash: contentHash(content, 16),
      rawHash: contentHash(content, 16),
      compactPath,
      compactHash: compactContent ? contentHash(compactContent, 16) : record.compactHash,
      lineCount: record.lineCount ?? splitLines(content).length,
      lineOffsets: record.lineOffsets ?? lineOffsets(content)
    };
    const indexPath = safeJoin(this.workspaceRoot, '.utk', 'model-proxy', 'index.jsonl');
    await mkdir(path.dirname(indexPath), { recursive: true });
    await appendFile(indexPath, `${JSON.stringify(indexed)}\n`, 'utf8');
  }
}

class ArtifactSearchIndex extends ArtifactRecoveryIndex {
  async search(query: string): Promise<ArtifactHandle[]> {
    const records = await readArtifactRecords(this.workspaceRoot);
    const handles: ArtifactHandle[] = [];
    const needle = query.toLowerCase();
    for (const record of records) {
      const content = await readFile(ensureInside(this.workspaceRoot, record.path), 'utf8');
      splitLines(content).forEach((line, index) => {
        if (!line.toLowerCase().includes(needle)) return;
        handles.push({
          artifactId: record.id,
          routeId: record.route,
          schemaId: record.schema,
          relativePath: record.relativePath,
          range: `${index + 1}-${index + 1}`,
          snippet: line
        });
      });
    }
    return handles;
  }
}

export function createArtifactSearchIndex(workspaceRoot: string): ArtifactRecoveryIndex & {
  search(query: string): Promise<ArtifactHandle[]>;
} {
  return new ArtifactSearchIndex(workspaceRoot);
}
