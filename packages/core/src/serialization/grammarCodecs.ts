import { sortValue } from '@utk/foundation';
import { toSerializationAst, type SerializationAst } from './serializationAst.js';

export type GrammarCodec = {
  id: string;
  serialize(value: SerializationAst): string;
  deserialize(text: string): SerializationAst;
};

export function codecFor(id: string, extension: string): GrammarCodec {
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
        const nextLine = lines[index + 1]!;
        if (!/^\s/.test(nextLine)) break;
        index += 1;
        const row = nextLine.trim();
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
      if (valueRaw.length === 0) {
        const nestedLines: string[] = [];
        while (index + 1 < lines.length && /^\s/.test(lines[index + 1]!)) {
          nestedLines.push(lines[++index]!.replace(/^\s\s/, ''));
        }
        if (nestedLines.length > 0) {
          result[key] = deserializeToon(nestedLines.join('\n'));
          continue;
        }
      }
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
