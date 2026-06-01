export type CompressionProvider = {
  id: string;
  localOnly: boolean;
  supports(kind: string): boolean;
  compress(text: string, options?: { kind?: string; rate?: number }): Promise<{
    text: string;
    rawTokens: number;
    compactTokens: number;
    applied: boolean;
  }>;
  estimateCost?(text: string, options?: { kind?: string }): number;
};

export function createCompressionProviderRegistry(options: { remoteEnabled?: boolean } = {}): {
  remoteEnabled: boolean;
  providers: Record<string, CompressionProvider>;
} {
  const provider: CompressionProvider = {
    id: 'local-passthrough',
    localOnly: true,
    supports: () => true,
    async compress(text) {
      const tokens = estimateTokens(text);
      return { text, rawTokens: tokens, compactTokens: tokens, applied: false };
    },
    estimateCost: () => 0
  };
  return { remoteEnabled: options.remoteEnabled ?? false, providers: { default: provider, [provider.id]: provider } };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
