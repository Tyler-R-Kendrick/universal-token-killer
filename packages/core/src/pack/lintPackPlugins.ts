import { readFile } from 'node:fs/promises';
import { safeJoin } from '@utk/foundation';
import type { PackPluginEntry } from './types.js';
import type { LintFinding } from './lintPackTypes.js';
import { pathExists } from './lintPackFiles.js';

export async function lintPluginEntries(packDir: string, entries: PackPluginEntry[], findings: LintFinding[]): Promise<void> {
  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    const key = `${entry.type}:${entry.id}`;
    if (seen.has(key)) {
      findings.push({ severity: 'error', code: 'pack/plugins/duplicate-id', message: `duplicate plugin ${key}`, file: 'utk.pack.toml' });
    }
    seen.add(key);
    if (entry.type === 'serialization') {
      await lintSerializationPluginEntry(packDir, entry, i, findings);
    } else {
      await lintAgentPluginEntry(packDir, entry, i, findings);
    }
  }
}

async function lintSerializationPluginEntry(
  packDir: string,
  entry: Extract<PackPluginEntry, { type: 'serialization' }>,
  entryIndex: number,
  findings: LintFinding[]
): Promise<void> {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(entry.id)) {
    findings.push({ severity: 'error', code: 'pack/plugins/invalid-id', message: `serialization plugin id is invalid: ${entry.id}`, file: 'utk.pack.toml' });
  }
  if (!/^[A-Z][A-Z0-9_]*$/.test(entry.symbol)) {
    findings.push({ severity: 'error', code: 'pack/plugins/invalid-symbol', message: `serialization plugin '${entry.id}' symbol is invalid: ${entry.symbol}`, file: 'utk.pack.toml' });
  }
  if (!entry.grammar.endsWith('.lark')) {
    findings.push({ severity: 'error', code: 'pack/plugins/grammar-format', message: `serialization plugin '${entry.id}' grammar must be a .lark file`, file: entry.grammar });
  }
  if (entry.semantics !== 'json-value-v1') {
    findings.push({ severity: 'error', code: 'pack/plugins/unsupported-semantics', message: `serialization plugin '${entry.id}' semantics must be json-value-v1`, file: 'utk.pack.toml' });
  }
  const grammarPath = safeJoin(packDir, entry.grammar);
  if (!(await pathExists(grammarPath))) {
    findings.push({ severity: 'error', code: 'pack/plugins/grammar-missing', message: 'serialization plugin grammar not found', file: entry.grammar, hint: `referenced by plugins[${entryIndex}]` });
    return;
  }
  const lark = await readPluginGrammar(grammarPath, entry, findings);
  if (lark === undefined) return;
  if (!/^\s*start\s*:/m.test(lark)) {
    findings.push({ severity: 'error', code: 'pack/plugins/grammar-missing-start-rule', message: `serialization plugin '${entry.id}' grammar lacks a 'start:' rule`, file: entry.grammar });
  }
  await lintSerializationPluginIndex(packDir, entry, findings);
}

async function readPluginGrammar(
  grammarPath: string,
  entry: Extract<PackPluginEntry, { type: 'serialization' }>,
  findings: LintFinding[]
): Promise<string | undefined> {
  try {
    return await readFile(grammarPath, 'utf8');
  } catch (error) {
    findings.push({
      severity: 'error',
      code: 'pack/plugins/grammar-read-failed',
      message: `failed to read plugin grammar '${entry.id}' at '${entry.grammar}': ${(error as Error).message}`,
      file: entry.grammar
    });
    return undefined;
  }
}

async function lintAgentPluginEntry(
  packDir: string,
  entry: Extract<PackPluginEntry, { type: 'agent' }>,
  entryIndex: number,
  findings: LintFinding[]
): Promise<void> {
  const pluginPath = entry.path ?? '.';
  if (!(await pathExists(safeJoin(packDir, pluginPath)))) {
    findings.push({ severity: 'error', code: 'pack/plugins/path-missing', message: 'agent plugin path not found', file: pluginPath, hint: `referenced by plugins[${entryIndex}]` });
  }
  if (entry.manifest !== undefined && !(await pathExists(safeJoin(packDir, entry.manifest)))) {
    findings.push({ severity: 'error', code: 'pack/plugins/manifest-missing', message: 'agent plugin manifest not found', file: entry.manifest, hint: `referenced by plugins[${entryIndex}]` });
  }
}

async function lintSerializationPluginIndex(packDir: string, entry: Extract<PackPluginEntry, { type: 'serialization' }>, findings: LintFinding[]): Promise<void> {
  let source: string | undefined;
  let relative = 'index.ts';
  for (const candidate of ['index.ts', 'index.js', 'index.mjs']) {
    try {
      relative = candidate;
      source = await readFile(safeJoin(packDir, candidate), 'utf8');
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        findings.push({ severity: 'error', code: 'pack/plugins/index-unreadable', message: `serialization plugin index cannot be read: ${(error as Error).message}`, file: candidate });
        return;
      }
    }
  }
  if (source === undefined) {
    findings.push({
      severity: 'error',
      code: 'pack/plugins/index-missing',
      message: `serialization plugin '${entry.id}' must export const ${entry.symbol} = '${entry.id}'`,
      file: relative
    });
    return;
  }
  const exportPattern = /^\s*export\s+const\s+([A-Z][A-Z0-9_]*)\s*=\s*(['"])([^'"]+)\2\s*(?:as\s+const)?\s*;\s*$/;
  let found = false;
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('//')) continue;
    const match = exportPattern.exec(line);
    if (!match) {
      findings.push({
        severity: 'error',
        code: 'pack/plugins/index-executable',
        message: `serialization plugin '${entry.id}' index must contain data-only const exports`,
        file: relative
      });
      return;
    }
    if (match[1] === entry.symbol && match[3] === entry.id) found = true;
  }
  if (!found) {
    findings.push({
      severity: 'error',
      code: 'pack/plugins/index-symbol-missing',
      message: `serialization plugin '${entry.id}' index must export const ${entry.symbol} = '${entry.id}'`,
      file: relative
    });
  }
}
