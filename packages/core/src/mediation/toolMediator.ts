import { inspect } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { safeJoin } from '../security/pathSafety.js';
import { inferSchema, inferTextPseudoSchema } from '../schema/inferSchema.js';
import { schemaToToon, routeToToon } from '../toon/toon.js';
import { deterministicRoute } from '../router/router.js';
import { buildCompactResponse } from '../response/compactResponse.js';
import { extractRules } from '../rules/ruleEngine.js';
import { canonicalJson, contentHash } from '../artifact/canonical.js';
import { normalizeToolId, writeInputSchema, writeManifest } from '../artifact/manifest.js';
import { mergeSchema, type VersionedSchema } from '../schema/mergeSchema.js';
import { assertNoRawLeakage } from '../validation/leakage.js';
import { persistStream } from '../stream/persistStream.js';
import { upsertRouteIndex } from '../store/artifactStore.js';
import { loadUtkConfig, resolveSerializerProviderId } from '../config/config.js';
import { loadSerializationRegistry, serializedExtension } from '../serialization/providers.js';
import { compressTextWithLlmlingua2, rewriteInputForLlm } from '../detok/llmlingua2.js';
import { TAGS, endSpan, flushTrace, recordFailure, startSpan, type RunContext } from '../tracing/index.js';

export type ToolExecutor = (input: unknown) => Promise<unknown>;

export type MediatedResult = {
  response: string;
  schemaId: string;
  serializerId: string;
  rawPath: string;
  serializedPath: string;
};

export async function mediateToolExecution(params: {
  workspaceRoot: string;
  toolId: string;
  input: unknown;
  execute: ToolExecutor;
  tracer?: RunContext;
}): Promise<MediatedResult> {
  const { workspaceRoot, toolId, input, execute, tracer } = params;
  const normalizedToolId = normalizeToolId(toolId);
  const activeTracer = tracer?.enabled ? tracer : undefined;
  const runId = activeTracer?.runId ?? randomUUID();
  const rootSpan = activeTracer
    ? startSpan(activeTracer, {
        operationName: 'utk.mediate',
        runType: 'chain',
        tags: [
          TAGS.system('utk'),
          TAGS.spanKind('internal'),
          ...(activeTracer.captureInputs ? [TAGS.utkInputs(input)] : [])
        ]
      })
    : undefined;
  try {
    const result = await mediateToolExecutionInner(workspaceRoot, toolId, normalizedToolId, runId, input, execute, activeTracer, rootSpan);
    if (activeTracer && rootSpan) {
      endSpan(activeTracer, rootSpan, { tags: activeTracer.captureOutputs ? [TAGS.utkOutputs(result.response)] : [] });
    }
    return result;
  } catch (error) {
    if (activeTracer && rootSpan) endSpan(activeTracer, rootSpan, { error: error as Error });
    throw error;
  } finally {
    if (activeTracer) {
      try {
        await flushTrace(activeTracer);
      } catch {
        // Tracing must be fail-open; a flush failure must not break the mediation result.
      }
    }
  }
}

