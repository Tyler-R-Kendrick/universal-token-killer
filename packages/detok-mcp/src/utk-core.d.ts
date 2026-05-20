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

  export type PromptCompressionResult = {
    originalPrompt: string;
    compressedPrompt: string;
    applied: boolean;
    originalTokens: number;
    compressedTokens: number;
    rate: number;
    model: string;
    segments: Array<{
      kind: 'natural_language' | 'protected';
      text: string;
      compressedText: string;
      reason?: string;
      applied: boolean;
    }>;
    error?: string;
  };

  export function compressTextWithLlmlingua2(text: string, options?: DetokOptions): Promise<DetokResult>;
  export function compressPromptForLlm(
    prompt: string,
    options: {
      workspaceRoot: string;
      model?: string;
      rate?: number;
      minChars?: number;
      targetToken?: number;
      forceTokens?: string[];
    }
  ): Promise<PromptCompressionResult>;
}
