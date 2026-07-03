import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalJson, contentHash } from '@utk/foundation';
import { writeInputSchema, writeManifest } from '@utk/foundation';
import { deterministicRoute } from '../router/router.js';
import { buildCompactResponse } from '../response/compactResponse.js';
import { extractRules } from '../rules/ruleEngine.js';
import { inferSchema, inferTextPseudoSchema, type JsonSchema } from '../schema/inferSchema.js';
import { mergeSchema } from '../schema/mergeSchema.js';
import { safeJoin } from '@utk/foundation';
import { upsertRouteIndex } from '../store/artifactStore.js';
import { routeToToon, schemaToToon } from '../toon/toon.js';
import { serializedExtension } from '../serialization/providers.js';
import type { SerializationProvider, SerializationRegistry } from '../serialization/serializationTypes.js';
import {
  detectType,
  readCurrentSchema,
  summaryOf
} from './toolOutputPersistence.js';

export type MediationArtifactPaths = {
  toolBase: string;
  observationDir: string;
  historyDir: string;
};

export async function prepareMediationArtifacts(params: {
  workspaceRoot: string;
  normalizedToolId: string;
  runId: string;
  toolId: string;
  input: unknown;
}): Promise<MediationArtifactPaths> {
  const toolBase = safeJoin(params.workspaceRoot, '.utk', 'tools', params.normalizedToolId);
  const observationDir = safeJoin(toolBase, 'observations', params.runId);
  const historyDir = safeJoin(toolBase, 'history');
  await mkdir(observationDir, { recursive: true });
  await mkdir(historyDir, { recursive: true });
  await writeManifest(toolBase, params.toolId);
  await writeInputSchema(toolBase, params.input);
  await writeJson(observationDir, 'input.json', params.input);
  return { toolBase, observationDir, historyDir };
}

export async function persistDetokInput(observationDir: string, detokInput: { applied: boolean; value: unknown; results: unknown }): Promise<void> {
  if (!detokInput.applied) return;
  await writeJson(observationDir, 'input.detok.json', { input: detokInput.value, compression: detokInput.results });
}

export async function persistSerializedOutput(params: {
  observationDir: string;
  serializer: SerializationProvider;
  serializerId: string;
  registry: SerializationRegistry;
  normalizedToolId: string;
  compactValue: unknown;
}): Promise<string> {
  const serialized = params.serializer.serialize(params.compactValue, { toolId: params.normalizedToolId });
  const serializedPath = safeJoin(params.observationDir, `output.compact.${serializedExtension(params.serializerId, params.registry)}`);
  await writeFile(serializedPath, `${serialized}\n`, 'utf8');
  const validation = params.serializer.validate(params.compactValue, serialized, { toolId: params.normalizedToolId });
  await writeJson(params.observationDir, 'output.compact.validation.json', validation);
  return serializedPath;
}

export async function persistSchemaArtifacts(params: {
  toolBase: string;
  historyDir: string;
  normalizedToolId: string;
  schemaInput: unknown;
}): Promise<{ schemaId: string; schema: JsonSchema; reason: string }> {
  const schema = typeof params.schemaInput === 'string' ? inferTextPseudoSchema(params.schemaInput) : inferSchema(params.schemaInput);
  const rules = extractRules(schema);
  const current = await readCurrentSchema(params.toolBase);
  const merge = mergeSchema(params.normalizedToolId, current, schema, rules);
  const schemaId = merge.schema.id;

  await writeFile(safeJoin(params.toolBase, 'output.current.schema.json'), canonicalJson(merge.schema.schema), 'utf8');
  await writeFile(safeJoin(params.toolBase, 'output.current.toon'), `${schemaToToon(merge.schema.schema)}\n`, 'utf8');
  await writeJson(params.toolBase, 'rules.json', { rules: merge.schema.rules });
  await writeFile(safeJoin(params.toolBase, 'rules.toon'), `${schemaToToon({ rules })}\n`, 'utf8');
  await writeJson(params.historyDir, `${schemaId}.schema.json`, { ...merge.schema, state: merge.action === 'new-version' ? 'candidate' : 'current' });
  await writeFile(safeJoin(params.toolBase, 'schema.id'), schemaId, 'utf8');
  return { schemaId, schema: merge.schema.schema, reason: merge.reason };
}

export async function persistOutputObservationArtifacts(params: {
  observationDir: string;
  output: unknown;
  schemaInput: unknown;
  rawPath: string;
  rawBytes: number;
  hash: string;
  schema: JsonSchema;
  schemaId: string;
  mergeReason: string;
  runId: string;
  detokOutput?: { applied: boolean; compressedText: string } & Record<string, unknown>;
}): Promise<void> {
  const detectedType = detectType(params.output);
  const envelope = {
    detectedType,
    byteCount: params.rawBytes,
    contentHash: params.hash,
    encoding: Buffer.isBuffer(params.output) ? 'binary' : 'utf-8',
    chunkMetadata: detectedType === 'stream' ? (params.schemaInput as Record<string, unknown>).chunkMetadata : null,
    fileReferences: [path.basename(params.rawPath)]
  };

  await writeJson(params.observationDir, 'output.envelope.json', envelope);
  await writeJson(params.observationDir, 'output.summary.json', summaryOf(params.schemaInput));
  if (params.detokOutput?.applied) {
    await writeFile(safeJoin(params.observationDir, 'output.detok.txt'), params.detokOutput.compressedText, 'utf8');
    await writeJson(params.observationDir, 'output.detok.json', params.detokOutput);
  }
  await writeJson(params.observationDir, 'output.schema.json', params.schema);
  await writeFile(safeJoin(params.observationDir, 'output.schema.toon'), `${schemaToToon(params.schema)}\n`, 'utf8');
  await writeJson(params.observationDir, 'metadata.json', {
    runId: params.runId,
    schemaId: params.schemaId,
    schemaMerge: params.mergeReason
  });
}

export async function persistRouteArtifacts(params: {
  workspaceRoot: string;
  toolBase: string;
  normalizedToolId: string;
  schemaId: string;
  input: unknown;
  rawPath: string;
  serializedPath: string;
  serializerId: string;
}): Promise<string> {
  const route = deterministicRoute([params.schemaId], contentHash(params.input));
  await writeJson(params.toolBase, 'route.json', route);
  await writeFile(safeJoin(params.toolBase, 'route.toon'), `${routeToToon(route.schema, route.confidence, route.reason)}\n`, 'utf8');
  await upsertRouteIndex(safeJoin(params.workspaceRoot, '.utk'), { schema: params.schemaId, confidence: 0.95, reason: 'tool_match' }, params.normalizedToolId);
  return buildCompactResponse(
    path.relative(params.workspaceRoot, params.rawPath),
    route.schema,
    route.confidence,
    params.serializerId,
    path.relative(params.workspaceRoot, params.serializedPath)
  );
}

async function writeJson(root: string, name: string, value: unknown): Promise<void> {
  await writeFile(safeJoin(root, name), canonicalJson(value), 'utf8');
}
