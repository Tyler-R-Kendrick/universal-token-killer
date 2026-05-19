import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanupObservations, compactSchemaHistory, initializeWorkspaceStore, quarantineInvalidArtifacts, rebuildRoutes, validateArtifacts } from '../src/store/workspace.js';

describe('VS Code workspace store operations', () => {
  it('initializes storage, validates, quarantines, rebuilds routes, cleans observations, and compacts history', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-vscode-store-'));
    const storageRoot = await initializeWorkspaceStore(root);
    expect(await readFile(path.join(storageRoot, '.gitignore'), 'utf8')).toContain('/tools/*/observations/');
    await writeFile(path.join(storageRoot, '.gitignore'), 'custom\n', 'utf8');
    await initializeWorkspaceStore(root);
    expect(await readFile(path.join(storageRoot, '.gitignore'), 'utf8')).toBe('custom\n');

    await writeFile(path.join(storageRoot, 'routes', 'bad.json'), '{', 'utf8');
    const rawObservation = path.join(storageRoot, 'tools', 'raw', 'observations', 'run');
    await import('node:fs/promises').then((fs) => fs.mkdir(rawObservation, { recursive: true }));
    await writeFile(path.join(rawObservation, 'output.raw.json'), '{', 'utf8');
    expect(await validateArtifacts(storageRoot)).toHaveLength(1);
    expect(await quarantineInvalidArtifacts(storageRoot)).toBe(1);
    expect(await readFile(path.join(rawObservation, 'output.raw.json'), 'utf8')).toBe('{');

    await rebuildRoutes(storageRoot);
    expect(JSON.parse(await readFile(path.join(storageRoot, 'routes', 'index.json'), 'utf8'))).toEqual({ routes: [] });

    const observation = path.join(storageRoot, 'tools', 'tool', 'observations', 'run');
    await writeFile(path.join(observation, 'output.raw.txt'), 'x', 'utf8').catch(async () => {
      await import('node:fs/promises').then((fs) => fs.mkdir(observation, { recursive: true }));
      await writeFile(path.join(observation, 'output.raw.txt'), 'x', 'utf8');
    });
    const skipped = path.join(storageRoot, 'tools', 'tool', 'observations', 'skip');
    await import('node:fs/promises').then((fs) => fs.mkdir(skipped, { recursive: true }));
    await writeFile(path.join(skipped, 'output.raw.txt'), 'x', 'utf8');
    expect(await cleanupObservations(storageRoot, ['other'])).toBe(0);
    expect(await cleanupObservations(storageRoot)).toBe(3);

    const history = path.join(storageRoot, 'tools', 'tool', 'history');
    await import('node:fs/promises').then((fs) => fs.mkdir(history, { recursive: true }));
    await writeFile(path.join(history, 'tool.v1.a.schema.json'), '{}', 'utf8');
    await writeFile(path.join(history, 'tool.v2.b.schema.json'), '{}', 'utf8');
    expect(await compactSchemaHistory(storageRoot)).toBe(1);
    expect(await readdir(history)).toEqual(['tool.v2.b.schema.json']);
  });

  it('handles missing folders as empty operations', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-vscode-missing-'));
    expect(await validateArtifacts(path.join(root, 'missing'))).toEqual([]);
    expect(await cleanupObservations(path.join(root, 'missing'))).toBe(0);
    expect(await compactSchemaHistory(path.join(root, 'missing'))).toBe(0);
  });
});
