import { canonicalJson } from '../artifact/canonical.js';
import { schemaToToon } from './toon.js';
import { decode } from '@toon-format/toon';

export type ToonPairValidation = { valid: boolean; regenerated?: string; errors: string[] };

export function validateCanonicalToonPair(schema: Record<string, unknown>, toon: string): ToonPairValidation {
  const expected = `${schemaToToon(schema)}\n`;
  try {
    const decoded = decode(toon);
    if (canonicalJson(decoded) === canonicalJson({ schema })) {
      return { valid: true, errors: [] };
    }
  } catch (error) {
    return { valid: false, regenerated: expected, errors: [String(error)] };
  }

  return { valid: false, regenerated: expected, errors: ['TOON artifact drifted from canonical schema'] };
}
