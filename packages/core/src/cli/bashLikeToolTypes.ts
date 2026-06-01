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

export type BashLikeInvocation = {
  toolId: string;
  command: string;
  argv: string[];
  parameters: Record<string, string>;
};

export type BashLikeInvocationResult = {
  invocation: BashLikeInvocation;
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
};

export type GuidanceGrammarNode = {
  serialize(): unknown;
};
