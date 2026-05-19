import { readFile, readdir, writeFile } from 'node:fs/promises';
import { safeJoin } from '../security/pathSafety.js';
import { canonicalJson } from '../artifact/canonical.js';
import type { VersionedSchema } from '../schema/mergeSchema.js';

export async function readSchemaHistory(toolBase: string): Promise<VersionedSchema[]> {
  const history = safeJoin(toolBase, 'history');
  const schemas: VersionedSchema[] = [];
  for (const file of await safeReadDir(history)) {
    if (!file.endsWith('.schema.json')) continue;
    const parsed = JSON.parse(await readFile(safeJoin(history, file), 'utf8')) as VersionedSchema;
    schemas.push(parsed);
  }
  return schemas.sort((a, b) => a.version - b.version || a.id.localeCompare(b.id));
}

export async function markSchemaValidated(toolBase: string, schemaId: string): Promise<void> {
  const history = safeJoin(toolBase, 'history');
  const schemaPath = safeJoin(history, `${schemaId}.schema.json`);
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as VersionedSchema;
  await writeFile(schemaPath, canonicalJson({ ...schema, state: 'validated' }), 'utf8');
}

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
