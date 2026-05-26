import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import { safeJoin } from '../security/pathSafety.js';
import { contentHash } from '../artifact/canonical.js';
import { recordFailure, type RunContext } from '../tracing/index.js';
import type {
  LoadedPack,
  PackGrammarEntry,
  PackGrammarRecord,
  PackPluginEntry,
  PackPluginRecord,
  PackTemplateEntry,
  PackTemplateRecord,
  PackToolDefinition,
  PackToolEntry,
  UtkPackManifest
} from './types.js';

export type LoadPackOptions = { tracer?: RunContext };

export async function loadPackManifest(packDir: string, options: LoadPackOptions = {}): Promise<UtkPackManifest> {
  const manifestPath = safeJoin(packDir, 'utk.pack.toml');
  try {
    const text = await readFile(manifestPath, 'utf8');
    const raw = parse(text) as Record<string, unknown>;
    return normalizeManifest(raw);
  } catch (error) {
    recordFailure(options.tracer, {
      name: 'pack.manifest.parse',
      runType: 'parser',
      error: error as Error,
      extra: { manifestPath }
    });
    throw error;
  }
}

export function loadPackManifestSync(packDir: string): UtkPackManifest {
  const manifestPath = safeJoin(packDir, 'utk.pack.toml');
  const text = readFileSync(manifestPath, 'utf8');
  const raw = parse(text) as Record<string, unknown>;
  return normalizeManifest(raw);
}

export async function loadPack(packDir: string, options: LoadPackOptions = {}): Promise<LoadedPack> {
  const manifest = await loadPackManifest(packDir, options);
  const tools = await loadPackTools(packDir, manifest.tools ?? []);
  const grammars = await loadPackGrammars(packDir, manifest.grammars ?? []);
  const templates = await loadPackTemplates(packDir, manifest.templates ?? []);
  const plugins = await loadPackPlugins(packDir, manifest.plugins ?? []);
  return { manifest, rootDir: packDir, tools, grammars, templates, plugins };
}

export function loadPackSync(packDir: string): LoadedPack {
  const manifest = loadPackManifestSync(packDir);
  const tools = loadPackToolsSync(packDir, manifest.tools ?? []);
  const grammars = loadPackGrammarsSync(packDir, manifest.grammars ?? []);
  const templates = loadPackTemplatesSync(packDir, manifest.templates ?? []);
  const plugins = loadPackPluginsSync(packDir, manifest.plugins ?? []);
  return { manifest, rootDir: packDir, tools, grammars, templates, plugins };
}

export function normalizeManifest(raw: Record<string, unknown>): UtkPackManifest {
  const pack = readObject(raw.pack, 'pack');
  const name = readString(pack.name, 'pack.name');
  const version = readString(pack.version, 'pack.version');
  if (!/^[A-Za-z0-9._@/-]+$/.test(name)) {
    throw new Error(`Invalid pack name: ${name}`);
  }
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) {
    throw new Error(`Invalid pack version: ${version}`);
  }
  const manifest: UtkPackManifest = {
    pack: {
      name,
      version,
      ...(pack.description !== undefined ? { description: readString(pack.description, 'pack.description') } : {}),
      ...(pack.license !== undefined ? { license: readString(pack.license, 'pack.license') } : {}),
      ...(pack.authors !== undefined ? { authors: readStringArray(pack.authors, 'pack.authors') } : {}),
      ...(pack.homepage !== undefined ? { homepage: readString(pack.homepage, 'pack.homepage') } : {}),
      ...(pack.keywords !== undefined ? { keywords: readStringArray(pack.keywords, 'pack.keywords') } : {})
    }
  };
  if (raw.compatibility !== undefined) {
    const compat = readObject(raw.compatibility, 'compatibility');
    manifest.compatibility = {
      ...(compat.utk !== undefined ? { utk: readString(compat.utk, 'compatibility.utk') } : {}),
      ...(compat.pack_spec !== undefined ? { pack_spec: readString(compat.pack_spec, 'compatibility.pack_spec') } : {})
    };
  }
  if (raw.tools !== undefined) {
    manifest.tools = readArray(raw.tools, 'tools').map((entry, index) => normalizeToolEntry(entry, index));
  }
  if (raw.grammars !== undefined) {
    manifest.grammars = readArray(raw.grammars, 'grammars').map((entry, index) => normalizeGrammarEntry(entry, index));
  }
  if (raw.templates !== undefined) {
    manifest.templates = readArray(raw.templates, 'templates').map((entry, index) => normalizeTemplateEntry(entry, index));
  }
  if (raw.plugins !== undefined) {
    manifest.plugins = readArray(raw.plugins, 'plugins').map((entry, index) => normalizePluginEntry(entry, index));
  }
  return manifest;
}

