import type { GrammarCodec } from './grammarCodecs.js';
import type { SerializationAst, SerializationLintResult } from './serializationAst.js';

export type SerializationContext = {
  toolId: string;
};

export type SerializationValidation = {
  valid: boolean;
  errors: string[];
  regenerated?: string;
};

export type SerializerGrammar = {
  format: 'lark';
  source: string;
  path?: string;
  hash?: string;
  llguidancePrefix?: string;
};

export type SerializationProvider = {
  id: string;
  aliases?: string[];
  extension: string;
  grammar?: SerializerGrammar;
  serialize(value: unknown, context: SerializationContext): string;
  deserialize(text: string, context: SerializationContext): unknown;
  validate(value: unknown, text: string, context?: SerializationContext): SerializationValidation;
  estimateTokens(text: string): number;
};

export type SerializationRegistry = {
  serializers: Record<string, GeneratedSerializer>;
  register(provider: SerializationProvider): void;
  registerGenerated(serializer: GeneratedSerializer): void;
  get(id: string): SerializationProvider | undefined;
  require(id: string): SerializationProvider;
  list(): SerializationProvider[];
};

export type SerializationPluginManifest = {
  id: string;
  aliases?: string[];
  version: string;
  type: 'serialization';
  symbol: string;
  semantics: 'json-value-v1';
  grammar: string;
  extension: string;
  canonical: boolean;
  configFields: Record<string, unknown>;
};

export type SerializationRegistryOptions = {
  includeBuiltIns?: boolean;
};

export type GeneratedSerializationParser = {
  grammar: SerializerGrammar;
  parse(text: string): SerializationAst;
  tryParse(text: string): SerializationLintResult;
};

export type GeneratedSerializationPrinter = {
  serialize(value: unknown): string;
  canonicalize(value: unknown): SerializationAst;
};

export type GeneratedSerializationLinter = {
  lint(text: string): SerializationLintResult;
  lintAst(value: unknown): SerializationLintResult;
};

export type GeneratedSerializer = {
  id: string;
  symbol: string;
  aliases?: string[];
  extension: string;
  grammar: SerializerGrammar;
  parser: GeneratedSerializationParser;
  serializer: GeneratedSerializationPrinter;
  linter: GeneratedSerializationLinter;
  provider: SerializationProvider;
};

export type CompiledSerializationGrammar = {
  grammar: SerializerGrammar;
  codec: GrammarCodec;
};
