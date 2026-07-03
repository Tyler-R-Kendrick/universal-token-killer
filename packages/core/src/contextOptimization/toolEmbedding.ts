import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { contentHash } from '@utk/foundation';
import type { UtkConfig } from '../config/config.js';
import { safeJoin } from '@utk/foundation';
import { DEFAULT_LOCAL_TOOL_EMBEDDING_PROVIDER_ADAPTERS } from './openAiCompatibleToolEmbedding.js';
import type {
  LocalToolEmbeddingProbe,
  LocalToolEmbeddingProvider,
  LocalToolEmbeddingProviderAdapterEntry
} from './toolEmbeddingProvider.js';

export {
  createLocalToolEmbeddingProviderAdapter,
  type LocalToolEmbeddingProbe,
  type LocalToolEmbeddingProvider,
  type LocalToolEmbeddingProviderAdapter,
  type LocalToolEmbeddingProviderAdapterEntry,
  type ToolMatchingEmbeddingConfig
} from './toolEmbeddingProvider.js';
export {
  DEFAULT_LOCAL_TOOL_EMBEDDING_PROVIDER_ADAPTERS,
  createOpenAiCompatibleLocalToolEmbeddingProvider,
  createOpenAiCompatibleLocalToolEmbeddingProviderAdapter,
  type LlamaServerEmbeddingProviderOptions,
  type OllamaEmbeddingProviderOptions,
  type OpenAiCompatibleEmbeddingOptions,
  type OpenAiCompatibleEmbeddingProviderOptions,
  type OpenAiCompatibleLocalEmbeddingProviderOptions
} from './openAiCompatibleToolEmbedding.js';

export type ToolEmbeddingCandidate = {
  name: string;
  text: string;
};

export function createLocalToolEmbeddingProviders(
  config: UtkConfig['tool_matching'],
  adapters: readonly LocalToolEmbeddingProviderAdapterEntry[] = DEFAULT_LOCAL_TOOL_EMBEDDING_PROVIDER_ADAPTERS
): LocalToolEmbeddingProvider[] {
  const adaptersById = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  return config.providers.flatMap((id) => {
    const provider = adaptersById.get(id)?.createFromConfig(config);
    return provider ? [provider] : [];
  });
}

export function createDefaultLocalToolEmbeddingProviders(config: UtkConfig['tool_matching']): LocalToolEmbeddingProvider[] {
  return createLocalToolEmbeddingProviders(config);
}

export async function resolveLocalToolEmbeddingProvider(
  config: UtkConfig['tool_matching'],
  providerOverride?: LocalToolEmbeddingProvider,
  providersOverride?: LocalToolEmbeddingProvider[],
  providerAdapters?: readonly LocalToolEmbeddingProviderAdapterEntry[]
): Promise<LocalToolEmbeddingProvider | undefined> {
  if (providerOverride) return (await safeProbe(providerOverride)).available ? providerOverride : undefined;
  return resolveAvailableLocalToolEmbeddingProvider(providersOverride ?? createLocalToolEmbeddingProviders(config, providerAdapters));
}

export async function resolveAvailableLocalToolEmbeddingProvider(providers: LocalToolEmbeddingProvider[]): Promise<LocalToolEmbeddingProvider | undefined> {
  for (const provider of providers) {
    if ((await safeProbe(provider)).available) return provider;
  }
  return undefined;
}

export async function cachedToolEmbeddings(
  workspaceRoot: string,
  provider: LocalToolEmbeddingProvider,
  candidates: ToolEmbeddingCandidate[],
  cacheEnabled: boolean
): Promise<Map<string, number[]>> {
  const cachePath = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'tool-embeddings.json');
  const cacheKey = `${provider.id}:${provider.model}:${contentHash(JSON.stringify(candidates.map((candidate) => [candidate.name, candidate.text])), 16)}`;
  const cache = cacheEnabled ? await readJsonObject(cachePath) : {};
  const cached = isObject(cache[cacheKey]) ? cache[cacheKey] as Record<string, unknown> : {};
  const result = new Map<string, number[]>();
  const missing: ToolEmbeddingCandidate[] = [];

  for (const candidate of candidates) {
    const embedding = cached[candidate.name];
    if (isEmbedding(embedding)) result.set(candidate.name, embedding);
    else missing.push(candidate);
  }

  if (missing.length === 0) return result;

  const embeddings = await provider.embed(missing.map((candidate) => candidate.text));
  for (let index = 0; index < missing.length; index += 1) {
    const candidate = missing[index];
    const embedding = embeddings[index];
    if (!candidate || !embedding) continue;
    result.set(candidate.name, embedding);
    cached[candidate.name] = embedding;
  }

  if (cacheEnabled) {
    cache[cacheKey] = cached;
    await mkdir(safeJoin(workspaceRoot, '.utk', 'model-proxy'), { recursive: true });
    await writeFile(cachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
  }

  return result;
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function safeProbe(provider: LocalToolEmbeddingProvider): Promise<LocalToolEmbeddingProbe> {
  try {
    return await provider.probe();
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function isEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
