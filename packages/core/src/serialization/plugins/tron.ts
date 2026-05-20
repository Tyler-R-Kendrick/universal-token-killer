import { TRON } from '@tron-format/tron';
import { type JsonValue } from '@toon-format/toon';
import { canonicalJson } from '../../artifact/canonical.js';
import type { SerializationRegistry } from '../providers.js';

const TRON_GRAMMAR_SOURCE = String.raw`start: value

?value: class_defs? node
?node: object
     | array
     | constructor
     | string
     | SIGNED_NUMBER
     | "true"
     | "false"
     | "null"

class_defs: class_def+
class_def: "class" NAME ":" NAME ("," NAME)* NEWLINE+
constructor: NAME "(" [value ("," value)*] ")"
object: "{" [pair ("," pair)*] "}"
pair: string ":" value
array: "[" [value ("," value)*] "]"
string: ESCAPED_STRING

%import common.CNAME -> NAME
%import common.ESCAPED_STRING
%import common.SIGNED_NUMBER
%import common.NEWLINE
%import common.WS_INLINE
%ignore WS_INLINE
`;

export function registerUtkSerializerPlugin(registry: SerializationRegistry): void {
  registry.register({
    id: 'tron',
    extension: 'tron',
    grammar: {
      format: 'lark',
      source: TRON_GRAMMAR_SOURCE,
      llguidancePrefix: '%llguidance {}'
    },
    serialize(value) {
      return TRON.stringify(toJsonValue(value));
    },
    deserialize(text) {
      return TRON.parse(text);
    },
    validate(value, text) {
      const expected = TRON.stringify(toJsonValue(value));
      try {
        const decoded = TRON.parse(text);
        if (canonicalJson(decoded) === canonicalJson(toJsonValue(value))) {
          return { valid: true, errors: [] };
        }
        return { valid: false, errors: ['TRON artifact drifted from canonical value'], regenerated: expected };
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
