export type PackToolEntry = {
  id: string;
  kind: 'bash-like' | 'structured';
  file?: string;
  output_cache?: boolean;
  bypass_on_cache?: boolean;
  curry_fields?: string[];
};

export type PackGrammarEntry = {
  tool: string;
  field: string;
  lark?: string;
  description?: string;
};

export type PackTemplateEntry = {
  id: string;
  file: string;
  language: 'typescript' | 'python';
  tool?: string;
};

export type PackSerializationPluginEntry = {
  type: 'serialization';
  id: string;
  module: string;
  grammar: string;
  extension: string;
  aliases?: string[];
  config_fields?: Record<string, unknown>;
};

export type PackAgentPluginEntry = {
  type: 'agent';
  id: string;
  target: string;
  path?: string;
  manifest?: string;
};

export type PackPluginEntry = PackSerializationPluginEntry | PackAgentPluginEntry;

export type UtkPackManifest = {
  pack: {
    name: string;
    version: string;
    description?: string;
    license?: string;
    authors?: string[];
    homepage?: string;
    keywords?: string[];
  };
  compatibility?: {
    utk?: string;
    pack_spec?: string;
  };
  tools?: PackToolEntry[];
  grammars?: PackGrammarEntry[];
  templates?: PackTemplateEntry[];
  plugins?: PackPluginEntry[];
};

export type PackSource =
  | { type: 'local'; path: string }
  | { type: 'tarball'; path: string }
  | { type: 'git'; url: string; ref?: string }
  | { type: 'npm'; spec: string };

export type PackGrammarRecord = {
  tool: string;
  field: string;
  lark: string;
  larkHash: string;
};

export type PackToolDefinition = {
  entry: PackToolEntry;
  source: Record<string, unknown>;
};

export type PackTemplateRecord = {
  entry: PackTemplateEntry;
  source: string;
  descriptorPath?: string;
};

export type PackSerializationPluginRecord = {
  entry: PackSerializationPluginEntry;
  grammar: {
    lark: string;
    larkHash: string;
  };
};

export type PackAgentPluginRecord = {
  entry: PackAgentPluginEntry;
};

export type PackPluginRecord = PackSerializationPluginRecord | PackAgentPluginRecord;

export type LoadedPack = {
  manifest: UtkPackManifest;
  rootDir: string;
  tools: PackToolDefinition[];
  grammars: PackGrammarRecord[];
  templates: PackTemplateRecord[];
  plugins: PackPluginRecord[];
};

export type InstalledPack = {
  name: string;
  version: string;
  source: string;
  revision: string;
  contentHash: string;
  installedAt: string;
  tools: string[];
  templates: string[];
  grammars: Array<{
    tool: string;
    field: string;
    larkHash: string;
  }>;
  plugins: Array<{
    type: 'serialization' | 'agent';
    id: string;
    target?: string;
    larkHash?: string;
  }>;
};
