import type { FieldGrammar } from '../grammar/fieldGrammar.js';

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
  seed?: string;
  description?: string;
};

export type PackTemplateEntry = {
  id: string;
  file: string;
  language: 'typescript' | 'python';
  tool?: string;
};

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
  seed?: FieldGrammar;
  seedHash?: string;
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

export type LoadedPack = {
  manifest: UtkPackManifest;
  rootDir: string;
  tools: PackToolDefinition[];
  grammars: PackGrammarRecord[];
  templates: PackTemplateRecord[];
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
    seedObservations: number;
    seedHash: string | null;
  }>;
};
