import { mkdir, writeFile } from 'node:fs/promises';
import { safeJoin } from '../security/pathSafety.js';
import { canonicalJson, contentHash } from './canonical.js';

export type ToolManifest = {
  id: string;
  normalizedId: string;
  mode: 'copilot-only';
  inputSchemaPath: string;
  outputSchemaPath: string;
};

export function normalizeToolId(toolId: string): string {
  return toolId.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'tool';
}

export function schemaIdFor(normalizedToolId: string, version: number, schema: unknown, rules: unknown): string {
  return `${normalizedToolId}.v${version}.${contentHash({ schema, rules })}`;
}

export async function writeManifest(toolBase: string, toolId: string): Promise<ToolManifest> {
  await mkdir(toolBase, { recursive: true });
  const normalizedId = normalizeToolId(toolId);
  const manifest: ToolManifest = {
    id: toolId,
    normalizedId,
    mode: 'copilot-only',
    inputSchemaPath: 'input.schema.json',
    outputSchemaPath: 'output.current.schema.json'
  };
  await writeFile(safeJoin(toolBase, 'manifest.json'), canonicalJson(manifest), 'utf8');
  return manifest;
}

export async function writeInputSchema(toolBase: string, input: unknown): Promise<void> {
  const schema = input && typeof input === 'object' ? { type: 'object', properties: Object.fromEntries(Object.keys(input as Record<string, unknown>).sort().map((key) => [key, {}])), additionalProperties: true } : {};
  await writeFile(safeJoin(toolBase, 'input.schema.json'), canonicalJson(schema), 'utf8');
}
