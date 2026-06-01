export type SessionAgentProfile = {
  name: string;
  description: string;
  domain: string;
  lexicon: string[];
  triggers: string[];
  target?: 'vscode' | 'github-copilot';
  tools?: string[] | string;
  model?: string;
  disableModelInvocation?: boolean;
  userInvocable?: boolean;
  infer?: boolean;
  argumentHint?: string;
  agents?: string[];
  handoffs?: SessionAgentHandoff[];
  mcpServers?: Record<string, SessionAgentMcpServer>;
  metadata?: Record<string, string>;
  hooks?: Record<string, Array<{ command: string; timeout?: number }>>;
  bodyInstructions?: string;
  mixedConcerns?: string[];
};

export type SessionAgentHandoff = {
  label: string;
  agent: string;
  prompt: string;
  send?: boolean;
  model?: string;
};

export type SessionAgentMcpServer = {
  type?: string;
  command?: string;
  url?: string;
  args?: string[];
  tools?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
};

export type SessionAgentCandidate = SessionAgentProfile & {
  expectedReuse: string;
  triggerHits: number;
};

export type SessionAgentResult = {
  name: string;
  agentPath: string;
  grammarPath: string;
  toolRegistrationPath: string;
  promptReferencePath?: string;
  grammarHash: string;
};
