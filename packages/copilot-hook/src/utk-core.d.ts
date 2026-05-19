declare module '@utk/core' {
  export type MediatedResult = {
    response: string;
    schemaId: string;
    serializerId: string;
    rawPath: string;
    serializedPath: string;
  };

  export type UtkConfig = {
    tools: {
      registry: Array<{
        tool: string;
        description?: string;
        output_cache: boolean;
        bypass_on_cache: boolean;
        curry_fields: string[];
        structured_fields: Array<{
          name: string;
          grammar: 'bash-like' | 'sql' | 'lucene' | 'regex';
          completions: string[];
          required?: boolean;
          description?: string;
        }>;
      }>;
    };
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
  export function normalizeToolId(value: string): string;
  export function contentHash(value: unknown, shortLength?: number): string;
  export function resolveRegisteredTool(
    config: UtkConfig,
    toolId: string
  ): UtkConfig['tools']['registry'][number] | undefined;
  export function optimizeStructuredToolArgs(
    args: Record<string, unknown>,
    tool: {
      parameters: Array<{
        name: string;
        grammar: 'bash-like' | 'sql' | 'lucene' | 'regex';
        completions: string[];
        required?: boolean;
        description?: string;
      }>;
    }
  ): { value: Record<string, unknown>; applied: boolean };

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
