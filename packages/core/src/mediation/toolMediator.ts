import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeJoin } from '../security/pathSafety.js';
import { inferSchema, inferTextPseudoSchema } from '../schema/inferSchema.js';
import { schemaToToon, routeToToon } from '../toon/toon.js';
import { deterministicRoute } from '../router/router.js';
import { buildCompactResponse } from '../response/compactResponse.js';
import { extractRules } from '../rules/ruleEngine.js';

export type ToolExecutor = (input: unknown) => Promise<unknown>;

export type MediatedResult = {
  response: string;
  schemaId: string;
  rawPath: string;
};

export async function mediateToolExecution(params: {
  workspaceRoot: string;
  toolId: string;
  input: unknown;
  execute: ToolExecutor;
}): Promise<MediatedResult> {
  const { workspaceRoot, toolId, input, execute } = params;
  const normalizedToolId = normalizeToolId(toolId);
  const runId = randomUUID();

  const toolBase = safeJoin(workspaceRoot, '.utk', 'tools', normalizedToolId);
  const observationDir = safeJoin(toolBase, 'observations', runId);
  const historyDir = safeJoin(toolBase, 'history');
  await mkdir(observationDir, { recursive: true });
  await mkdir(historyDir, { recursive: true });

  const inputPath = safeJoin(observationDir, 'input.json');
  await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, 'utf8');

  const output = await execute(input);
  const { rawPath, schemaInput, rawBytes, hash } = await persistRawOutput(observationDir, output);

  const schema = typeof schemaInput === 'string' ? inferTextPseudoSchema(schemaInput) : inferSchema(schemaInput);
  const rules = extractRules(schema);
  const schemaHash = shortHash(JSON.stringify({ schema, rules }));
  const schemaId = await nextSchemaId(toolBase, normalizedToolId, schemaHash);

  await writeFile(safeJoin(toolBase, 'output.current.schema.json'), `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
  await writeFile(safeJoin(toolBase, 'output.current.toon'), `${schemaToToon(schema)}\n`, 'utf8');
  await writeFile(safeJoin(toolBase, 'rules.json'), `${JSON.stringify({ rules }, null, 2)}\n`, 'utf8');
  await writeFile(safeJoin(toolBase, 'rules.toon'), `${schemaToToon({ rules })}\n`, 'utf8');
  await writeFile(safeJoin(historyDir, `${schemaId}.schema.json`), `${JSON.stringify(schema, null, 2)}\n`, 'utf8');

  const envelope = {
    detectedType: detectType(output),
    byteCount: rawBytes,
    contentHash: hash,
    encoding: Buffer.isBuffer(output) ? 'binary' : 'utf-8',
    chunkMetadata: null,
    fileReferences: [path.basename(rawPath)]
  };

  await writeFile(safeJoin(observationDir, 'output.envelope.json'), `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
  await writeFile(safeJoin(observationDir, 'output.summary.json'), `${JSON.stringify(summaryOf(schemaInput), null, 2)}\n`, 'utf8');
  await writeFile(safeJoin(observationDir, 'output.schema.json'), `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
  await writeFile(safeJoin(observationDir, 'output.schema.toon'), `${schemaToToon(schema)}\n`, 'utf8');
  await writeFile(safeJoin(observationDir, 'metadata.json'), `${JSON.stringify({ runId, schemaId }, null, 2)}\n`, 'utf8');

  const route = deterministicRoute([schemaId], shortHash(JSON.stringify(input)));
  await writeFile(safeJoin(toolBase, 'route.json'), `${JSON.stringify(route, null, 2)}\n`, 'utf8');
  await writeFile(safeJoin(toolBase, 'route.toon'), `${routeToToon(route.schema, route.confidence, route.reason)}\n`, 'utf8');

  return {
    response: buildCompactResponse(path.relative(workspaceRoot, rawPath), route.schema, route.confidence),
    schemaId,
    rawPath
  };
}

async function persistRawOutput(observationDir: string, output: unknown): Promise<{ rawPath: string; schemaInput: unknown; rawBytes: number; hash: string }> {
  if (Buffer.isBuffer(output)) {
    const rawPath = safeJoin(observationDir, 'output.raw.bin');
    await writeFile(rawPath, output);
    return { rawPath, schemaInput: { type: 'binary-envelope' }, rawBytes: output.byteLength, hash: shortHash(output) };
  }

  if (typeof output === 'string') {
    const rawPath = safeJoin(observationDir, 'output.raw.txt');
    await writeFile(rawPath, output, 'utf8');
    return { rawPath, schemaInput: output, rawBytes: Buffer.byteLength(output), hash: shortHash(output) };
  }

  const jsonText = `${JSON.stringify(output, null, 2)}\n`;
  const rawPath = safeJoin(observationDir, 'output.raw.json');
  await writeFile(rawPath, jsonText, 'utf8');
  return { rawPath, schemaInput: output, rawBytes: Buffer.byteLength(jsonText), hash: shortHash(jsonText) };
}

function summaryOf(value: unknown): Record<string, unknown> {
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

function detectType(value: unknown): string {
  if (Buffer.isBuffer(value)) return 'binary';
  if (typeof value === 'string') return 'text';
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object') return 'object';
  return typeof value;
}

function shortHash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 10);
}

function normalizeToolId(toolId: string): string {
  return toolId.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
}

async function nextSchemaId(toolBase: string, normalizedToolId: string, hash: string): Promise<string> {
  const historyDir = safeJoin(toolBase, 'history');
  let version = 1;

  try {
    const files = await readdir(historyDir);
    const versions = files
      .map((file) => {
        const match = file.match(/\.v(\d+)\./);
        return match ? Number(match[1]) : 0;
      })
      .filter((item) => Number.isFinite(item));
    if (versions.length > 0) version = Math.max(...versions) + 1;
  } catch {
    // no-op
  }

  const schemaId = `${normalizedToolId}.v${version}.${hash}`;
  const previousPath = safeJoin(toolBase, 'schema.id');
  await writeFile(previousPath, schemaId, 'utf8');
  await readFile(previousPath, 'utf8');
  return schemaId;
}
