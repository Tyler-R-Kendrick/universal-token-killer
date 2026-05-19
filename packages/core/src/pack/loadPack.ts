import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import type { FieldGrammar } from '../grammar/fieldGrammar.js';
import { compileLark } from '../grammar/compileLark.js';
import { safeJoin } from '../security/pathSafety.js';
import { contentHash } from '../artifact/canonical.js';
import { recordFailure, type RunContext } from '../tracing/index.js';
import type {
  LoadedPack,
  PackGrammarEntry,
  PackGrammarRecord,
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

export async function loadPack(packDir: string, options: LoadPackOptions = {}): Promise<LoadedPack> {
  const manifest = await loadPackManifest(packDir, options);
  const tools = await loadPackTools(packDir, manifest.tools ?? []);
  const grammars = await loadPackGrammars(packDir, manifest.grammars ?? [], options);
  const templates = await loadPackTemplates(packDir, manifest.templates ?? []);
  return { manifest, rootDir: packDir, tools, grammars, templates };
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

function parseToolFile(filePath: string, text: string): Record<string, unknown> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return JSON.parse(text) as Record<string, unknown>;
  }
  return parse(text) as Record<string, unknown>;
}

async function loadPackGrammars(packDir: string, entries: PackGrammarEntry[], options: LoadPackOptions = {}): Promise<PackGrammarRecord[]> {
  const results: PackGrammarRecord[] = [];
  for (const entry of entries) {
    const larkPath = safeJoin(packDir, entry.lark ?? `grammars/${entry.tool}/${entry.field}.lark`);
    let seed: FieldGrammar | undefined;
    let seedHash: string | undefined;
    if (entry.seed !== undefined) {
      const seedPath = safeJoin(packDir, entry.seed);
      const seedText = await readFile(seedPath, 'utf8');
      seed = JSON.parse(seedText) as FieldGrammar;
      seedHash = contentHash(seed, 16);
    } else {
      const defaultSeedPath = safeJoin(packDir, `grammars/${entry.tool}/${entry.field}.grammar.json`);
      seed = await tryReadSeed(defaultSeedPath, options);
      if (seed) seedHash = contentHash(seed, 16);
    }
    let lark: string;
    try {
      lark = await readFile(larkPath, 'utf8');
    } catch (error) {
      if (!seed) {
        throw new Error(`Grammar ${entry.tool}/${entry.field} requires either a lark file or a seed observation`);
      }
      void error;
      lark = compileLark(seed);
    }
    const record: PackGrammarRecord = {
      tool: entry.tool,
      field: entry.field,
      lark,
      larkHash: contentHash(lark, 16)
    };
    if (seed) record.seed = seed;
    if (seedHash) record.seedHash = seedHash;
    results.push(record);
  }
  return results;
}

async function tryReadSeed(seedPath: string, options: LoadPackOptions = {}): Promise<FieldGrammar | undefined> {
  try {
    const text = await readFile(seedPath, 'utf8');
    return JSON.parse(text) as FieldGrammar;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      recordFailure(options.tracer, {
        name: 'pack.seed.parse',
        runType: 'parser',
        error: error as Error,
        extra: { seedPath }
      });
    }
    return undefined;
  }
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

function normalizeToolEntry(value: unknown, index: number): PackToolEntry {
  const obj = readObject(value, `tools[${index}]`);
  const id = readString(obj.id, `tools[${index}].id`);
  const kindRaw = readString(obj.kind, `tools[${index}].kind`);
  if (kindRaw !== 'bash-like' && kindRaw !== 'structured') {
    throw new Error(`tools[${index}].kind must be 'bash-like' or 'structured'`);
  }
  const entry: PackToolEntry = { id, kind: kindRaw };
  if (obj.file !== undefined) entry.file = readString(obj.file, `tools[${index}].file`);
  if (obj.output_cache !== undefined) entry.output_cache = Boolean(obj.output_cache);
  if (obj.bypass_on_cache !== undefined) entry.bypass_on_cache = Boolean(obj.bypass_on_cache);
  if (obj.curry_fields !== undefined) entry.curry_fields = readStringArray(obj.curry_fields, `tools[${index}].curry_fields`);
  return entry;
}

function normalizeGrammarEntry(value: unknown, index: number): PackGrammarEntry {
  const obj = readObject(value, `grammars[${index}]`);
  const entry: PackGrammarEntry = {
    tool: readString(obj.tool, `grammars[${index}].tool`),
    field: readString(obj.field, `grammars[${index}].field`)
  };
  if (obj.lark !== undefined) entry.lark = readString(obj.lark, `grammars[${index}].lark`);
  if (obj.seed !== undefined) entry.seed = readString(obj.seed, `grammars[${index}].seed`);
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
