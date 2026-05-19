import type { FieldGrammar, SeparatorStats } from './fieldGrammar.js';

export function subtractFieldGrammar(current: FieldGrammar, seed: FieldGrammar): FieldGrammar | undefined {
  const observations = current.observations - seed.observations;
  if (observations <= 0) {
    return undefined;
  }
  const separators: Record<string, SeparatorStats> = {};
  for (const [char, stats] of Object.entries(current.separators)) {
    const seedStats = seed.separators[char] ?? { tight: 0, loose: 0 };
    const tight = Math.max(0, stats.tight - seedStats.tight);
    const loose = Math.max(0, stats.loose - seedStats.loose);
    if (tight === 0 && loose === 0) continue;
    separators[char] = { tight, loose };
  }
  return {
    version: current.version + 1,
    observations,
    separators,
    lengthRange: {
      min: current.lengthRange.min,
      max: current.lengthRange.max
    }
  };
}
