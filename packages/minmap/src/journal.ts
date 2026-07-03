import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile, normalizeToolId, safeJoin } from '@utk/foundation';
import { createMinMap, minMapHash, parseMinMap, serializeMinMap, type MinMap } from './format.js';
import { applyMinMapPatch, parseMinMapPatch } from './patch.js';

export type MinMapJournalEntry = {
  seq: number;
  patch: string;
  hashAfter: string;
};

export function minMapPath(workspaceRoot: string, language: string): string {
  return safeJoin(workspaceRoot, '.utk', 'lang', normalizeToolId(language), 'minmap.json');
}

export function minMapJournalPath(workspaceRoot: string, language: string): string {
  return safeJoin(workspaceRoot, '.utk', 'lang', normalizeToolId(language), 'minmap.journal.jsonl');
}

export async function saveMinMap(workspaceRoot: string, map: MinMap): Promise<string> {
  const filePath = minMapPath(workspaceRoot, map.language);
  await mkdir(path.dirname(filePath), { recursive: true });
  await atomicWriteFile(filePath, serializeMinMap(map));
  return filePath;
}

export async function loadMinMap(workspaceRoot: string, language: string): Promise<MinMap> {
  try {
    return parseMinMap(await readFile(minMapPath(workspaceRoot, language), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createMinMap(language);
    }
    throw error;
  }
}

export async function appendMinMapPatch(workspaceRoot: string, language: string, patchText: string): Promise<MinMap> {
  const entries = await readJournal(workspaceRoot, language);
  const current = replayEntries(language, entries);
  const next = applyMinMapPatch(current, parseMinMapPatch(patchText));
  const entry: MinMapJournalEntry = {
    seq: entries.length + 1,
    patch: patchText,
    hashAfter: minMapHash(next)
  };
  const journalPath = minMapJournalPath(workspaceRoot, language);
  await mkdir(path.dirname(journalPath), { recursive: true });
  const lines = [...entries, entry].map((item) => JSON.stringify(item)).join('\n');
  await atomicWriteFile(journalPath, `${lines}\n`);
  await saveMinMap(workspaceRoot, next);
  return next;
}

export async function replayMinMapJournal(workspaceRoot: string, language: string): Promise<MinMap> {
  return replayEntries(language, await readJournal(workspaceRoot, language));
}

async function readJournal(workspaceRoot: string, language: string): Promise<MinMapJournalEntry[]> {
  let text: string;
  try {
    text = await readFile(minMapJournalPath(workspaceRoot, language), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const entries: MinMapJournalEntry[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(`Min-map journal line is not valid JSON: ${(error as Error).message}`);
    }
    const entry = parsed as Partial<MinMapJournalEntry>;
    if (typeof entry.seq !== 'number' || typeof entry.patch !== 'string' || typeof entry.hashAfter !== 'string') {
      throw new Error('Min-map journal line is missing seq, patch, or hashAfter');
    }
    entries.push(entry as MinMapJournalEntry);
  }
  return entries;
}

function replayEntries(language: string, entries: MinMapJournalEntry[]): MinMap {
  let map = createMinMap(language);
  for (const entry of entries) {
    map = applyMinMapPatch(map, parseMinMapPatch(entry.patch));
    if (minMapHash(map) !== entry.hashAfter) {
      throw new Error(`Min-map journal hash mismatch at seq ${entry.seq}`);
    }
  }
  return map;
}
