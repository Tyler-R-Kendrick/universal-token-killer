import type {
  PackGrammarEntry,
  PackPluginEntry,
  PackTemplateEntry,
  PackToolEntry,
  UtkPackManifest
} from './types.js';

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
  if (obj.lexical_aliases !== undefined) entry.lexical_aliases = readStringArray(obj.lexical_aliases, `tools[${index}].lexical_aliases`);
  if (obj.lexical_regexes !== undefined) entry.lexical_regexes = readStringArray(obj.lexical_regexes, `tools[${index}].lexical_regexes`);
  if (obj.bypass_on_match !== undefined) entry.bypass_on_match = readBoolean(obj.bypass_on_match, `tools[${index}].bypass_on_match`);
  if (obj.default_args !== undefined) entry.default_args = readObject(obj.default_args, `tools[${index}].default_args`);
  return entry;
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

function readBoolean(value: unknown, name: string): boolean {
  if (typeof value === 'boolean') return value;
  throw new Error(`${name} must be a boolean`);
}

function readStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${name} must be an array of strings`);
  }
  return [...value as string[]];
}
