import { schemaToToon } from './toon.js';

export type ToonPairValidation = { valid: boolean; regenerated?: string; errors: string[] };

export function validateCanonicalToonPair(schema: Record<string, unknown>, toon: string): ToonPairValidation {
  const expected = `${schemaToToon(schema)}\n`;
  if (toon === expected || toon.trim() === expected.trim()) {
    return { valid: true, errors: [] };
  }

  return { valid: false, regenerated: expected, errors: ['TOON artifact drifted from canonical schema'] };
}
