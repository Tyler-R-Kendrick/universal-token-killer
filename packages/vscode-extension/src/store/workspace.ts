import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STORE_GITIGNORE = `/tools/*/observations/\n/routing-telemetry/\n/evals/results/\n/traces/\n/tmp/\n*.raw.json\n*.raw.txt\n*.raw.bin\n`;

export async function initializeWorkspaceStore(workspaceRoot: string): Promise<void> {
  const storageRoot = path.join(workspaceRoot, '.utk');
  await mkdir(storageRoot, { recursive: true });
  await mkdir(path.join(storageRoot, 'tools'), { recursive: true });
  await mkdir(path.join(storageRoot, 'routes'), { recursive: true });
  await mkdir(path.join(storageRoot, 'grammars'), { recursive: true });
  await writeFile(path.join(storageRoot, '.gitignore'), STORE_GITIGNORE, 'utf8');
}
