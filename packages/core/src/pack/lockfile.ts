import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'smol-toml';
import { atomicWriteFile } from '../artifact/atomicWrite.js';
import type { InstalledPack } from './types.js';

export const LOCKFILE_SPEC = '2';

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
  // Atomic write — the lockfile is UTK's source of truth for installed packs and
  // must survive crashes mid-write. A torn file would make every subsequent
  // `utk pack list` / `add` / `remove` operation see corrupted state.
  await atomicWriteFile(lockPath, renderLockfile(packs));
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
    }
    for (const plugin of pack.plugins) {
      lines.push('[[packs.plugins]]');
      lines.push(`type = ${tomlString(plugin.type)}`);
      lines.push(`id = ${tomlString(plugin.id)}`);
      if (plugin.target !== undefined) lines.push(`target = ${tomlString(plugin.target)}`);
      if (plugin.larkHash !== undefined) lines.push(`lark_hash = ${tomlString(plugin.larkHash)}`);
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
  const pluginsRaw = Array.isArray(obj.plugins) ? obj.plugins : [];
  return {
    name: readString(obj.name, 'name'),
    version: readString(obj.version, 'version'),
    source: readString(obj.source, 'source'),
    revision: readString(obj.revision, 'revision'),
    contentHash: readString(obj.content_hash, 'content_hash'),
    installedAt: readString(obj.installed_at, 'installed_at'),
    tools: readStringArray(obj.tools),
    templates: readStringArray(obj.templates),
    grammars: grammarsRaw.map((entry) => normalizeLockGrammar(entry)),
    plugins: pluginsRaw.map((entry) => normalizeLockPlugin(entry))
  };
}

function normalizeLockGrammar(raw: unknown): InstalledPack['grammars'][number] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('packs.lock.toml grammars entry must be a table');
  }
  const obj = raw as Record<string, unknown>;
  return {
    tool: readString(obj.tool, 'tool'),
    field: readString(obj.field, 'field'),
    larkHash: readString(obj.lark_hash, 'lark_hash')
  };
}

function normalizeLockPlugin(raw: unknown): InstalledPack['plugins'][number] {
  if (!raw || typeof raw !== 'object') {
    throw new Error('packs.lock.toml plugins entry must be a table');
  }
  const obj = raw as Record<string, unknown>;
  const type = readString(obj.type, 'plugins.type');
  if (type !== 'serialization' && type !== 'agent') {
    throw new Error('packs.lock.toml plugins.type must be serialization or agent');
  }
  return {
    type,
    id: readString(obj.id, 'plugins.id'),
    ...(obj.target !== undefined ? { target: readString(obj.target, 'plugins.target') } : {}),
    ...(obj.lark_hash !== undefined ? { larkHash: readString(obj.lark_hash, 'plugins.lark_hash') } : {})
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
