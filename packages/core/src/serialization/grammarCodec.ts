import { canonicalJson, sortValue } from '../artifact/canonical.js';
import type { SerializationContext, SerializationProvider, SerializationValidation, SerializerGrammar } from './providers.js';

export type SerializationAst =
  | null
  | boolean
  | number
  | string
  | SerializationAst[]
  | { [key: string]: SerializationAst };

export type GrammarCodec = {
  id: string;
  serialize(value: SerializationAst): string;
  deserialize(text: string): SerializationAst;
};

export type SerializationLintSeverity = 'error' | 'warning' | 'info';

export type SerializationTextSpan = {
  offset: number;
  length: number;
  line?: number;
  column?: number;
};

export type SerializationLintDiagnostic = {
  code: string;
  severity: SerializationLintSeverity;
  message: string;
  path?: string;
  span?: SerializationTextSpan;
  expected?: unknown;
  actual?: unknown;
};

export type SerializationLintResult = {
  valid: boolean;
  diagnostics: SerializationLintDiagnostic[];
  ast?: SerializationAst;
  regenerated?: string;
  feedback?: string;
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
      return compiled.codec.serialize(toSerializationAst(value));
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

export function toSerializationAst(value: unknown): SerializationAst {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('SerializationAst numbers must be finite');
    return value;
  }
  if (Array.isArray(value)) return value.map(toSerializationAst);
  if (value && typeof value === 'object') {
    const sorted = sortValue(JSON.parse(JSON.stringify(value))) as Record<string, unknown>;
    const result: Record<string, SerializationAst> = {};
    for (const [key, entry] of Object.entries(sorted)) {
      result[key] = toSerializationAst(entry);
    }
    return result;
  }
  return null;
}

function lintSerializationAst(value: unknown, path = '$'): SerializationLintResult {
  const diagnostics: SerializationLintDiagnostic[] = [];
  collectAstDiagnostics(value, path, diagnostics);
  if (diagnostics.length > 0) {
    return { valid: false, diagnostics, feedback: 'Use only JSON-compatible values for json-value-v1 serialization.' };
  }
  return { valid: true, diagnostics: [], ast: toSerializationAst(value) };
}

function collectAstDiagnostics(value: unknown, path: string, diagnostics: SerializationLintDiagnostic[]): void {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      diagnostics.push({
        code: 'serialization/invalid-ast-number',
        severity: 'error',
        message: 'SerializationAst numbers must be finite',
        path,
        actual: value
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectAstDiagnostics(entry, `${path}[${index}]`, diagnostics));
    return;
  }
  if (typeof value === 'undefined') {
    diagnostics.push({ code: 'serialization/invalid-ast-undefined', severity: 'error', message: 'SerializationAst does not support undefined', path });
    return;
  }
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    diagnostics.push({
      code: `serialization/invalid-ast-${typeof value}`,
      severity: 'error',
      message: `SerializationAst does not support ${typeof value}`,
      path
    });
    return;
  }
  if (value && typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      diagnostics.push({
        code: 'serialization/invalid-ast-object',
        severity: 'error',
        message: 'SerializationAst objects must be plain JSON-compatible objects',
        path
      });
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      collectAstDiagnostics(entry, `${path}.${key}`, diagnostics);
    }
  }
}

function lintParseError(error: unknown): SerializationLintResult {
  return {
    valid: false,
    diagnostics: [{
      code: 'serialization/parse-error',
      severity: 'error',
      message: String(error)
    }],
    feedback: 'Return output that matches the serializer grammar.'
  };
}

function codecFor(id: string, extension: string): GrammarCodec {
  if (id === 'toon' || extension === 'toon') {
    return { id: 'toon-json-value-v1', serialize: serializeToon, deserialize: deserializeToon };
  }
  return { id: `${id}-json-value-v1`, serialize: serializeJson, deserialize: deserializeJson };
}

function serializeJson(value: SerializationAst): string {
  return JSON.stringify(sortValue(value));
}

function deserializeJson(text: string): SerializationAst {
  return toSerializationAst(JSON.parse(text));
}

function serializeToon(value: SerializationAst): string {
  if (!isRecord(value)) return formatToonScalar(value);
  return Object.entries(value).map(([key, entry]) => formatToonEntry(key, entry)).join('\n');
}

function formatToonEntry(key: string, value: SerializationAst): string {
  if (Array.isArray(value)) {
    if (value.every(isRecord)) {
      const fields = Array.from(new Set(value.flatMap((entry) => Object.keys(entry as Record<string, SerializationAst>)))).sort();
      const rows = value.map((entry) => `  ${fields.map((field) => formatToonScalar((entry as Record<string, SerializationAst>)[field] ?? null)).join(',')}`);
      return [`${key}[${value.length}]{${fields.join(',')}}:`, ...rows].join('\n');
    }
    return `${key}[${value.length}]: ${value.map(formatToonScalar).join(',')}`;
  }
  if (isRecord(value)) {
    const nested = Object.entries(value).map(([childKey, child]) => `  ${formatToonEntry(childKey, child).replace(/\n/g, '\n  ')}`);
    return [`${key}:`, ...nested].join('\n');
  }
  return `${key}: ${formatToonScalar(value)}`;
}

function deserializeToon(text: string): SerializationAst {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const result: Record<string, SerializationAst> = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (/^\s/.test(line)) continue;
    const table = /^([A-Za-z_][\w-]*)\[(\d+)\]\{([^}]*)\}:$/.exec(line);
    if (table) {
      const key = table[1]!;
      const countRaw = table[2]!;
      const fieldsRaw = table[3]!;
      const fields = fieldsRaw.length > 0 ? fieldsRaw.split(',') : [];
      const count = Number(countRaw);
      const rows: SerializationAst[] = [];
      for (let rowIndex = 0; rowIndex < count && index + 1 < lines.length; rowIndex += 1) {
        const row = lines[++index]!.trim();
        const cells = row.length > 0 ? row.split(',') : [];
        const item: Record<string, SerializationAst> = {};
        fields.forEach((field, fieldIndex) => {
          item[field] = parseToonScalar(cells[fieldIndex] ?? '');
        });
        rows.push(item);
      }
      result[key] = rows;
      continue;
    }
    const array = /^([A-Za-z_][\w-]*)\[(\d+)\]:\s*(.*)$/.exec(line);
    if (array) {
      const key = array[1]!;
      const valuesRaw = array[3]!;
      result[key] = valuesRaw.length > 0 ? valuesRaw.split(',').map(parseToonScalar) : [];
      continue;
    }
    const scalar = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (scalar) {
      const key = scalar[1]!;
      const valueRaw = scalar[2]!;
      result[key] = parseToonScalar(valueRaw);
    }
  }
  return result;
}

function formatToonScalar(value: SerializationAst): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return /^[A-Za-z0-9_.@/-]+$/.test(value) ? value : JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function parseToonScalar(value: string): SerializationAst {
  const trimmed = value.trim();
  if (trimmed === 'null' || trimmed === '') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return toSerializationAst(JSON.parse(trimmed));
  }
  return trimmed;
}

function isRecord(value: SerializationAst): value is Record<string, SerializationAst> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function serializerLabel(id: string): string {
  if (id === 'toon') return 'TOON';
  if (id === 'tron') return 'TRON';
  return id;
}
