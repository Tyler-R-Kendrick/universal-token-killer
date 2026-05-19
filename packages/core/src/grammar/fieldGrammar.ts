export type SeparatorStats = {
  tight: number;
  loose: number;
};

export type FieldGrammar = {
  version: number;
  observations: number;
  separators: Record<string, SeparatorStats>;
  lengthRange: { min: number; max: number };
};

export function inferFieldGrammar(value: string): FieldGrammar {
  const separators: Record<string, SeparatorStats> = {};

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!;
    if (isAlphanumericOrWhitespace(char)) continue;
    const prev = index > 0 ? value[index - 1]! : '';
    const next = index < value.length - 1 ? value[index + 1]! : '';
    const tight = prev !== '' && next !== '' && !isWhitespace(prev) && !isWhitespace(next);
    const stats = separators[char] ?? { tight: 0, loose: 0 };
    if (tight) stats.tight += 1;
    else stats.loose += 1;
    separators[char] = stats;
  }

  return {
    version: 1,
    observations: 1,
    separators,
    lengthRange: { min: value.length, max: value.length }
  };
}

export function mergeFieldGrammar(current: FieldGrammar | undefined, candidate: FieldGrammar): FieldGrammar {
  if (!current || current.observations === 0) {
    return { ...candidate, version: Math.max(candidate.version, 1) };
  }
  const merged: FieldGrammar = {
    version: current.version + 1,
    observations: current.observations + candidate.observations,
    separators: { ...current.separators },
    lengthRange: {
      min: Math.min(current.lengthRange.min, candidate.lengthRange.min),
      max: Math.max(current.lengthRange.max, candidate.lengthRange.max)
    }
  };
  for (const [separator, stats] of Object.entries(candidate.separators)) {
    const existing = merged.separators[separator] ?? { tight: 0, loose: 0 };
    merged.separators[separator] = {
      tight: existing.tight + stats.tight,
      loose: existing.loose + stats.loose
    };
  }
  return merged;
}

export function normalizeWithFieldGrammar(value: string, grammar: FieldGrammar | undefined): string {
  let normalized = value.trim().replace(/\s+/g, ' ');
  if (!grammar || grammar.observations === 0) return normalized;
  for (const [separator, stats] of Object.entries(grammar.separators)) {
    if (stats.tight <= stats.loose) continue;
    const pattern = new RegExp(`\\s*${escapeRegExp(separator)}\\s*`, 'g');
    normalized = normalized.replace(pattern, separator);
  }
  return normalized;
}

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function isAlphanumericOrWhitespace(char: string): boolean {
  return /[A-Za-z0-9\s]/.test(char);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
