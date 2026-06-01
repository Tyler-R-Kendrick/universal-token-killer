import { estimateTokens } from './openai.js';

export type TextCompressorProvider = {
  id: string;
  compress(text: string, options?: { query?: string; rate?: number }): Promise<{ text: string; rawTokens: number; compactTokens: number; applied: boolean }>;
};

export type CompressionProvider = {
  id: string;
  localOnly: boolean;
  supports(kind: string): boolean;
  compress(text: string, options?: { query?: string; rate?: number; kind?: string }): Promise<{ text: string; rawTokens: number; compactTokens: number; applied: boolean }>;
  estimateCost?(text: string, options?: { kind?: string }): number;
};

export type CompressorRegistry = {
  defaultText: TextCompressorProvider;
  providers: Record<string, TextCompressorProvider>;
};

export function createDefaultCompressorRegistry(options: { fake?: boolean } = {}): CompressorRegistry {
  const provider: TextCompressorProvider = {
    id: options.fake ? 'fake-local' : 'llmlingua2',
    async compress(text, compressorOptions) {
      if (options.fake) {
        const words = text.split(/\s+/).filter(Boolean);
        const kept = words.slice(0, Math.max(1, Math.ceil(words.length * (compressorOptions?.rate ?? 0.33)))).join(' ');
        return { text: kept, rawTokens: estimateTokens(text), compactTokens: estimateTokens(kept), applied: kept !== text };
      }
      return { text, rawTokens: estimateTokens(text), compactTokens: estimateTokens(text), applied: false };
    }
  };
  return { defaultText: provider, providers: { [provider.id]: provider } };
}
