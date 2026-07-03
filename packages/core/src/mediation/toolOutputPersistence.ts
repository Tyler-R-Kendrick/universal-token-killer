import { inspect } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { canonicalJson, contentHash } from '@utk/foundation';
import { safeJoin } from '@utk/foundation';
import { persistStream } from '../stream/persistStream.js';
import type { VersionedSchema } from '../schema/mergeSchema.js';

export type PersistedRawOutput = {
  rawPath: string;
  schemaInput: unknown;
  rawBytes: number;
  hash: string;
};

export function compactSerializableValue(value: unknown): unknown {
  return compactSummaryOf(value);
}

export function compactSummaryOf(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    return { k: 'text', l: value.split(/\r?\n/).length, c: value.length };
  }

  if (Array.isArray(value)) {
    return { k: 'array', n: value.length };
  }

  if (value && typeof value === 'object') {
    return { k: 'object', keys: Object.keys(value as Record<string, unknown>).sort() };
  }

  return { k: typeof value };
}

export async function persistRawOutput(observationDir: string, output: unknown): Promise<PersistedRawOutput> {
  if (isReadable(output)) {
    const rawPath = safeJoin(observationDir, 'output.raw.bin');
    const persisted = await persistStream(output, rawPath);
    return {
      rawPath,
      schemaInput: { type: 'stream-envelope', chunkMetadata: persisted.chunks },
      rawBytes: persisted.byteCount,
      hash: persisted.contentHash
    };
  }

  if (Buffer.isBuffer(output)) {
    const rawPath = safeJoin(observationDir, 'output.raw.bin');
    await writeFile(rawPath, output);
    return { rawPath, schemaInput: { type: 'binary-envelope' }, rawBytes: output.byteLength, hash: contentHash(output) };
  }

  if (typeof output === 'string') {
    const rawPath = safeJoin(observationDir, 'output.raw.txt');
    await writeFile(rawPath, output, 'utf8');
    return { rawPath, schemaInput: output, rawBytes: Buffer.byteLength(output), hash: contentHash(output) };
  }

  const jsonText = trySerializeJson(output);
  if (!jsonText) {
    const text = `${inspect(output, { depth: 4, breakLength: 120 })}\n`;
    const rawPath = safeJoin(observationDir, 'output.raw.txt');
    await writeFile(rawPath, text, 'utf8');
    return { rawPath, schemaInput: text, rawBytes: Buffer.byteLength(text), hash: contentHash(text) };
  }

  const rawPath = safeJoin(observationDir, 'output.raw.json');
  await writeFile(rawPath, jsonText, 'utf8');
  return { rawPath, schemaInput: output, rawBytes: Buffer.byteLength(jsonText), hash: contentHash(jsonText) };
}

export function summaryOf(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    return { kind: 'text', lineCount: value.split(/\r?\n/).length, charCount: value.length };
  }

  if (Array.isArray(value)) {
    return { kind: 'array', length: value.length };
  }

  if (value && typeof value === 'object') {
    return { kind: 'object', keys: Object.keys(value as Record<string, unknown>).sort() };
  }

  return { kind: typeof value };
}

export function detectType(value: unknown): string {
  if (isReadable(value)) return 'stream';
  if (Buffer.isBuffer(value)) return 'binary';
  if (typeof value === 'string') return 'text';
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object') return 'object';
  return typeof value;
}

export async function readCurrentSchema(toolBase: string): Promise<VersionedSchema | undefined> {
  try {
    const id = (await readFile(safeJoin(toolBase, 'schema.id'), 'utf8')).trim();
    const schema = JSON.parse(await readFile(safeJoin(toolBase, 'output.current.schema.json'), 'utf8')) as Record<string, unknown>;
    const rulesEnvelope = JSON.parse(await readFile(safeJoin(toolBase, 'rules.json'), 'utf8')) as { rules?: unknown[] };
    const match = id.match(/\.v(\d+)\./);
    return {
      id,
      version: match ? Number(match[1]) : 1,
      state: 'current',
      schema,
      rules: rulesEnvelope.rules ?? []
    };
  } catch {
    return undefined;
  }
}

function trySerializeJson(output: unknown): string | undefined {
  try {
    const json = JSON.stringify(output, null, 2);
    return json === undefined ? undefined : `${json}\n`;
  } catch {
    return undefined;
  }
}

function isReadable(value: unknown): value is Readable {
  return value instanceof Readable;
}
