import { canonicalJson } from '../artifact/canonical.js';
import type {
  CompiledSerializationGrammar,
  GeneratedSerializationLinter,
  GeneratedSerializationParser,
  GeneratedSerializationPrinter,
  GeneratedSerializer,
  SerializationContext,
  SerializationProvider,
  SerializationValidation,
  SerializerGrammar
} from './serializationTypes.js';
import { codecFor } from './grammarCodecs.js';
import {
  lintParseError,
  lintSerializationAst,
  toSerializationAst,
  type SerializationAst,
  type SerializationLintResult
} from './serializationAst.js';

export type {
  SerializationAst,
  SerializationLintDiagnostic,
  SerializationLintResult,
  SerializationLintSeverity,
  SerializationTextSpan
} from './serializationAst.js';
export type { GrammarCodec } from './grammarCodecs.js';
export type {
  CompiledSerializationGrammar,
  GeneratedSerializationLinter,
  GeneratedSerializationParser,
  GeneratedSerializationPrinter,
  GeneratedSerializer
} from './serializationTypes.js';
export { toSerializationAst } from './serializationAst.js';

export type CompileSerializationGrammarOptions = {
  id: string;
  symbol: string;
  aliases?: string[];
  extension: string;
  grammar: SerializerGrammar;
  semantics: 'json-value-v1';
};

export function compileSerializationGrammar(options: CompileSerializationGrammarOptions): CompiledSerializationGrammar {
  if (options.semantics !== 'json-value-v1') {
    throw new Error(`Unsupported serialization semantics for ${options.id}: ${options.semantics}`);
  }
  if (options.grammar.format !== 'lark' || !/\bstart\s*:/.test(options.grammar.source)) {
    throw new Error(`Serializer plugin ${options.id} grammar missing start rule`);
  }
  return {
    grammar: options.grammar,
    codec: codecFor(options.id, options.extension)
  };
}

export function providerFromCompiledGrammar(options: CompileSerializationGrammarOptions): SerializationProvider {
  return generatedSerializerFromCompiledGrammar(options).provider;
}

export function generatedSerializerFromCompiledGrammar(options: CompileSerializationGrammarOptions): GeneratedSerializer {
  const compiled = compileSerializationGrammar(options);
  const parser: GeneratedSerializationParser = {
    grammar: compiled.grammar,
    parse(text) {
      return compiled.codec.deserialize(text);
    },
    tryParse(text) {
      try {
        return { valid: true, diagnostics: [], ast: compiled.codec.deserialize(text) };
      } catch (error) {
        return lintParseError(error);
      }
    }
  };
  const serializer: GeneratedSerializationPrinter = {
    serialize(value) {
      const ast = toSerializationAst(value);
      const validation = lintSerializationAst(ast);
      if (!validation.valid) {
        const messages = validation.diagnostics.map(d => d.message).join('; ');
        throw new Error(`Invalid serialization value: ${messages}`);
      }
      return compiled.codec.serialize(ast);
    },
    canonicalize(value) {
      return toSerializationAst(value);
    }
  };
  const linter: GeneratedSerializationLinter = {
    lint(text) {
      const parsed = parser.tryParse(text);
      if (!parsed.valid || parsed.ast === undefined) return parsed;
      const astLint = lintSerializationAst(parsed.ast);
      if (!astLint.valid) return { ...astLint, ast: parsed.ast };
      const regenerated = serializer.serialize(parsed.ast);
      if (text !== regenerated) {
        return {
          valid: false,
          ast: parsed.ast,
          regenerated,
          diagnostics: [{
            code: 'serialization/canonical-drift',
            severity: 'error',
            message: `${serializerLabel(options.id)} artifact drifted from canonical form`,
            expected: regenerated,
            actual: text
          }],
          feedback: `Regenerate with canonical ${options.id} serialization.`
        };
      }
      return { valid: true, diagnostics: [], ast: parsed.ast };
    },
    lintAst(value) {
      return lintSerializationAst(value);
    }
  };
  const provider: SerializationProvider = {
    id: options.id,
    aliases: options.aliases,
    extension: options.extension,
    grammar: compiled.grammar,
    serialize(value) {
      return serializer.serialize(value);
    },
    deserialize(text) {
      return parser.parse(text);
    },
    validate(value, text, _context?: SerializationContext): SerializationValidation {
      const astLint = linter.lintAst(value);
      if (!astLint.valid) {
        return { valid: false, errors: astLint.diagnostics.map((diagnostic) => diagnostic.message) };
      }
      const expectedAst = astLint.ast!;
      const expected = serializer.serialize(expectedAst);
      try {
        const decoded = parser.parse(text);
        if (text === expected && canonicalJson(decoded) === canonicalJson(expectedAst)) {
          return { valid: true, errors: [] };
        }
        return { valid: false, errors: [`${serializerLabel(options.id)} artifact drifted from canonical value`], regenerated: expected };
      } catch (error) {
        return { valid: false, errors: [String(error)], regenerated: expected };
      }
    },
    estimateTokens(text) {
      return Math.ceil(text.length / 4);
    }
  };
  return {
    id: options.id,
    symbol: options.symbol,
    aliases: options.aliases,
    extension: options.extension,
    grammar: compiled.grammar,
    parser,
    serializer,
    linter,
    provider
  };
}

function serializerLabel(id: string): string {
  if (id === 'toon') return 'TOON';
  if (id === 'tron') return 'TRON';
  return id;
}
