import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { safeJoin } from '@utk/foundation';

export type ArtifactReferenceRecord = {
  id: string;
  path: string;
  kind: string;
  route: string;
  schema?: string;
  relativePath?: string;
  hash: string;
  compactPath?: string;
  compactHash?: string;
  requestId?: string;
  sessionId?: string;
  messageId?: string;
  toolCallId?: string;
  blockId?: string;
  artifactId?: string;
  routeId?: string;
  schemaId?: string;
  rawHash?: string;
  lineOffsets?: number[];
  policyVersion?: string;
  lineCount?: number;
  tokenCount: number;
};

type JsonObject = Record<string, unknown>;

export async function findArtifactRecord(workspaceRoot: string, id: string): Promise<ArtifactReferenceRecord | undefined> {
  const records = await readArtifactRecords(workspaceRoot);
  return records.reverse().find((record) => record.id === id);
}

export async function readArtifactRecords(workspaceRoot: string): Promise<ArtifactReferenceRecord[]> {
  try {
    const indexPath = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'index.jsonl');
    const lines = (await readFile(indexPath, 'utf8')).split(/\r?\n/).filter(Boolean);
    return lines.map(parseArtifactReferenceRecord).filter((record): record is ArtifactReferenceRecord => record !== undefined);
  } catch {
    return [];
  }
}

export function ensureInside(workspaceRoot: string, filePath: string): string {
  const resolved = path.resolve(filePath);
  const root = path.resolve(workspaceRoot);
  if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) throw new Error('Path traversal blocked');
  return resolved;
}

export function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

export function validateArtifactId(id: string): void {
  if (!/^utkp?_[a-f0-9]{16}$/.test(id)) throw new Error('Invalid context artifact id');
}

export function lineOffsets(text: string): number[] {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') offsets.push(index + 1);
  }
  return offsets;
}

function parseArtifactReferenceRecord(line: string): ArtifactReferenceRecord | undefined {
  const parsed = parseJsonObject(line);
  if (!parsed) return undefined;
  const id = stringValue(parsed.id);
  const pathValue = stringValue(parsed.path);
  if (!id || !pathValue) return undefined;
  return {
    id,
    path: pathValue,
    kind: stringValue(parsed.kind) ?? '',
    route: stringValue(parsed.route) ?? '',
    schema: stringValue(parsed.schema),
    relativePath: stringValue(parsed.relativePath),
    hash: stringValue(parsed.hash) ?? '',
    compactPath: stringValue(parsed.compactPath),
    compactHash: stringValue(parsed.compactHash),
    requestId: stringValue(parsed.requestId),
    sessionId: stringValue(parsed.sessionId),
    messageId: stringValue(parsed.messageId),
    toolCallId: stringValue(parsed.toolCallId),
    blockId: stringValue(parsed.blockId),
    artifactId: stringValue(parsed.artifactId),
    routeId: stringValue(parsed.routeId),
    schemaId: stringValue(parsed.schemaId),
    rawHash: stringValue(parsed.rawHash),
    lineOffsets: numberArrayValue(parsed.lineOffsets),
    policyVersion: stringValue(parsed.policyVersion),
    lineCount: numberValue(parsed.lineCount),
    tokenCount: numberValue(parsed.tokenCount) ?? 0
  };
}

function parseJsonObject(text: string): JsonObject | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function numberArrayValue(value: unknown): number[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : undefined;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
