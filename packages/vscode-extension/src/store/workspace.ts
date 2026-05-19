import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STORE_GITIGNORE = `/tools/*/observations/\n/routing-telemetry/\n/evals/results/\n/traces/\n/tmp/\n*.raw.json\n*.raw.txt\n*.raw.bin\n`;

export async function initializeWorkspaceStore(workspaceRoot: string): Promise<string> {
  const storageRoot = path.join(workspaceRoot, '.utk');
  await mkdir(storageRoot, { recursive: true });
  await Promise.all(['tools', 'routes', 'grammars', 'quarantine', 'routing-telemetry', 'evals/fixtures', 'evals/results', 'traces'].map((part) => mkdir(path.join(storageRoot, part), { recursive: true })));
  await ensureFile(path.join(storageRoot, '.gitignore'), STORE_GITIGNORE);
  return storageRoot;
}

export async function cleanupObservations(storageRoot: string, toolIds?: string[]): Promise<number> {
  let removed = 0;
  const toolsRoot = path.join(storageRoot, 'tools');
  for (const tool of await safeReadDir(toolsRoot)) {
    if (toolIds && !toolIds.includes(tool)) continue;
    const observations = path.join(toolsRoot, tool, 'observations');
    for (const observation of await safeReadDir(observations)) {
      await rm(path.join(observations, observation), { recursive: true, force: true });
      removed += 1;
    }
  }
  return removed;
}

export async function validateArtifacts(storageRoot: string): Promise<string[]> {
  const invalid: string[] = [];
  for (const file of await walk(storageRoot)) {
    if (!file.endsWith('.json')) continue;
    try {
      JSON.parse(await readFile(file, 'utf8'));
    } catch {
      invalid.push(file);
    }
  }
  return invalid;
}

export async function quarantineInvalidArtifacts(storageRoot: string): Promise<number> {
  const invalid = await validateArtifacts(storageRoot);
  const quarantineRoot = path.join(storageRoot, 'quarantine');
  await mkdir(quarantineRoot, { recursive: true });
  for (const file of invalid) {
    await rename(file, path.join(quarantineRoot, path.relative(storageRoot, file).replaceAll(path.sep, '__')));
  }
  return invalid.length;
}

export async function rebuildRoutes(storageRoot: string): Promise<void> {
  const routesRoot = path.join(storageRoot, 'routes');
  await mkdir(routesRoot, { recursive: true });
  await writeFile(path.join(routesRoot, 'index.json'), `${JSON.stringify({ routes: [] }, null, 2)}\n`, 'utf8');
  await writeFile(path.join(routesRoot, 'index.toon'), 'routes[]\n', 'utf8');
  await writeFile(path.join(routesRoot, 'index.min.toon'), 'routes[]\n', 'utf8');
}

export async function compactSchemaHistory(storageRoot: string): Promise<number> {
  let removed = 0;
  const toolsRoot = path.join(storageRoot, 'tools');
  for (const tool of await safeReadDir(toolsRoot)) {
    const history = path.join(toolsRoot, tool, 'history');
    const schemas = (await safeReadDir(history)).filter((file) => file.endsWith('.schema.json')).sort();
    const keep = schemas.at(-1);
    for (const schema of schemas) {
      if (schema === keep) continue;
      await rm(path.join(history, schema), { force: true });
      removed += 1;
    }
  }
  return removed;
}

async function walk(root: string): Promise<string[]> {
  const entries = await safeReadDir(root);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry);
    const children = await safeReadDir(full);
    if (children.length === 0) files.push(full);
    else files.push(...(await walk(full)));
  }
  return files;
}

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function ensureFile(filePath: string, contents: string): Promise<void> {
  try {
    await readFile(filePath, 'utf8');
  } catch {
    await writeFile(filePath, contents, 'utf8');
  }
}
