import { readFile } from 'node:fs/promises';
import { safeJoin } from '../security/pathSafety.js';
import { pathExists } from './lintPackFiles.js';
import type { LintFinding } from './lintPackTypes.js';
import type { PackGrammarEntry } from './types.js';

export async function lintGrammarEntries(packDir: string, entries: PackGrammarEntry[], findings: LintFinding[]): Promise<void> {
  const seenPairs = new Set<string>();
  for (const entry of entries) {
    const pairKey = `${entry.tool}/${entry.field}`;
    if (seenPairs.has(pairKey)) {
      findings.push({ severity: 'error', code: 'pack/grammars/duplicate', message: `duplicate grammar ${pairKey}`, file: 'utk.pack.toml' });
    }
    seenPairs.add(pairKey);

    const larkRelative = entry.lark ?? `grammars/${entry.tool}/${entry.field}.lark`;
    await recordStrayGrammarJson(packDir, entry, larkRelative, findings);
    await lintLarkGrammar(packDir, larkRelative, pairKey, findings);
  }
}

async function recordStrayGrammarJson(packDir: string, entry: PackGrammarEntry, larkRelative: string, findings: LintFinding[]): Promise<void> {
  const strayJsonRelative = `grammars/${entry.tool}/${entry.field}.grammar.json`;
  if (!(await pathExists(safeJoin(packDir, strayJsonRelative)))) return;
  findings.push({
    severity: 'error',
    code: 'pack/grammars/json-not-supported',
    message: '.grammar.json sidecars are no longer supported; UTK persists field grammars as .lark only',
    file: strayJsonRelative,
    hint: `remove ${strayJsonRelative} and ship ${larkRelative} instead`
  });
}

async function lintLarkGrammar(packDir: string, larkRelative: string, pairKey: string, findings: LintFinding[]): Promise<void> {
  if (!(await pathExists(safeJoin(packDir, larkRelative)))) {
    findings.push({
      severity: 'error',
      code: 'pack/grammars/missing-lark',
      message: `grammar ${pairKey} has no Lark file`,
      file: larkRelative,
      hint: `expected ${larkRelative}`
    });
    return;
  }

  let lark: string;
  try {
    lark = await readFile(safeJoin(packDir, larkRelative), 'utf8');
  } catch (error) {
    findings.push({
      severity: 'error',
      code: 'pack/grammars/unreadable-lark',
      message: `failed to read Lark grammar: ${(error as Error).message}`,
      file: larkRelative
    });
    return;
  }
  if (!/^\s*start\s*:/m.test(lark)) {
    findings.push({ severity: 'error', code: 'pack/grammars/missing-start-rule', message: "Lark grammar lacks a 'start:' rule", file: larkRelative });
  }
}
