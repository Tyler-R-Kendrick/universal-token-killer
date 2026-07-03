import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const packagesRoot = path.join(repoRoot, 'packages');

/** Recursively collect `.ts` files under a root, skipping build output and tests. */
async function collectSourceTs(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'test'].includes(entry.name)) await walk(full);
      } else if (entry.name.endsWith('.ts')) {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

async function packageDependencies(pkgDir: string): Promise<Record<string, string>> {
  try {
    const pkg = JSON.parse(await readFile(path.join(packagesRoot, pkgDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    return pkg.dependencies ?? {};
  } catch {
    return {};
  }
}

describe('package layering fitness', () => {
  it('extracts the reusable primitives and use-case concerns as their own packages', async () => {
    const dirs = await readdir(packagesRoot);
    for (const name of [
      'foundation',
      'config',
      'tracing',
      'constrained-decoder',
      'grammar',
      'minmap',
      'detok',
      'templates',
      'context-optimization',
      'prompt-optimization',
      'session-artifacts',
      'tool-invocation'
    ]) {
      expect(dirs, name).toContain(name);
    }
  });

  it('keeps guidance-ts the single responsibility of @utk/constrained-decoder', async () => {
    const files = await collectSourceTs(packagesRoot);
    const declarations = files
      .filter((file) => file.endsWith('guidance-ts.d.ts'))
      .map((file) => path.relative(repoRoot, file))
      .sort();
    expect(declarations).toEqual(['packages/constrained-decoder/src/guidance-ts.d.ts']);

    const packageDirs = (await readdir(packagesRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
    const guidanceDependents: string[] = [];
    for (const dir of packageDirs) {
      if ('guidance-ts' in (await packageDependencies(dir.name))) guidanceDependents.push(dir.name);
    }
    expect(guidanceDependents).toEqual(['constrained-decoder']);
  });

  it('consolidates the nonEmptyChoices helper into one definition', async () => {
    const files = await collectSourceTs(packagesRoot);
    const definitions: string[] = [];
    for (const file of files) {
      if (/function nonEmptyChoices\b/.test(await readFile(file, 'utf8'))) {
        definitions.push(path.relative(repoRoot, file));
      }
    }
    expect(definitions).toEqual(['packages/constrained-decoder/src/invocationGrammar.ts']);
  });

  it('removes the duplicated grammar-file reader', async () => {
    const files = await collectSourceTs(packagesRoot);
    const offenders: string[] = [];
    for (const file of files) {
      if (/\breadPackGrammar\b/.test(await readFile(file, 'utf8'))) offenders.push(path.relative(repoRoot, file));
    }
    expect(offenders).toEqual([]);
  });

  it('keeps @utk/detok below core (no core back-edge; detok-mcp drops core)', async () => {
    const detokFiles = await collectSourceTs(path.join(packagesRoot, 'detok', 'src'));
    const backEdges = [];
    for (const file of detokFiles) {
      if ((await readFile(file, 'utf8')).includes("from '@utk/core'")) backEdges.push(path.relative(repoRoot, file));
    }
    expect(backEdges).toEqual([]);
    expect(Object.keys(await packageDependencies('detok-mcp'))).not.toContain('@utk/core');
  });

  it('keeps core free of the extracted use-case packages (no upward edges)', async () => {
    const coreFiles = await collectSourceTs(path.join(packagesRoot, 'core', 'src'));
    const upwardEdges: string[] = [];
    for (const file of coreFiles) {
      const src = await readFile(file, 'utf8');
      for (const pkg of ['@utk/context-optimization', '@utk/prompt-optimization', '@utk/session-artifacts', '@utk/tool-invocation']) {
        // The barrel re-exports the use-case packages as a compatibility facade; core runtime modules must not import them.
        if (!file.endsWith(`${path.sep}index.ts`) && src.includes(`from '${pkg}'`)) {
          upwardEdges.push(`${path.relative(repoRoot, file)} -> ${pkg}`);
        }
      }
    }
    expect(upwardEdges).toEqual([]);
  });
});
