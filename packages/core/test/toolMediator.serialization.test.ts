import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { initializeWorkspaceStore, mediateToolExecution } from '../src/index.js';

describe('tool mediation serialization', () => {
  it('returns serializer metadata and persists serialized TOON output', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-mediate-serializer-'));
    await initializeWorkspaceStore(root);

    const result = await mediateToolExecution({
      workspaceRoot: root,
      toolId: 'tool.structured',
      input: { id: 1 },
      execute: async () => ({ users: [{ id: 1, name: 'Ada' }] })
    });

    expect(result.serializerId).toBe('toon');
    expect(result.serializedPath.endsWith('output.compact.toon')).toBe(true);
    expect(await readFile(result.serializedPath, 'utf8')).toContain('keys[1]: users');
    expect(result.response).toContain('Serializer: toon');
  });
});
