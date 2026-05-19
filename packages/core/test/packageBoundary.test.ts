import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(repoRoot, file), 'utf8')) as Record<string, unknown>;
}

describe('package boundary', () => {
  it('does not expose a public CLI or MCP package', async () => {
    const rootPackage = await readJson('package.json');
    const packages = await readdir(path.join(repoRoot, 'packages'));

    expect(rootPackage).not.toHaveProperty('bin');
    expect(packages).not.toContain('mcp-server');
  });

  it('does not include the accidental VS Code extension package', async () => {
    const packages = await readdir(path.join(repoRoot, 'packages'));
    const lock = await readJson('package-lock.json');

    expect(packages).not.toContain('vscode-extension');
    expect(JSON.stringify(lock)).not.toContain('utk-vscode');
    expect(JSON.stringify(lock)).not.toContain('@types/vscode');
  });
});
