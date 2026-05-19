declare module '@utk/core' {
  export type MediatedResult = {
    response: string;
    schemaId: string;
    serializerId: string;
    rawPath: string;
    serializedPath: string;
  };

  export type FieldGrammarSeparator = {
    tight: number;
    loose: number;
  };

  export type FieldGrammar = {
    version: number;
    observations: number;
    separators: Record<string, FieldGrammarSeparator>;
    lengthRange: { min: number; max: number };
  };

  export function inferFieldGrammar(value: string): FieldGrammar;
  export function mergeFieldGrammar(current: FieldGrammar | undefined, candidate: FieldGrammar): FieldGrammar;
  export function normalizeWithFieldGrammar(value: string, grammar: FieldGrammar | undefined): string;
  export function loadFieldGrammar(workspaceRoot: string, toolId: string, fieldName: string): Promise<FieldGrammar | undefined>;
  export function recordFieldObservation(
    workspaceRoot: string,
    toolId: string,
    fieldName: string,
    value: string
  ): Promise<FieldGrammar>;

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
  export function canonicalJson(value: unknown): string;
  export function safeJoin(base: string, ...parts: string[]): string;
  export function resolveRegisteredTool(
    config: UtkConfig,
    toolId: string
  ): UtkConfig['tools']['registry'][number] | undefined;
  export function optimizeStructuredToolArgs(
    args: Record<string, unknown>,
    tool: {
      parameters: Array<{
        name: string;
        completions?: string[];
        required?: boolean;
        description?: string;
      }>;
    },
    learnedGrammars?: Record<string, FieldGrammar | undefined>
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
