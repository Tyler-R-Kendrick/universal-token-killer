import { randomUUID } from 'node:crypto';
import { normalizeToolId } from '@utk/foundation';
import { assertNoRawLeakage } from '../validation/leakage.js';
import { loadUtkConfig, resolveSerializerProviderId } from '../config/config.js';
import { loadSerializationRegistry } from '../serialization/providers.js';
import { compressTextWithLlmlingua2, rewriteInputForLlm } from '../detok/llmlingua2.js';
import type { RunContext } from '../tracing/index.js';
import {
  compactSerializableValue,
  persistRawOutput
} from './toolOutputPersistence.js';
import {
  persistDetokInput,
  persistOutputObservationArtifacts,
  persistRouteArtifacts,
  persistSchemaArtifacts,
  persistSerializedOutput,
  prepareMediationArtifacts
} from './toolMediationArtifacts.js';
import {
  activeRunContext,
  endMediationSpan,
  flushMediationTrace,
  runToolWithTrace,
  startMediationSpan,
  type MediationSpan
} from './toolMediationTrace.js';

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
  const activeTracer = activeRunContext(tracer);
  const runId = activeTracer?.runId ?? randomUUID();
  const rootSpan = startMediationSpan(activeTracer, input);
  try {
    const result = await mediateToolExecutionInner({ workspaceRoot, toolId, normalizedToolId, runId, input, execute, tracer: activeTracer, rootSpan });
    endMediationSpan(activeTracer, rootSpan, { response: result.response });
    return result;
  } catch (error) {
    endMediationSpan(activeTracer, rootSpan, { error: error as Error });
    throw error;
  } finally {
    await flushMediationTrace(activeTracer);
  }
}

async function mediateToolExecutionInner(params: {
  workspaceRoot: string;
  toolId: string;
  normalizedToolId: string;
  runId: string;
  input: unknown;
  execute: ToolExecutor;
  tracer?: RunContext;
  rootSpan?: MediationSpan;
}): Promise<MediatedResult> {
  const config = await loadUtkConfig(params.workspaceRoot);
  const registry = await loadSerializationRegistry(params.workspaceRoot, config);
  const serializerId = resolveSerializerProviderId(config, params.normalizedToolId, registry);
  const serializer = registry.require(serializerId);
  const artifacts = await prepareMediationArtifacts(params);
  const detokInput = await rewriteInputForLlm(params.input, { tracer: params.tracer, parentSpan: params.rootSpan });
  await persistDetokInput(artifacts.observationDir, detokInput);

  const output = await runToolWithTrace(params);
  const { rawPath, schemaInput, rawBytes, hash } = await persistRawOutput(artifacts.observationDir, output);
  const compactValue = compactSerializableValue(schemaInput);
  const serializedPath = await persistSerializedOutput({
    observationDir: artifacts.observationDir,
    serializer,
    serializerId,
    registry,
    normalizedToolId: params.normalizedToolId,
    compactValue
  });
  const schema = await persistSchemaArtifacts({ ...artifacts, normalizedToolId: params.normalizedToolId, schemaInput });
  const detokOutput = typeof schemaInput === 'string'
    ? await compressTextWithLlmlingua2(schemaInput, { tracer: params.tracer, parentSpan: params.rootSpan })
    : undefined;
  await persistOutputObservationArtifacts({
    ...artifacts,
    output,
    schemaInput,
    rawPath,
    rawBytes,
    hash,
    schema: schema.schema,
    schemaId: schema.schemaId,
    mergeReason: schema.reason,
    runId: params.runId,
    detokOutput
  });
  const response = await persistRouteArtifacts({
    ...artifacts,
    workspaceRoot: params.workspaceRoot,
    normalizedToolId: params.normalizedToolId,
    schemaId: schema.schemaId,
    input: params.input,
    rawPath,
    serializedPath,
    serializerId
  });
  if (typeof output === 'string') {
    assertNoRawLeakage(response, output);
  }

  return {
    response,
    schemaId: schema.schemaId,
    serializerId,
    rawPath,
    serializedPath
  };
}
