import type { UtkConfig } from '../config/config.js';
import type { ToolCandidate } from './toolMatchingCandidates.js';
import type { CandidateScore } from './toolMatchingScoreTypes.js';
import { stripAliasPrefixForAlias, uniqueWinner } from './toolMatchingSelection.js';

export function selectExactCandidate(request: string, candidates: ToolCandidate[], config: UtkConfig): CandidateScore | undefined {
  const scores: CandidateScore[] = [];
  for (const candidate of candidates) {
    for (const alias of candidate.aliases) {
      const tail = stripAliasPrefixForAlias(request, alias);
      if (tail === undefined) continue;
      const exact = tail === '';
      const withArgs = !exact && looksLikeArgumentTail(tail);
      if (exact || withArgs) {
        scores.push({ candidate, score: exact ? 1 : config.tool_matching.exact_similarity_threshold, reason: 'exact-lexical-match', tail });
        break;
      }
    }
  }
  return uniqueWinner(scores, config.tool_matching.exact_similarity_threshold, config.tool_matching.winner_gap);
}

function looksLikeArgumentTail(tail: string): boolean {
  const text = tail.trim();
  return /^(?:\{|--|[A-Za-z_][\w.-]*=|"|'|https?:\/\/|[A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+)/.test(text) ||
    /\bpackage\s+json\b/i.test(text) ||
    /^(?:src|docs|packages|test|tests|lib)(?:\s+|\/|\\|$)/i.test(text) ||
    /^[a-z0-9_-]+\s+[a-z0-9]{1,8}$/i.test(text);
}