async function loadPackTools(packDir: string, entries: PackToolEntry[]): Promise<PackToolDefinition[]> {
  const results: PackToolDefinition[] = [];
  for (const entry of entries) {
    const filePath = safeJoin(packDir, entry.file ?? `tools/${entry.id}.toml`);
    const text = await readFile(filePath, 'utf8');
    const parsed = parseToolFile(filePath, text);
    results.push({ entry, source: parsed });
  }
  return results;
}

function loadPackToolsSync(packDir: string, entries: PackToolEntry[]): PackToolDefinition[] {
  const results: PackToolDefinition[] = [];
  for (const entry of entries) {
    const filePath = safeJoin(packDir, entry.file ?? `tools/${entry.id}.toml`);
    const text = readFileSync(filePath, 'utf8');
    const parsed = parseToolFile(filePath, text);
    results.push({ entry, source: parsed });
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

async function loadPackGrammars(packDir: string, entries: PackGrammarEntry[]): Promise<PackGrammarRecord[]> {
  const results: PackGrammarRecord[] = [];
  for (const entry of entries) {
    const larkPath = safeJoin(packDir, entry.lark ?? `grammars/${entry.tool}/${entry.field}.lark`);
    // `.lark` is the only supported grammar format. Packs may not ship `.grammar.json` —
    // the FieldGrammar JSON sidecar was removed in favour of lark-only persistence.
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

function loadPackGrammarsSync(packDir: string, entries: PackGrammarEntry[]): PackGrammarRecord[] {
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

async function loadPackTemplates(packDir: string, entries: PackTemplateEntry[]): Promise<PackTemplateRecord[]> {
  const results: PackTemplateRecord[] = [];
  for (const entry of entries) {
    const filePath = safeJoin(packDir, entry.file);
    const source = await readFile(filePath, 'utf8');
    results.push({ entry, source });
  }
  return results;
}

function loadPackTemplatesSync(packDir: string, entries: PackTemplateEntry[]): PackTemplateRecord[] {
  const results: PackTemplateRecord[] = [];
  for (const entry of entries) {
    const filePath = safeJoin(packDir, entry.file);
    const source = readFileSync(filePath, 'utf8');
    results.push({ entry, source });
  }
  return results;
}

async function loadPackPlugins(packDir: string, entries: PackPluginEntry[]): Promise<PackPluginRecord[]> {
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

function loadPackPluginsSync(packDir: string, entries: PackPluginEntry[]): PackPluginRecord[] {
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

function normalizeToolEntry(value: unknown, index: number): PackToolEntry {
  const obj = readObject(value, `tools[${index}]`);
  const id = readString(obj.id, `tools[${index}].id`);
  const kindRaw = readString(obj.kind, `tools[${index}].kind`);
  if (kindRaw !== 'bash-like' && kindRaw !== 'structured') {
    throw new Error(`tools[${index}].kind must be 'bash-like' or 'structured'`);
  }
  const entry: PackToolEntry = { id, kind: kindRaw };
  if (obj.file !== undefined) entry.file = readString(obj.file, `tools[${index}].file`);
  if (obj.output_cache !== undefined) entry.output_cache = readBoolean(obj.output_cache, `tools[${index}].output_cache`);
  if (obj.bypass_on_cache !== undefined) entry.bypass_on_cache = readBoolean(obj.bypass_on_cache, `tools[${index}].bypass_on_cache`);
  if (obj.curry_fields !== undefined) entry.curry_fields = readStringArray(obj.curry_fields, `tools[${index}].curry_fields`);
  return entry;
}

function readBoolean(value: unknown, name: string): boolean {
  if (typeof value === 'boolean') return value;
  throw new Error(`${name} must be a boolean`);
}

function normalizeGrammarEntry(value: unknown, index: number): PackGrammarEntry {
  const obj = readObject(value, `grammars[${index}]`);
  if (obj.seed !== undefined) {
    throw new Error(`grammars[${index}].seed is no longer supported — UTK persists grammars as .lark only. Remove the seed field and ship a .lark file instead.`);
  }
  const entry: PackGrammarEntry = {
    tool: readString(obj.tool, `grammars[${index}].tool`),
    field: readString(obj.field, `grammars[${index}].field`)
  };
  if (obj.lark !== undefined) entry.lark = readString(obj.lark, `grammars[${index}].lark`);
  if (obj.description !== undefined) entry.description = readString(obj.description, `grammars[${index}].description`);
  return entry;
}

function normalizeTemplateEntry(value: unknown, index: number): PackTemplateEntry {
  const obj = readObject(value, `templates[${index}]`);
  const language = readString(obj.language, `templates[${index}].language`);
  if (language !== 'typescript' && language !== 'python') {
    throw new Error(`templates[${index}].language must be 'typescript' or 'python'`);
  }
  const entry: PackTemplateEntry = {
    id: readString(obj.id, `templates[${index}].id`),
    file: readString(obj.file, `templates[${index}].file`),
    language
  };
  if (obj.tool !== undefined) entry.tool = readString(obj.tool, `templates[${index}].tool`);
  return entry;
}

function normalizePluginEntry(value: unknown, index: number): PackPluginEntry {
  const obj = readObject(value, `plugins[${index}]`);
  const type = readString(obj.type, `plugins[${index}].type`);
  if (type === 'serialization') {
    if (obj.module !== undefined) {
      throw new Error(`plugins[${index}].module is not supported for serialization plugins`);
    }
    const semantics = readString(obj.semantics, `plugins[${index}].semantics`);
    if (semantics !== 'json-value-v1') {
      throw new Error(`plugins[${index}].semantics must be 'json-value-v1'`);
    }
    const entry: PackPluginEntry = {
      type,
      id: readString(obj.id, `plugins[${index}].id`),
      symbol: readString(obj.symbol, `plugins[${index}].symbol`),
      semantics,
      grammar: readString(obj.grammar, `plugins[${index}].grammar`),
      extension: readString(obj.extension, `plugins[${index}].extension`)
    };
    if (obj.aliases !== undefined) entry.aliases = readStringArray(obj.aliases, `plugins[${index}].aliases`);
    if (obj.canonical !== undefined) entry.canonical = readBoolean(obj.canonical, `plugins[${index}].canonical`);
    if (obj.config_fields !== undefined) entry.config_fields = readObject(obj.config_fields, `plugins[${index}].config_fields`);
    return entry;
  }
  if (type === 'agent') {
    const entry: PackPluginEntry = {
      type,
      id: readString(obj.id, `plugins[${index}].id`),
      target: readString(obj.target, `plugins[${index}].target`)
    };
    if (obj.path !== undefined) entry.path = readString(obj.path, `plugins[${index}].path`);
    if (obj.manifest !== undefined) entry.manifest = readString(obj.manifest, `plugins[${index}].manifest`);
    return entry;
  }
  throw new Error(`plugins[${index}].type must be 'serialization' or 'agent'`);
}

function readObject(value: unknown, name: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error(`${name} must be a TOML table`);
}

function readArray(value: unknown, name: string): unknown[] {
  if (Array.isArray(value)) return value;
  throw new Error(`${name} must be an array`);
}

function readString(value: unknown, name: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error(`${name} must be a non-empty string`);
}

function readStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be an array of strings`);
  }
  return [...value as string[]];
}
