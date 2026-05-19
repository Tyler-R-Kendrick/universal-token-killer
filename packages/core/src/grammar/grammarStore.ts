import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { canonicalJson } from '../artifact/canonical.js';
import { normalizeToolId } from '../artifact/manifest.js';
import { safeJoin } from '../security/pathSafety.js';
import { type FieldGrammar, inferFieldGrammar, mergeFieldGrammar } from './fieldGrammar.js';

const STORAGE_ROOT = '.utk';

export function fieldGrammarPath(workspaceRoot: string, toolId: string, fieldName: string): string {
  const normalizedToolId = normalizeToolId(toolId);
  const safeField = normalizeToolId(fieldName);
  return safeJoin(workspaceRoot, STORAGE_ROOT, 'tools', normalizedToolId, 'fields', `${safeField}.grammar.json`);
}

export async function loadFieldGrammar(
  workspaceRoot: string,
  toolId: string,
  fieldName: string
): Promise<FieldGrammar | undefined> {
  try {
    const text = await readFile(fieldGrammarPath(workspaceRoot, toolId, fieldName), 'utf8');
    const parsed = JSON.parse(text) as FieldGrammar;
    if (typeof parsed.observations !== 'number') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export async function recordFieldObservation(
  workspaceRoot: string,
  toolId: string,
  fieldName: string,
  value: string
): Promise<FieldGrammar> {
  const observation = inferFieldGrammar(value);
  const current = await loadFieldGrammar(workspaceRoot, toolId, fieldName);
  const merged = mergeFieldGrammar(current, observation);
  const filePath = fieldGrammarPath(workspaceRoot, toolId, fieldName);
  const dirPath = safeJoin(workspaceRoot, STORAGE_ROOT, 'tools', normalizeToolId(toolId), 'fields');
  await mkdir(dirPath, { recursive: true });
  await writeFile(filePath, canonicalJson(merged), 'utf8');
  return merged;
}
