import { decode, encode, type JsonValue } from '@toon-format/toon';
import { canonicalJson } from '../../artifact/canonical.js';
import type { SerializationRegistry } from '../providers.js';

export function registerUtkSerializerPlugin(registry: SerializationRegistry): void {
  registry.register({
    id: 'toon',
    extension: 'toon',
    serialize(value) {
      return encode(toJsonValue(value));
    },
    deserialize(text) {
      return decode(text);
    },
    validate(value, text) {
      const expected = encode(toJsonValue(value));
      try {
        const decoded = decode(text);
        if (canonicalJson(decoded) === canonicalJson(toJsonValue(value))) {
          return { valid: true, errors: [] };
        }
        return { valid: false, errors: ['TOON artifact drifted from canonical value'], regenerated: expected };
      } catch (error) {
        return { valid: false, errors: [String(error)], regenerated: expected };
      }
    },
    estimateTokens
  });
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
