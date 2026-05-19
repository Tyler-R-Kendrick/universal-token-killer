declare module '@utk/core' {
  export type MediatedResult = {
    response: string;
    schemaId: string;
    serializerId: string;
    rawPath: string;
    serializedPath: string;
  };

  export function mediateToolExecution(params: {
    workspaceRoot: string;
    toolId: string;
    input: unknown;
    execute: (input: unknown) => Promise<unknown>;
  }): Promise<MediatedResult>;

  export type BashLikeParameter = {
    name: string;
    kind: 'positional' | 'flag' | 'option';
    flag?: string;
    completions: string[];
    required?: boolean;
    description?: string;
  };

  export type BashLikeToolDefinition = {
    toolId: string;
    command: string;
    description?: string;
    parameters: BashLikeParameter[];
  };

  export function completeBashLikeToolInvocation(params: {
    workspaceRoot: string;
    request: string;
    tools: BashLikeToolDefinition[];
  }): Promise<{
    invocation: {
      toolId: string;
      command: string;
      argv: string[];
      parameters: Record<string, string>;
    };
    templatePath: string;
    serializerId: 'toon' | 'compressed-json';
    confidence: number;
    missingRequired: string[];
    guidance: {
      used: boolean;
      available: boolean;
      serializedGrammar: unknown;
      errors: string[];
    };
  }>;
}
