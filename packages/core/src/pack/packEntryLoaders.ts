import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import { contentHash } from '../artifact/canonical.js';
import { safeJoin } from '../security/pathSafety.js';
import type {
  PackGrammarEntry,
  PackGrammarRecord,
  PackPluginEntry,
  PackPluginRecord,
  PackTemplateEntry,
  PackTemplateRecord,
  PackToolDefinition,
  PackToolEntry
} from './types.js';

export async function loadPackTools(packDir: string, entries: PackToolEntry[]): Promise<PackToolDefinition[]> {
  const results: PackToolDefinition[] = [];
  for (const entry of entries) {
    const filePath = safeJoin(packDir, entry.file ?? `tools/${entry.id}.toml`);
    const text = await readFile(filePath, 'utf8');
    const parsed = parseToolFile(filePath, text);
    results.push({ entry, source: parsed });
  }
  return results;
}

export function loadPackToolsSync(packDir: string, entries: PackToolEntry[]): PackToolDefinition[] {
  const results: PackToolDefinition[] = [];
  for (const entry of entries) {
    const filePath = safeJoin(packDir, entry.file ?? `tools/${entry.id}.toml`);
    const text = readFileSync(filePath, 'utf8');
    const parsed = parseToolFile(filePath, text);
    results.push({ entry, source: parsed });
  }
  return results;
}

export async function loadPackGrammars(packDir: string, entries: PackGrammarEntry[]): Promise<PackGrammarRecord[]> {
  const results: PackGrammarRecord[] = [];
  for (const entry of entries) {
    const larkPath = safeJoin(packDir, entry.lark ?? `grammars/${entry.tool}/${entry.field}.lark`);
    const lark = await readFile(larkPath, 'utf8');
    results.push({
      tool: entry.tool,
      field: entry.field,
      lark,
      larkHash: contentHash(lark, 16)
    });
  }
  return results;
}

export function loadPackGrammarsSync(packDir: string, entries: PackGrammarEntry[]): PackGrammarRecord[] {
  const results: PackGrammarRecord[] = [];
  for (const entry of entries) {
    const larkPath = safeJoin(packDir, entry.lark ?? `grammars/${entry.tool}/${entry.field}.lark`);
    const lark = readFileSync(larkPath, 'utf8');
    results.push({
      tool: entry.tool,
      field: entry.field,
      lark,
      larkHash: contentHash(lark, 16)
    });
  }
  return results;
}

export async function loadPackTemplates(packDir: string, entries: PackTemplateEntry[]): Promise<PackTemplateRecord[]> {
  const results: PackTemplateRecord[] = [];
  for (const entry of entries) {
    const filePath = safeJoin(packDir, entry.file);
    const source = await readFile(filePath, 'utf8');
    results.push({ entry, source });
  }
  return results;
}

export function loadPackTemplatesSync(packDir: string, entries: PackTemplateEntry[]): PackTemplateRecord[] {
  const results: PackTemplateRecord[] = [];
  for (const entry of entries) {
    const filePath = safeJoin(packDir, entry.file);
    const source = readFileSync(filePath, 'utf8');
    results.push({ entry, source });
  }
  return results;
}

export async function loadPackPlugins(packDir: string, entries: PackPluginEntry[]): Promise<PackPluginRecord[]> {
  const results: PackPluginRecord[] = [];
  for (const entry of entries) {
    if (entry.type === 'serialization') {
      const grammarPath = safeJoin(packDir, entry.grammar);
      let lark: string;
      try {
        lark = await readFile(grammarPath, 'utf8');
      } catch (error) {
        throw new Error(`Serializer plugin ${entry.id} grammar missing: ${entry.grammar}: ${String(error)}`);
      }
      results.push({ entry, grammar: { lark, larkHash: contentHash(lark, 16) } });
    } else {
      results.push({ entry });
    }
  }
  return results;
}

export function loadPackPluginsSync(packDir: string, entries: PackPluginEntry[]): PackPluginRecord[] {
  const results: PackPluginRecord[] = [];
  for (const entry of entries) {
    if (entry.type === 'serialization') {
      const grammarPath = safeJoin(packDir, entry.grammar);
      let lark: string;
      try {
        lark = readFileSync(grammarPath, 'utf8');
      } catch (error) {
        throw new Error(`Serializer plugin ${entry.id} grammar missing: ${entry.grammar}: ${String(error)}`);
      }
      results.push({ entry, grammar: { lark, larkHash: contentHash(lark, 16) } });
    } else {
      results.push({ entry });
    }
  }
  return results;
}

function parseToolFile(filePath: string, text: string): Record<string, unknown> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return JSON.parse(text) as Record<string, unknown>;
  }
  return parse(text) as Record<string, unknown>;
}
