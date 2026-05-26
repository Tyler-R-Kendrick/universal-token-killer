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
    serializerId: string;
    confidence: number;
    missingRequired: string[];
    guidance: {
      used: boolean;
      available: boolean;
      serializedGrammar: unknown;
      errors: string[];
    };
  }>;

  export type StructuredToolParameter = {
    name: string;
    completions?: string[];
    required?: boolean;
    description?: string;
  };

  export type StructuredToolDefinition = {
    toolId: string;
    description?: string;
    outputCache?: boolean;
    bypassOnCache?: boolean;
    curryFields?: string[];
    parameters: StructuredToolParameter[];
  };

  export function completeStructuredToolInvocation(params: {
    workspaceRoot: string;
    request: string;
    tools: StructuredToolDefinition[];
  }): Promise<{
    invocation: {
      toolId: string;
      args: Record<string, string>;
    };
    templatePath: string;
    serializerId: 'toon' | 'json-compact';
    confidence: number;
    missingRequired: string[];
    guidance: {
      used: boolean;
      available: boolean;
      serializedGrammar: unknown;
      errors: string[];
    };
    cache: {
      eligible: boolean;
      hit: boolean;
      bypass: boolean;
      path: string;
    };
  }>;
}
