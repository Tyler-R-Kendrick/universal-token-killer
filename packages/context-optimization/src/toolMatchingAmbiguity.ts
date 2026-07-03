import type { ToolCandidate } from './toolMatchingCandidates.js';
import { normalizePhrase } from './toolLexicalScoring.js';

export function isAmbiguousSearchRequest(request: string, candidates: ToolCandidate[]): boolean {
  const normalized = normalizePhrase(request);
  const searchCandidates = candidates.filter((candidate) => candidate.searchLike);
  return searchCandidates.length > 1 &&
    startsWithGenericSearchVerb(normalized) &&
    !hasDistinctSearchAlias(normalized, searchCandidates);
}

function startsWithGenericSearchVerb(normalized: string): boolean {
  return /^(?:(?:ambiguous|unclear|generic)\s+)?(?:search|find|look for|look up|lookup|query)\b/.test(normalized);
}

function hasDistinctSearchAlias(normalized: string, candidates: ToolCandidate[]): boolean {
  return candidates.some((candidate) =>
    candidate.aliases.some((alias) => {
      const normalizedAlias = normalizePhrase(alias);
      return startsWithGenericSearchVerb(normalizedAlias) &&
        normalizedAlias.length > 0 &&
        (normalized === normalizedAlias || normalized.startsWith(`${normalizedAlias} `));
    })
  );
}
