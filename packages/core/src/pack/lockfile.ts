import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import type { InstalledPack } from './types.js';

export const LOCKFILE_SPEC = '1';

export async function readLockfile(workspaceRoot: string): Promise<InstalledPack[]> {
  const lockPath = path.join(workspaceRoot, '.utk', 'packs.lock.toml');
  let text: string;
  try {
    text = await readFile(lockPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const raw = parse(text) as { spec?: string; packs?: unknown[] };
  if (raw.spec !== undefined && raw.spec !== LOCKFILE_SPEC) {
    throw new Error(`packs.lock.toml spec ${raw.spec} is incompatible with @utk/core (expected ${LOCKFILE_SPEC}); regenerate via 'utk pack add --force' or remove the lockfile`);
  }
  if (!Array.isArray(raw.packs)) return [];
  return raw.packs.map(normalizeLockEntry);
}

export async function writeLockfile(workspaceRoot: string, packs: InstalledPack[]): Promise<void> {
  const lockPath = path.join(workspaceRoot, '.utk', 'packs.lock.toml');
  await mkdir(path.dirname(lockPath), { recursive: true });
  await writeFile(lockPath, renderLockfile(packs), 'utf8');
}

export function renderLockfile(packs: InstalledPack[]): string {
  const lines: string[] = [];
  lines.push(`spec = "${LOCKFILE_SPEC}"`);
  for (const pack of packs) {
    lines.push('');
    lines.push('[[packs]]');
    lines.push(`name = ${tomlString(pack.name)}`);
    lines.push(`version = ${tomlString(pack.version)}`);
    lines.push(`source = ${tomlString(pack.source)}`);
    lines.push(`revision = ${tomlString(pack.revision)}`);
    lines.push(`content_hash = ${tomlString(pack.contentHash)}`);
    lines.push(`installed_at = ${tomlString(pack.installedAt)}`);
    lines.push(`tools = ${tomlStringArray(pack.tools)}`);
    lines.push(`templates = ${tomlStringArray(pack.templates)}`);
    for (const grammar of pack.grammars) {
      lines.push('[[packs.grammars]]');
      lines.push(`tool = ${tomlString(grammar.tool)}`);
      lines.push(`field = ${tomlString(grammar.field)}`);
      lines.push(`lark_hash = ${tomlString(grammar.larkHash)}`);
      lines.push(`seed_observations = ${grammar.seedObservations}`);
      lines.push(`seed_hash = ${grammar.seedHash !== null ? tomlString(grammar.seedHash) : '""'}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function normalizeLockEntry(raw: unknown): InstalledPack {
  if (!raw || typeof raw !== 'object') {
    throw new Error('packs.lock.toml entry must be a table');
  }
  const obj = raw as Record<string, unknown>;
  const grammarsRaw = Array.isArray(obj.grammars) ? obj.grammars : [];
  return {
    name: readString(obj.name, 'name'),
    version: readString(obj.version, 'version'),
    source: readString(obj.source, 'source'),
    revision: readString(obj.revision, 'revision'),
    contentHash: readString(obj.content_hash, 'content_hash'),
    installedAt: readString(obj.installed_at, 'installed_at'),
    tools: readStringArray(obj.tools),
    templates: readStringArray(obj.templates),
    grammars: grammarsRaw.map((entry) => normalizeLockGrammar(entry))
  };
}

function normalizeLockGrammar(raw: unknown): InstalledPack['grammars'][number] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('packs.lock.toml grammars entry must be a table');
  }
  const obj = raw as Record<string, unknown>;
  const seedHashValue = typeof obj.seed_hash === 'string' && obj.seed_hash.length > 0 ? obj.seed_hash : null;
  return {
    tool: readString(obj.tool, 'tool'),
    field: readString(obj.field, 'field'),
    larkHash: readString(obj.lark_hash, 'lark_hash'),
    seedObservations: typeof obj.seed_observations === 'number' ? obj.seed_observations : 0,
    seedHash: seedHashValue
  };
}

function readString(value: unknown, name: string): string {
  if (typeof value === 'string') return value;
  throw new Error(`packs.lock.toml ${name} must be a string`);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function tomlStringArray(values: string[]): string {
  return `[${values.map(tomlString).join(', ')}]`;
}
