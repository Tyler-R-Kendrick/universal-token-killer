import type { UtkConfig } from '@utk/config';

export type LocalToolEmbeddingProbe = {
  available: boolean;
  reason: string;
};

export type LocalToolEmbeddingProvider = {
  id: string;
  model: string;
  dimensions: number;
  probe(): Promise<LocalToolEmbeddingProbe>;
  embed(texts: string[]): Promise<number[][]>;
};

export type ToolMatchingEmbeddingConfig = Pick<UtkConfig['tool_matching'], 'embedding_timeout_ms' | 'provider_options'>;

export type LocalToolEmbeddingProviderAdapter<TOptions extends object = object> = {
  id: string;
  optionsFromConfig(options: Record<string, unknown>, config: ToolMatchingEmbeddingConfig): TOptions | undefined;
  create(options: TOptions): LocalToolEmbeddingProvider;
  createFromConfig(config: ToolMatchingEmbeddingConfig): LocalToolEmbeddingProvider | undefined;
};

export type LocalToolEmbeddingProviderAdapterEntry = Pick<LocalToolEmbeddingProviderAdapter, 'id' | 'createFromConfig'>;

export function createLocalToolEmbeddingProviderAdapter<TOptions extends object>(definition: {
  id: string;
  optionsFromConfig(options: Record<string, unknown>, config: ToolMatchingEmbeddingConfig): TOptions | undefined;
  create(options: TOptions): LocalToolEmbeddingProvider;
}): LocalToolEmbeddingProviderAdapter<TOptions> {
  return {
    ...definition,
    createFromConfig(config) {
      const options = definition.optionsFromConfig(config.provider_options[definition.id] ?? {}, config);
      return options ? definition.create(options) : undefined;
    }
  };
}
