import type { UtkConfig } from '../config/config.js';
import type { ToolCandidate } from './toolMatchingCandidates.js';
import type { CandidateScore } from './toolMatchingScoreTypes.js';
import { inferCommandTail, uniqueWinner } from './toolMatchingSelection.js';
import { lexicalScore } from './toolLexicalScoring.js';

export function selectLexicalCandidate(request: string, candidates: ToolCandidate[], config: UtkConfig): CandidateScore | undefined {
  const scores = candidates.map((candidate) => {
    const score = lexicalScore(request, candidate);
    return { candidate, score, reason: 'lexical-similarity' as const, tail: inferCommandTail(request, candidate) };
  }).filter((item) => item.score > 0);
  return uniqueWinner(scores, config.tool_matching.lexical_similarity_threshold, config.tool_matching.winner_gap);
}
