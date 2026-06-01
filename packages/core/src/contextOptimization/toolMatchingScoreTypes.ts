import type { ToolCandidate } from './toolMatchingCandidates.js';

export type MatchReason = 'slash-command' | 'embedding' | 'exact-lexical-match' | 'regex-pattern' | 'lexical-similarity';

export type CandidateScore = {
  candidate: ToolCandidate;
  score: number;
  reason: Exclude<MatchReason, 'slash-command'>;
  configuredRegex?: boolean;
  captures?: Record<string, string>;
  tail?: string;
};
