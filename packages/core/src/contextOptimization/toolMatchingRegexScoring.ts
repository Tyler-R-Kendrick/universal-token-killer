import type { UtkConfig } from '../config/config.js';
import type { ToolCandidate } from './toolMatchingCandidates.js';
import { selectExactCandidate } from './toolMatchingExactScoring.js';
import { hasUrl, isFileOperationRequest, isPublicSearchRequest } from './toolLexicalScoring.js';
import type { CandidateScore } from './toolMatchingScoreTypes.js';
import { uniqueWinner } from './toolMatchingSelection.js';

const MAX_REGEX_INPUT_LENGTH = 512;

export function selectRegexCandidate(request: string, candidates: ToolCandidate[], config: UtkConfig): CandidateScore | undefined {
  const politeRequest = stripPolitePrefix(request);
  const politeExact = request !== politeRequest ? selectExactCandidate(politeRequest, candidates, config) : undefined;
  if (politeExact) return { ...politeExact, reason: 'regex-pattern', score: Math.max(0.9, politeExact.score - 0.04) };

  const bounded = request.slice(0, MAX_REGEX_INPUT_LENGTH);
  const scores: CandidateScore[] = [];
  for (const candidate of candidates) {
    if (rejectRegexCandidate(request, candidate)) continue;
    for (const regex of candidate.regexes) {
      regex.pattern.lastIndex = 0;
      const match = regex.pattern.exec(bounded);
      if (!match) continue;
      const captures = namedCaptures(match.groups);
      const tail = captures.tail ?? inferTailFromMatch(request, match);
      const matchedText = match[0] ?? '';
      const score = regex.configured ? 0.97 : 0.9 + Math.min(0.08, matchedText.length / 200);
      scores.push({ candidate, score, reason: 'regex-pattern', configuredRegex: regex.configured, captures, tail });
      break;
    }
  }
  return uniqueWinner(scores, 0.86, config.tool_matching.winner_gap);
}

function stripPolitePrefix(request: string): string {
  return request.replace(/^\s*please\s+/i, '');
}

function rejectRegexCandidate(request: string, candidate: ToolCandidate): boolean {
  if (candidate.name === 'grep' && isPublicSearchRequest(request)) return true;
  if (candidate.name === 'read_file' && hasUrl(request)) return true;
  return isFileMutationTool(candidate.name) && !isFileOperationRequest(request);
}

function isFileMutationTool(name: string): boolean {
  return name === 'delete_file' || name === 'create_file';
}

function inferTailFromMatch(request: string, match: RegExpExecArray): string {
  const index = match.index + (match[0] ?? '').length;
  return request.slice(index).trim();
}

function namedCaptures(groups: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(groups ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}
