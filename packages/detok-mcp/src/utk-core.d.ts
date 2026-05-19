declare module '@utk/core' {
  export type DetokOptions = {
    rate?: number;
    targetToken?: number;
    force?: boolean;
    minChars?: number;
    forceTokens?: string[];
    modelName?: string;
  };

  export type DetokResult = {
    originalText: string;
    compressedText: string;
    applied: boolean;
    originTokens: number;
    compressedTokens: number;
    rate: number;
    model: string;
    usedLlmlingua2: boolean;
    error?: string;
  };

  export function compressTextWithLlmlingua2(text: string, options?: DetokOptions): Promise<DetokResult>;
}
