import {
  createLocalToolEmbeddingProviderAdapter,
  type LocalToolEmbeddingProvider,
  type LocalToolEmbeddingProviderAdapter,
  type LocalToolEmbeddingProviderAdapterEntry,
  type ToolMatchingEmbeddingConfig
} from './toolEmbeddingProvider.js';

export type OpenAiCompatibleEmbeddingProviderOptions = {
  baseUrl: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
  requireModel?: boolean;
};

export type OpenAiCompatibleEmbeddingOptions = OpenAiCompatibleEmbeddingProviderOptions & {
  id: string;
};

export type OllamaEmbeddingProviderOptions = OpenAiCompatibleEmbeddingProviderOptions;
export type LlamaServerEmbeddingProviderOptions = OpenAiCompatibleEmbeddingProviderOptions & {
  requireModel: false;
};
export type OpenAiCompatibleLocalEmbeddingProviderOptions = OpenAiCompatibleEmbeddingProviderOptions;

export function createOpenAiCompatibleLocalToolEmbeddingProviderAdapter<TOptions extends OpenAiCompatibleEmbeddingProviderOptions>(
  id: string,
  defaults: TOptions,
  options: { requireConfigured?: boolean } = {}
): LocalToolEmbeddingProviderAdapter<TOptions> {
  return createLocalToolEmbeddingProviderAdapter({
    id,
    optionsFromConfig(providerOptions, config) {
      const hydrated = openAiOptionsFromProviderConfig(providerOptions, config, defaults);
      return options.requireConfigured && (!hydrated.baseUrl || !hydrated.model) ? undefined : hydrated as TOptions;
    },
    create: (options) => createOpenAiCompatibleLocalToolEmbeddingProvider({ id, ...options })
  });
}

export const DEFAULT_LOCAL_TOOL_EMBEDDING_PROVIDER_ADAPTERS: readonly LocalToolEmbeddingProviderAdapterEntry[] = [
  createOpenAiCompatibleLocalToolEmbeddingProviderAdapter<OllamaEmbeddingProviderOptions>('ollama', {
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'nomic-embed-text',
    dimensions: 768,
    timeoutMs: 1000
  }),
  createOpenAiCompatibleLocalToolEmbeddingProviderAdapter<LlamaServerEmbeddingProviderOptions>('llama-server', {
    baseUrl: 'http://127.0.0.1:8080/v1',
    model: '',
    dimensions: 768,
    timeoutMs: 1000,
    requireModel: false
  }),
  createOpenAiCompatibleLocalToolEmbeddingProviderAdapter<OpenAiCompatibleLocalEmbeddingProviderOptions>('openai-compatible-local', {
    baseUrl: '',
    model: '',
    dimensions: 768,
    timeoutMs: 1000
  }, { requireConfigured: true })
];

export function createOpenAiCompatibleLocalToolEmbeddingProvider(options: OpenAiCompatibleEmbeddingOptions): LocalToolEmbeddingProvider {
  const model = options.model || 'default';
  return {
    id: options.id,
    model,
    dimensions: options.dimensions,
    async probe() {
      if (!options.baseUrl) return { available: false, reason: 'missing-base-url' };
      if (options.requireModel !== false && !options.model) return { available: false, reason: 'missing-model' };
      try {
        const response = await fetchWithTimeout(openAiUrl(options.baseUrl, 'models'), {
          method: 'GET',
          headers: { accept: 'application/json' }
        }, options.timeoutMs);
        if (!response.ok) return { available: false, reason: `http-${response.status}` };
        const json = await response.json() as unknown;
        if (!hasDataArray(json)) return { available: false, reason: 'invalid-model-list' };
        return { available: true, reason: 'ok' };
      } catch (error) {
        return { available: false, reason: error instanceof Error ? error.message : String(error) };
      }
    },
    async embed(texts) {
      const response = await fetchWithTimeout(openAiUrl(options.baseUrl, 'embeddings'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ model, input: texts })
      }, options.timeoutMs);
      if (!response.ok) throw new Error(`Embedding provider ${options.id} returned HTTP ${response.status}`);
      const json = await response.json() as unknown;
      const embeddings = readEmbeddings(json);
      if (embeddings.length !== texts.length) {
        throw new Error(`Embedding provider ${options.id} returned ${embeddings.length} embeddings for ${texts.length} inputs`);
      }
      return embeddings;
    }
  };
}

function openAiOptionsFromProviderConfig(
  options: Record<string, unknown>,
  config: ToolMatchingEmbeddingConfig,
  fallback: OpenAiCompatibleEmbeddingProviderOptions
): OpenAiCompatibleEmbeddingProviderOptions {
  return {
    baseUrl: stringOption(options, 'base_url', fallback.baseUrl),
    model: stringOption(options, 'model', fallback.model),
    dimensions: numberOption(options, 'dimensions', fallback.dimensions),
    timeoutMs: numberOption(options, 'timeout_ms', config.embedding_timeout_ms),
    requireModel: booleanOption(options, 'require_model', fallback.requireModel)
  };
}

function readEmbeddings(json: unknown): number[][] {
  if (!hasDataArray(json)) throw new Error('Embedding provider returned invalid data');
  return json.data
    .map((item) => isObject(item) && isEmbedding(item.embedding) ? item.embedding : undefined)
    .filter((item): item is number[] => item !== undefined);
}

function hasDataArray(value: unknown): value is { data: unknown[] } {
  return isObject(value) && Array.isArray(value.data);
}

function isEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

function stringOption(options: Record<string, unknown>, key: string, fallback: string): string {
  return typeof options[key] === 'string' ? options[key] : fallback;
}

function numberOption(options: Record<string, unknown>, key: string, fallback: number): number {
  return typeof options[key] === 'number' && Number.isFinite(options[key]) ? options[key] : fallback;
}

function booleanOption(options: Record<string, unknown>, key: string, fallback: boolean | undefined): boolean | undefined {
  return typeof options[key] === 'boolean' ? options[key] : fallback;
}

function openAiUrl(baseUrl: string, path: 'models' | 'embeddings'): string {
  const base = baseUrl.replace(/\/$/, '');
  return `${base.endsWith('/v1') ? base : `${base}/v1`}/${path}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
