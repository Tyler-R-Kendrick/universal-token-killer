import { TOOL_VERBS } from './toolLexicalProfiles.js';

export type LexicalScoreCandidate = {
  name: string;
  aliases: string[];
  embeddingText: string;
};

const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/i;

export function lexicalScore(request: string, candidate: LexicalScoreCandidate): number {
  const gateScore = lexicalGateScore(request, candidate);
  if (gateScore !== undefined) return gateScore;
  return applyIntentBoosts(request, candidate, baseLexicalScore(request, candidate));
}

export function isSearchLike(name: string, description: string, aliases: string[]): boolean {
  const text = normalizePhrase(`${name} ${description} ${aliases.join(' ')}`);
  return /\b(search|grep|find)\b/.test(text);
}

export function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' url ')
    .replace(/[_\-.]+/g, ' ')
    .replace(/[^a-z0-9@/\\:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function nameTokens(name: string): string[] {
  return name.split(/[_\-.]+/).filter(Boolean).map((token) => token.toLowerCase());
}

export function significantPhrases(description: string): string[] {
  const tokens = tokenize(description).filter((token) => token.length > 2 && !['and', 'the', 'with', 'from', 'such', 'return'].includes(token));
  const phrases: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.push(tokens.slice(index, index + 2).join(' '));
    if (index < tokens.length - 2) phrases.push(tokens.slice(index, index + 3).join(' '));
  }
  return phrases.slice(0, 8);
}

export function isPublicSearchRequest(request: string): boolean {
  return /\b(web\s+search|search\s+web|find\s+online|look\s+up|online|public\s+web)\b/i.test(request);
}

export function isFileOperationRequest(request: string): boolean {
  return /\b(files?|workspace\s+file|path)\b/i.test(request) || /\b[A-Za-z0-9_./\\-]+\.[A-Za-z0-9]+\b/.test(request);
}

export function hasUrl(request: string): boolean {
  return URL_PATTERN.test(request);
}

function lexicalGateScore(request: string, candidate: LexicalScoreCandidate): number | undefined {
  const exactAlias = exactAliasText(request, candidate);
  if (candidate.name === 'fetch' && !hasUrl(request) && !exactAlias) return 0;
  if (isFileMutationTool(candidate.name) && !isFileOperationRequest(request) && !exactAlias) return 0;
  if (candidate.name === 'web_search' && /\b(files?|todo|src|repo)\b/i.test(request) && !isPublicSearchRequest(request)) return 0.2;
  return undefined;
}

function baseLexicalScore(request: string, candidate: LexicalScoreCandidate): number {
  const normalized = normalizePhrase(request);
  let bestAlias = 0;
  for (const alias of candidate.aliases) {
    const aliasText = normalizePhrase(alias);
    if (!aliasText) continue;
    if (normalized.startsWith(`${aliasText} `) || normalized === aliasText) bestAlias = Math.max(bestAlias, 0.92);
    bestAlias = Math.max(bestAlias, similarity(normalized.slice(0, Math.max(aliasText.length, normalized.length)), aliasText));
  }
  const requestTokens = new Set(tokenize(request));
  const candidateTokens = [...new Set(tokenize(candidate.embeddingText).filter((token) => token.length > 2))];
  const overlap = candidateTokens.filter((token) => requestTokens.has(token) || [...requestTokens].some((requestToken) => stem(requestToken) === stem(token))).length;
  const tokenScore = candidateTokens.length === 0 ? 0 : Math.min(1, overlap / Math.min(5, candidateTokens.length));
  const verbScore = TOOL_VERBS.some((verb) => requestTokens.has(verb)) ? 0.08 : 0;
  return Math.min(1, Math.max(bestAlias, tokenScore + verbScore));
}

function applyIntentBoosts(request: string, candidate: LexicalScoreCandidate, baseScore: number): number {
  let score = baseScore;
  const searchIntent = /^\s*(?:fnd|find|serch|search|grep|look)\b/i.test(request) || /\b(todo|project|repo)\b/i.test(request);
  if (candidate.name === 'grep' && searchIntent && /\b(files?|todo|src|repo|project)\b/i.test(request) && !/^\s*(?:lst|ls|list|enumerate)\b/i.test(request)) score = Math.max(score, 0.95);
  if (candidate.name === 'list_files' && /^\s*(?:lst|ls|list|enumerate)\b/i.test(request)) score = Math.max(score, 0.96);
  return score;
}

function exactAliasText(request: string, candidate: LexicalScoreCandidate): boolean {
  const normalized = normalizePhrase(request);
  return candidate.aliases.some((alias) => normalizePhrase(alias) === normalized);
}

function isFileMutationTool(name: string): boolean {
  return name === 'delete_file' || name === 'create_file';
}

function tokenize(value: string): string[] {
  return normalizePhrase(value).split(/\s+/).filter(Boolean).map(stem);
}

function stem(token: string): string {
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('s') && token.length > 3) return token.slice(0, -1);
  return token;
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  const max = Math.max(left.length, right.length);
  const edit = 1 - levenshtein(left, right) / max;
  const dice = diceCoefficient(left, right);
  return Math.max(edit, dice);
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + (left[i - 1] === right[j - 1] ? 0 : 1);
      current[j] = Math.min(deletion, insertion, substitution);
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j] ?? 0;
  }
  return previous[right.length] ?? 0;
}

function diceCoefficient(left: string, right: string): number {
  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);
  if (leftBigrams.length === 0 || rightBigrams.length === 0) return 0;
  const rightCounts = new Map<string, number>();
  for (const item of rightBigrams) rightCounts.set(item, (rightCounts.get(item) ?? 0) + 1);
  let overlap = 0;
  for (const item of leftBigrams) {
    const count = rightCounts.get(item) ?? 0;
    if (count <= 0) continue;
    overlap += 1;
    rightCounts.set(item, count - 1);
  }
  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function bigrams(value: string): string[] {
  const compact = value.replace(/\s+/g, ' ');
  if (compact.length < 2) return [];
  return Array.from({ length: compact.length - 1 }, (_, index) => compact.slice(index, index + 2));
}