async function mediateToolExecutionInner(
  workspaceRoot: string,
  toolId: string,
  normalizedToolId: string,
  runId: string,
  input: unknown,
  execute: ToolExecutor,
  tracer: RunContext | undefined,
  rootSpan: ReturnType<typeof startSpan> | undefined
): Promise<MediatedResult> {
  const config = await loadUtkConfig(workspaceRoot);
  const registry = await loadSerializationRegistry(workspaceRoot);
  const serializerId = resolveSerializerProviderId(config, normalizedToolId, registry);
  const serializer = registry.require(serializerId);

  const toolBase = safeJoin(workspaceRoot, '.utk', 'tools', normalizedToolId);
  const observationDir = safeJoin(toolBase, 'observations', runId);
  const historyDir = safeJoin(toolBase, 'history');
  await mkdir(observationDir, { recursive: true });
  await mkdir(historyDir, { recursive: true });
  await writeManifest(toolBase, toolId);
  await writeInputSchema(toolBase, input);

  const inputPath = safeJoin(observationDir, 'input.json');
  await writeFile(inputPath, canonicalJson(input), 'utf8');
  const detokInput = await rewriteInputForLlm(input, { tracer, parentSpan: rootSpan });
  if (detokInput.applied) {
    await writeFile(safeJoin(observationDir, 'input.detok.json'), canonicalJson({ input: detokInput.value, compression: detokInput.results }), 'utf8');
  }

  const toolSpan = tracer && rootSpan
    ? startSpan(tracer, {
        operationName: `tool.${normalizedToolId}`,
        runType: 'tool',
        parent: rootSpan,
        tags: tracer.captureInputs ? [TAGS.utkInputs(input)] : []
      })
    : undefined;
  let output: unknown;
  try {
    output = await execute(input);
  } catch (error) {
    if (tracer && toolSpan) endSpan(tracer, toolSpan, { error: error as Error });
    throw error;
  }
  if (tracer && toolSpan) {
    endSpan(tracer, toolSpan, { tags: tracer.captureOutputs ? [TAGS.utkOutputs(output)] : [] });
  }
  const { rawPath, schemaInput, rawBytes, hash } = await persistRawOutput(observationDir, output);
  const compactValue = compactSerializableValue(schemaInput);
  const serialized = serializer.serialize(compactValue, { toolId: normalizedToolId });
  const serializedPath = safeJoin(observationDir, `output.compact.${serializedExtension(serializerId, registry)}`);
  await writeFile(serializedPath, `${serialized}\n`, 'utf8');
  const serializedValidation = serializer.validate(compactValue, serialized, { toolId: normalizedToolId });
  await writeFile(safeJoin(observationDir, 'output.compact.validation.json'), canonicalJson(serializedValidation), 'utf8');

  const schema = typeof schemaInput === 'string' ? inferTextPseudoSchema(schemaInput) : inferSchema(schemaInput);
  const rules = extractRules(schema);
  const detokOutput = typeof schemaInput === 'string' ? await compressTextWithLlmlingua2(schemaInput, { tracer, parentSpan: rootSpan }) : undefined;
  const current = await readCurrentSchema(toolBase);
  const merge = mergeSchema(normalizedToolId, current, schema, rules);
  const schemaId = merge.schema.id;

  await writeFile(safeJoin(toolBase, 'output.current.schema.json'), canonicalJson(merge.schema.schema), 'utf8');
  await writeFile(safeJoin(toolBase, 'output.current.toon'), `${schemaToToon(merge.schema.schema)}\n`, 'utf8');
  await writeFile(safeJoin(toolBase, 'rules.json'), canonicalJson({ rules: merge.schema.rules }), 'utf8');
  await writeFile(safeJoin(toolBase, 'rules.toon'), `${schemaToToon({ rules })}\n`, 'utf8');
  await writeFile(safeJoin(historyDir, `${schemaId}.schema.json`), canonicalJson({ ...merge.schema, state: merge.action === 'new-version' ? 'candidate' : 'current' }), 'utf8');
  await writeFile(safeJoin(toolBase, 'schema.id'), schemaId, 'utf8');

  const envelope = {
    detectedType: detectType(output),
    byteCount: rawBytes,
    contentHash: hash,
    encoding: Buffer.isBuffer(output) ? 'binary' : 'utf-8',
    chunkMetadata: isReadable(output) ? (schemaInput as Record<string, unknown>).chunkMetadata : null,
    fileReferences: [path.basename(rawPath)]
  };

  await writeFile(safeJoin(observationDir, 'output.envelope.json'), canonicalJson(envelope), 'utf8');
  await writeFile(safeJoin(observationDir, 'output.summary.json'), canonicalJson(summaryOf(schemaInput)), 'utf8');
  if (detokOutput?.applied) {
    await writeFile(safeJoin(observationDir, 'output.detok.txt'), detokOutput.compressedText, 'utf8');
    await writeFile(safeJoin(observationDir, 'output.detok.json'), canonicalJson(detokOutput), 'utf8');
  }
  await writeFile(safeJoin(observationDir, 'output.schema.json'), canonicalJson(merge.schema.schema), 'utf8');
  await writeFile(safeJoin(observationDir, 'output.schema.toon'), `${schemaToToon(merge.schema.schema)}\n`, 'utf8');
  await writeFile(safeJoin(observationDir, 'metadata.json'), canonicalJson({ runId, schemaId, schemaMerge: merge.reason }), 'utf8');

  const route = deterministicRoute([schemaId], contentHash(input));
  await writeFile(safeJoin(toolBase, 'route.json'), canonicalJson(route), 'utf8');
  await writeFile(safeJoin(toolBase, 'route.toon'), `${routeToToon(route.schema, route.confidence, route.reason)}\n`, 'utf8');
  await upsertRouteIndex(safeJoin(workspaceRoot, '.utk'), { schema: schemaId, confidence: 0.95, reason: 'tool_match' }, normalizedToolId);

  const response = buildCompactResponse(path.relative(workspaceRoot, rawPath), route.schema, route.confidence, serializerId, path.relative(workspaceRoot, serializedPath));
  if (typeof output === 'string') {
    assertNoRawLeakage(response, output);
  }

  return {
    response,
    schemaId,
    serializerId,
    rawPath,
    serializedPath
  };
}

function compactSerializableValue(value: unknown): unknown {
  return compactSummaryOf(value);
}

function compactSummaryOf(value: unknown): Record<string, unknown> {
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

async function persistRawOutput(observationDir: string, output: unknown): Promise<{ rawPath: string; schemaInput: unknown; rawBytes: number; hash: string }> {
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

function trySerializeJson(output: unknown): string | undefined {
  try {
    const json = JSON.stringify(output, null, 2);
    return json === undefined ? undefined : `${json}\n`;
  } catch {
    return undefined;
  }
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
  if (isReadable(value)) return 'stream';
  if (Buffer.isBuffer(value)) return 'binary';
  if (typeof value === 'string') return 'text';
  if (Array.isArray(value)) return 'array';
  if (value && typeof value === 'object') return 'object';
  return typeof value;
}

async function readCurrentSchema(toolBase: string): Promise<VersionedSchema | undefined> {
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

function isReadable(value: unknown): value is Readable {
  return value instanceof Readable;
}
