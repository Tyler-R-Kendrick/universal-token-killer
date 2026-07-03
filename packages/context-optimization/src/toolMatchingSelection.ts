import type { ToolCandidate } from './toolMatchingCandidates.js';
import type { CandidateScore } from './toolMatchingScoreTypes.js';
import { regexPhrase } from './toolText.js';

export function uniqueWinner(scores: CandidateScore[], threshold: number, winnerGap: number): CandidateScore | undefined {
  const viable = scores
    .filter((score) => score.score >= threshold)
    .sort((left, right) => right.score - left.score || left.candidate.name.localeCompare(right.candidate.name));
  const [winner, runnerUp] = viable;
  if (!winner) return undefined;
  if (runnerUp && winner.score - runnerUp.score < winnerGap) return undefined;
  return winner;
}

export function inferCommandTail(request: string, candidate: ToolCandidate): string {
  return stripAliasPrefix(request, candidate) ?? request;
}

export function stripAliasPrefix(text: string, candidate: ToolCandidate): string | undefined {
  for (const alias of [...candidate.aliases].sort((left, right) => right.length - left.length)) {
    const tail = stripAliasPrefixForAlias(text, alias);
    if (tail !== undefined) return tail;
  }
  return undefined;
}

export function stripAliasPrefixForAlias(text: string, alias: string): string | undefined {
  const phrase = regexPhrase(alias);
  if (!phrase) return undefined;
  const match = new RegExp(`^\\s*${phrase}\\b`, 'iu').exec(text);
  const matched = match?.[0];
  return matched ? text.slice(matched.length).trim() : undefined;
}
