import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile, safeJoin } from '@utk/foundation';

export const EMISSION_LEDGER_ENTRY_TYPES = ['macro-expansion', 'minmap-patch', 'emission-plan', 'constrained-emission'] as const;
export type EmissionLedgerEntryType = (typeof EMISSION_LEDGER_ENTRY_TYPES)[number];

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

/**
 * Ledger writes assume a single writer per workspace (the mediating hook
 * process); the whole-file atomic rewrite trades O(n) append cost for
 * crash-safety — a torn write can never corrupt existing entries.
 */
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
    if (
      typeof entry.seq !== 'number' ||
      !EMISSION_LEDGER_ENTRY_TYPES.includes(entry.type as EmissionLedgerEntryType) ||
      typeof entry.data !== 'object' ||
      entry.data === null
    ) {
      throw new Error('Emission ledger line is missing a valid seq, type, or data');
    }
    entries.push(entry as EmissionLedgerEntry);
  }
  return entries;
}
