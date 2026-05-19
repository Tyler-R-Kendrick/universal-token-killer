import { schemaToToon } from './toon.js';
export function validateCanonicalToonPair(schema, toon) {
    const expected = `${schemaToToon(schema)}\n`;
    if (toon === expected || toon.trim() === expected.trim()) {
        return { valid: true, errors: [] };
    }
    return { valid: false, regenerated: expected, errors: ['TOON artifact drifted from canonical schema'] };
}
