import { JSONDiff } from 'autoevals';
import { estimateTokens } from '../assertions/tokenBudgets.js';

export type CavemanParityInput = {
  scenario: string;
  cavemanBaseline: string;
  candidate: string;
  requiredTerms: string[];
  exactTerms?: string[];
  orderedTerms?: string[];
  forbiddenTerms?: string[];
  requiredPatterns?: string[];
  forbiddenPatterns?: string[];
  maxTokenRatio?: number;
  minFactScore?: number;
};

export type CavemanParityMetrics = {
  scenario: string;
  cavemanTokens: number;
  candidateTokens: number;
  candidateVsCavemanTokenDelta: number;
  candidateVsCavemanTokenRatio: number;
  autoevalsFactScore: number;
  requiredTermRetentionScore: number;
  exactTermRetentionScore: number;
  orderedTermScore: number;
  forbiddenLeakageScore: number;
  requiredPatternScore: number;
  forbiddenPatternScore: number;
};

export type CavemanParityAssertion = {
  passed: boolean;
  failures: string[];
  metrics: CavemanParityMetrics;
};

export async function measureCavemanParity(input: CavemanParityInput): Promise<CavemanParityMetrics> {
  const cavemanTokens = estimateTokens(input.cavemanBaseline);
  const candidateTokens = estimateTokens(input.candidate);
  const autoevalsResult = await JSONDiff({
    output: factVector(input.candidate, input.requiredTerms),
    expected: Object.fromEntries(input.requiredTerms.map((term) => [term, true]))
  });
  const autoevalsFactScore = autoevalsResult.score ?? 0;

  return {
    scenario: input.scenario,
    cavemanTokens,
    candidateTokens,
    candidateVsCavemanTokenDelta: cavemanTokens - candidateTokens,
    candidateVsCavemanTokenRatio: ratio(candidateTokens, cavemanTokens),
    autoevalsFactScore,
    requiredTermRetentionScore: requiredTermRetentionScore(input.candidate, input.requiredTerms),
    exactTermRetentionScore: exactTermRetentionScore(input.candidate, input.exactTerms ?? []),
    orderedTermScore: orderedTermScore(input.candidate, input.orderedTerms ?? []),
    forbiddenLeakageScore: forbiddenLeakageScore(input.candidate, input.forbiddenTerms ?? []),
    requiredPatternScore: requiredPatternScore(input.candidate, input.requiredPatterns ?? []),
    forbiddenPatternScore: forbiddenPatternScore(input.candidate, input.forbiddenPatterns ?? [])
  };
}

export async function assertCavemanParity(input: CavemanParityInput): Promise<CavemanParityAssertion> {
  const maxTokenRatio = input.maxTokenRatio ?? 1;
  const minFactScore = input.minFactScore ?? 1;
  const metrics = await measureCavemanParity(input);
  const failures: string[] = [];

  if (metrics.candidateVsCavemanTokenRatio > maxTokenRatio) {
    failures.push(`${input.scenario}: candidateVsCavemanTokenRatio=${metrics.candidateVsCavemanTokenRatio} > maxTokenRatio=${maxTokenRatio}`);
  }
  if (metrics.candidateVsCavemanTokenDelta <= 0) {
    failures.push(`${input.scenario}: candidateTokens=${metrics.candidateTokens} must be less than cavemanTokens=${metrics.cavemanTokens}`);
  }
  if (metrics.autoevalsFactScore < minFactScore) {
    failures.push(`${input.scenario}: autoevalsFactScore=${metrics.autoevalsFactScore} < minFactScore=${minFactScore}`);
  }
  if (metrics.requiredTermRetentionScore < 1) {
    failures.push(`${input.scenario}: requiredTermRetentionScore=${metrics.requiredTermRetentionScore}`);
  }
  if (metrics.exactTermRetentionScore < 1) {
    failures.push(`${input.scenario}: exactTermRetentionScore=${metrics.exactTermRetentionScore}`);
  }
  if (metrics.orderedTermScore < 1) {
    failures.push(`${input.scenario}: orderedTermScore=${metrics.orderedTermScore}`);
  }
  if (metrics.forbiddenLeakageScore < 1) {
    failures.push(`${input.scenario}: forbiddenLeakageScore=${metrics.forbiddenLeakageScore}`);
  }
  if (metrics.requiredPatternScore < 1) {
    failures.push(`${input.scenario}: requiredPatternScore=${metrics.requiredPatternScore}`);
  }
  if (metrics.forbiddenPatternScore < 1) {
    failures.push(`${input.scenario}: forbiddenPatternScore=${metrics.forbiddenPatternScore}`);
  }

  return { passed: failures.length === 0, failures, metrics };
}

export function requiredTermRetentionScore(text: string, requiredTerms: string[]): number {
  if (requiredTerms.length === 0) return 1;
  return requiredTerms.filter((term) => containsTerm(text, term)).length / requiredTerms.length;
}

export function exactTermRetentionScore(text: string, exactTerms: string[]): number {
  if (exactTerms.length === 0) return 1;
  return exactTerms.filter((term) => text.includes(term)).length / exactTerms.length;
}

export function orderedTermScore(text: string, orderedTerms: string[]): number {
  if (orderedTerms.length <= 1) return 1;
  let cursor = -1;
  for (const term of orderedTerms) {
    const index = text.indexOf(term, cursor + 1);
    if (index === -1) return 0;
    cursor = index;
  }
  return 1;
}

export function forbiddenLeakageScore(text: string, forbiddenTerms: string[]): number {
  if (forbiddenTerms.length === 0) return 1;
  return forbiddenTerms.some((term) => text.includes(term)) ? 0 : 1;
}

export function requiredPatternScore(text: string, patterns: string[]): number {
  if (patterns.length === 0) return 1;
  return patterns.filter((pattern) => new RegExp(pattern).test(text)).length / patterns.length;
}

export function forbiddenPatternScore(text: string, patterns: string[]): number {
  if (patterns.length === 0) return 1;
  return patterns.some((pattern) => new RegExp(pattern).test(text)) ? 0 : 1;
}

function factVector(text: string, requiredTerms: string[]): Record<string, boolean> {
  return Object.fromEntries(requiredTerms.map((term) => [term, containsTerm(text, term)]));
}

function containsTerm(text: string, term: string): boolean {
  return text.toLowerCase().includes(term.toLowerCase());
}

function ratio(value: number, baseline: number): number {
  return baseline === 0 ? 0 : value / baseline;
}
