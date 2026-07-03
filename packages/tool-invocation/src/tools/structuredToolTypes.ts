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

export type StructuredToolInvocation = {
  toolId: string;
  args: Record<string, string>;
};

export type StructuredToolInvocationResult = {
  invocation: StructuredToolInvocation;
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
  cache: {
    eligible: boolean;
    hit: boolean;
    bypass: boolean;
    path: string;
  };
};

export type StructuredGuidanceGrammarNode = {
  serialize(): unknown;
};
