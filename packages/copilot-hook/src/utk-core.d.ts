declare module '@utk/core' {
  export type MediatedResult = {
    response: string;
    schemaId: string;
    serializerId: string;
    rawPath: string;
    serializedPath: string;
  };

  export type UtkConfig = {
    detok: {
      enabled: boolean;
      copilot_pre_tool_use: {
        enabled: boolean;
        rate: number;
        min_chars: number;
        deny_tools: string[];
        rewrite_fields: string[];
        protected_fields: string[];
        overrides: Array<{
          tool: string;
          enabled?: boolean;
          rewrite_fields?: string[];
          protected_fields?: string[];
        }>;
      };
    };
  };

  export function mediateToolExecution(params: {
    workspaceRoot: string;
    toolId: string;
    input: unknown;
    execute: (input: unknown) => Promise<unknown>;
  }): Promise<MediatedResult>;

  export function loadUtkConfig(workspaceRoot: string): Promise<UtkConfig>;

  export function compressTextWithLlmlingua2(
    text: string,
    options?: {
      rate?: number;
      minChars?: number;
    }
  ): Promise<{
    compressedText: string;
    applied: boolean;
    error?: string;
  }>;
}
