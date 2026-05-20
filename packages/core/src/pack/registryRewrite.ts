import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG_TOML } from '../config/config.js';
import type { PackToolDefinition } from './types.js';

export const PACK_BEGIN_PREFIX = '# utk-pack-begin:';
export const PACK_END_PREFIX = '# utk-pack-end:';

export async function addPackRegistryBlocks(workspaceRoot: string, packName: string, tools: PackToolDefinition[]): Promise<void> {
  const configPath = path.join(workspaceRoot, '.utk', 'config.toml');
  const original = await readConfigText(configPath);
  const cleaned = removeBlocksForPack(original, packName);
  const additions = tools.map((tool) => renderPackRegistryBlock(packName, tool)).join('');
  const next = ensureTrailingNewline(cleaned) + additions;
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, next, 'utf8');
}

export async function removePackRegistryBlocks(workspaceRoot: string, packName: string): Promise<void> {
  const configPath = path.join(workspaceRoot, '.utk', 'config.toml');
  const original = await readConfigText(configPath);
  const cleaned = removeBlocksForPack(original, packName);
  await writeFile(configPath, cleaned, 'utf8');
}

async function readConfigText(configPath: string): Promise<string> {
  try {
    return await readFile(configPath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return DEFAULT_CONFIG_TOML;
    throw error;
  }
}

export function renderPackRegistryBlock(packName: string, tool: PackToolDefinition): string {
  const toolHeader = tool.source.tool && typeof tool.source.tool === 'object' ? (tool.source.tool as Record<string, unknown>) : tool.source;
  const description = typeof toolHeader.description === 'string' ? toolHeader.description : undefined;
  const outputCache = tool.entry.output_cache ?? false;
  const bypassOnCache = tool.entry.bypass_on_cache ?? false;
  const curryFields = tool.entry.curry_fields ?? [];
  const structuredFields = readStructuredFields(tool.source.parameters);

  const lines: string[] = [];
  lines.push('');
  lines.push(`${PACK_BEGIN_PREFIX} ${packName}`);
  lines.push('[[tools.registry]]');
  lines.push(`tool = ${tomlString(tool.entry.id)}`);
  if (description !== undefined) lines.push(`description = ${tomlString(description)}`);
  lines.push(`output_cache = ${outputCache}`);
  lines.push(`bypass_on_cache = ${bypassOnCache}`);
  lines.push(`curry_fields = ${tomlStringArray(curryFields)}`);
  for (const field of structuredFields) {
    lines.push('[[tools.registry.structured_fields]]');
    lines.push(`name = ${tomlString(field.name)}`);
    lines.push(`completions = ${tomlStringArray(field.completions)}`);
    if (field.required !== undefined) lines.push(`required = ${field.required}`);
    if (field.description !== undefined) lines.push(`description = ${tomlString(field.description)}`);
  }
  lines.push(`${PACK_END_PREFIX} ${packName}`);
  lines.push('');
  return lines.join('\n');
}

export function removeBlocksForPack(text: string, packName: string): string {
  const beginMarker = `${PACK_BEGIN_PREFIX} ${packName}`;
  const endMarker = `${PACK_END_PREFIX} ${packName}`;
  const lines = text.split('\n');
  const keep: string[] = [];
  let skipping = false;
  let beginLine = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const trimmed = line.trim();
    if (!skipping && trimmed === beginMarker) {
      skipping = true;
      beginLine = i;
      while (keep.length > 0 && keep[keep.length - 1]!.trim() === '') {
        keep.pop();
      }
      continue;
    }
    if (skipping) {
      if (trimmed === endMarker) {
        skipping = false;
        beginLine = -1;
      }
      continue;
    }
    keep.push(line);
  }
  if (skipping) {
    throw new Error(
      `Refusing to rewrite .utk/config.toml: pack block opened at line ${beginLine + 1} ('${beginMarker}') has no matching '${endMarker}'. ` +
      `Restore the trailing marker (or remove the orphaned begin marker by hand) before retrying.`
    );
  }
  return keep.join('\n');
}

function readStructuredFields(value: unknown): Array<{ name: string; completions: string[]; required?: boolean; description?: string }> {
  if (!Array.isArray(value)) return [];
  const fields: Array<{ name: string; completions: string[]; required?: boolean; description?: string }> = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const name = typeof obj.name === 'string' ? obj.name : undefined;
    if (!name) continue;
    const completions = Array.isArray(obj.completions) ? obj.completions.filter((entry): entry is string => typeof entry === 'string') : [];
    const field: { name: string; completions: string[]; required?: boolean; description?: string } = {
      name,
      completions
    };
    if (typeof obj.required === 'boolean') field.required = obj.required;
    if (typeof obj.description === 'string') field.description = obj.description;
    fields.push(field);
  }
  return fields;
}

function ensureTrailingNewline(text: string): string {
  if (text.length === 0) return '';
  return text.endsWith('\n') ? text : `${text}\n`;
}

function tomlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function tomlStringArray(values: string[]): string {
  return `[${values.map(tomlString).join(', ')}]`;
}
