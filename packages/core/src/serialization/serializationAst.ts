import { sortValue } from '@utk/foundation';

export type SerializationAst =
  | null
  | boolean
  | number
  | string
  | SerializationAst[]
  | { [key: string]: SerializationAst };

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

export function lintSerializationAst(value: unknown, path = '$'): SerializationLintResult {
  const diagnostics: SerializationLintDiagnostic[] = [];
  collectAstDiagnostics(value, path, diagnostics);
  if (diagnostics.length > 0) {
    return { valid: false, diagnostics, feedback: 'Use only JSON-compatible values for json-value-v1 serialization.' };
  }
  return { valid: true, diagnostics: [], ast: toSerializationAst(value) };
}

export function lintParseError(error: unknown): SerializationLintResult {
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
