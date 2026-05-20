import { sortValue } from '../../artifact/canonical.js';
import type { SerializationRegistry } from '../providers.js';

export function registerUtkSerializerPlugin(registry: SerializationRegistry): void {
  registry.register({
    id: 'compressed-json',
    extension: 'json',
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
  });
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
