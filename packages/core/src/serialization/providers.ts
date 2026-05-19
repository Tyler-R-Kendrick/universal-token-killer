import { decode, encode, type JsonValue } from '@toon-format/toon';
import { canonicalJson, sortValue } from '../artifact/canonical.js';
import type { SerializerProviderId } from '../config/config.js';

export type SerializationContext = {
  toolId: string;
};

export type SerializationValidation = {
  valid: boolean;
  errors: string[];
  regenerated?: string;
};

export type SerializationProvider = {
  id: SerializerProviderId;
  serialize(value: unknown, context: SerializationContext): string;
  deserialize(text: string, context: SerializationContext): unknown;
  validate(value: unknown, text: string, context?: SerializationContext): SerializationValidation;
  estimateTokens(text: string): number;
};

const providers: Record<SerializerProviderId, SerializationProvider> = {
  toon: {
    id: 'toon',
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
  },
  'compressed-json': {
    id: 'compressed-json',
    serialize(value) {
      return JSON.stringify(sortValue(value));
    },
    deserialize(text) {
      return JSON.parse(text) as unknown;
    },
    validate(value, text) {
      const expected = JSON.stringify(sortValue(value));
      if (text === expected) {
        return { valid: true, errors: [] };
      }
      return { valid: false, errors: ['compressed JSON artifact drifted from canonical value'], regenerated: expected };
    },
    estimateTokens
  }
};

export function getSerializationProvider(id: SerializerProviderId): SerializationProvider {
  return providers[id];
}

export function serializedExtension(id: SerializerProviderId): string {
  return id === 'toon' ? 'toon' : 'json';
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
