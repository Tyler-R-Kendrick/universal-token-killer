import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile, safeJoin } from '@utk/core';

export type EmissionLedgerEntryType = 'macro-expansion' | 'minmap-patch' | 'emission-plan' | 'constrained-emission';

export type EmissionLedgerEntry = {
  seq: number;
  type: EmissionLedgerEntryType;
  data: Record<string, unknown>;
};

export type EmissionLedgerEntryInput = {
  type: EmissionLedgerEntryType;
  data: Record<string, unknown>;
};

export function emissionLedgerPath(workspaceRoot: string): string {
  return safeJoin(workspaceRoot, '.utk', 'emission', 'ledger.jsonl');
}

export async function appendEmissionLedgerEntry(
  workspaceRoot: string,
  input: EmissionLedgerEntryInput
): Promise<EmissionLedgerEntry> {
  const entries = await readEmissionLedger(workspaceRoot);
  const entry: EmissionLedgerEntry = { seq: entries.length + 1, type: input.type, data: input.data };
  const ledgerPath = emissionLedgerPath(workspaceRoot);
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  const lines = [...entries, entry].map((item) => JSON.stringify(item)).join('\n');
  await atomicWriteFile(ledgerPath, `${lines}\n`);
  return entry;
}

export async function readEmissionLedger(workspaceRoot: string): Promise<EmissionLedgerEntry[]> {
  let text: string;
  try {
    text = await readFile(emissionLedgerPath(workspaceRoot), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  const entries: EmissionLedgerEntry[] = [];
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(`Emission ledger line is not valid JSON: ${(error as Error).message}`);
    }
    const entry = parsed as Partial<EmissionLedgerEntry>;
    if (typeof entry.seq !== 'number' || typeof entry.type !== 'string' || typeof entry.data !== 'object' || entry.data === null) {
      throw new Error('Emission ledger line is missing seq, type, or data');
    }
    entries.push(entry as EmissionLedgerEntry);
  }
  return entries;
}
