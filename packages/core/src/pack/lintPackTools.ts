import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import { safeJoin } from '@utk/foundation';
import type { LintFinding } from './lintPackTypes.js';
import type { PackToolEntry } from './types.js';

export async function lintToolEntries(packDir: string, entries: PackToolEntry[], findings: LintFinding[]): Promise<void> {
  const seenIds = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    if (seenIds.has(entry.id)) {
      findings.push({ severity: 'error', code: 'pack/tools/duplicate-id', message: `duplicate tool id: ${entry.id}`, file: 'utk.pack.toml' });
    }
    seenIds.add(entry.id);

    const relativePath = entry.file ?? `tools/${entry.id}.toml`;
    const parsed = await readToolFileForLint(packDir, relativePath, i, findings);
    if (!parsed) continue;

    lintToolShape(entry, relativePath, parsed, findings);
  }
}

async function readToolFileForLint(packDir: string, relativePath: string, entryIndex: number, findings: LintFinding[]): Promise<Record<string, unknown> | undefined> {
  const absolute = safeJoin(packDir, relativePath);
  let text: string;
  try {
    text = await readFile(absolute, 'utf8');
  } catch {
    findings.push({ severity: 'error', code: 'pack/tools/file-missing', message: 'tool definition file not found', file: relativePath, hint: `referenced by tools[${entryIndex}]` });
    return undefined;
  }

  try {
    return path.extname(absolute).toLowerCase() === '.json'
      ? (JSON.parse(text) as Record<string, unknown>)
      : (parse(text) as Record<string, unknown>);
  } catch (error) {
    findings.push({ severity: 'error', code: 'pack/tools/parse', message: `tool file is not parseable: ${(error as Error).message}`, file: relativePath });
    return undefined;
  }
}

function lintToolShape(entry: PackToolEntry, relativePath: string, parsed: Record<string, unknown>, findings: LintFinding[]): void {
  const toolHeader = parsed.tool && typeof parsed.tool === 'object' ? (parsed.tool as Record<string, unknown>) : undefined;
  const declaredId = toolHeader && typeof toolHeader.id === 'string' ? toolHeader.id : undefined;
  if (declaredId && declaredId !== entry.id) {
    findings.push({ severity: 'error', code: 'pack/tools/id-mismatch', message: `manifest declares tool id '${entry.id}' but file declares '${declaredId}'`, file: relativePath });
  }
  if (entry.kind === 'bash-like') {
    const command = toolHeader && typeof toolHeader.command === 'string' ? toolHeader.command : undefined;
    if (!command) {
      findings.push({ severity: 'error', code: 'pack/tools/bash-missing-command', message: `bash-like tool '${entry.id}' must declare a [tool] command`, file: relativePath });
    }
  }
  const parameters = Array.isArray(parsed.parameters) ? parsed.parameters : [];
  if (parameters.length === 0) {
    findings.push({ severity: 'warning', code: 'pack/tools/empty-parameters', message: `tool '${entry.id}' declares no parameters`, file: relativePath });
  }
}
