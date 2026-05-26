import { estimateTokens } from '../assertions/tokenBudgets.js';
import type { CodeGraphRagFixture } from '../fixtures/codeGraphRagFixtures.js';

export type CodeGraphRagCandidate = {
  name: string;
  filePath: string;
  kind?: string;
};

export type CodeGraphRagMeasurementInput = {
  fixture: CodeGraphRagFixture;
  rankedSymbols: CodeGraphRagCandidate[];
  compactText: string;
  rawArtifactExists: boolean;
  compactArtifactExists: boolean;
};

export type CodeGraphRagMetrics = {
  recallAt1: number;
  recallAt5: number;
  mrr: number;
  visibleTokens: number;
  serenaBaselineTokens: number;
  tokenRatioVsSerena: number;
  recoverability: number;
  noRawLeakage: number;
};

export type CodeGraphRagAssertion = {
  passed: boolean;
  failures: string[];
  metrics: CodeGraphRagMetrics;
};

export function measureCodeGraphRag(input: CodeGraphRagMeasurementInput): CodeGraphRagMetrics {
  const rank = expectedRank(input.fixture, input.rankedSymbols);
  const visibleTokens = estimateTokens(input.compactText);
  return {
    recallAt1: rank === 1 ? 1 : 0,
    recallAt5: rank > 0 && rank <= 5 ? 1 : 0,
    mrr: rank > 0 ? Number((1 / rank).toFixed(3)) : 0,
    visibleTokens,
    serenaBaselineTokens: input.fixture.serenaBaselineTokens,
    tokenRatioVsSerena: Number((visibleTokens / input.fixture.serenaBaselineTokens).toFixed(3)),
    recoverability: input.rawArtifactExists && input.compactArtifactExists ? 1 : 0,
    noRawLeakage: input.fixture.forbiddenSnippets.every((snippet) => !input.compactText.includes(snippet)) ? 1 : 0,
  };
}

export function assertCodeGraphRag(input: CodeGraphRagMeasurementInput): CodeGraphRagAssertion {
  const metrics = measureCodeGraphRag(input);
  const failures: string[] = [];
  if (metrics.recallAt5 < 1) failures.push(`${input.fixture.name}: recall@5=0`);
  if (metrics.mrr <= 0) failures.push(`${input.fixture.name}: mrr=0`);
  if (metrics.tokenRatioVsSerena > 0.6) {
    failures.push(`${input.fixture.name}: tokenRatioVsSerena=${metrics.tokenRatioVsSerena}`);
  }
  if (metrics.recoverability !== 1) failures.push(`${input.fixture.name}: recoverability=0`);
  if (metrics.noRawLeakage !== 1) failures.push(`${input.fixture.name}: noRawLeakage=0`);
  return { passed: failures.length === 0, failures, metrics };
}

function expectedRank(fixture: CodeGraphRagFixture, rankedSymbols: CodeGraphRagCandidate[]): number {
  const index = rankedSymbols.findIndex((symbol) => {
    if (symbol.name !== fixture.expectedSymbol.name) return false;
    if (normalizePath(symbol.filePath) !== normalizePath(fixture.expectedSymbol.filePath)) return false;
    return !fixture.expectedSymbol.kind || symbol.kind === fixture.expectedSymbol.kind;
  });
  return index === -1 ? 0 : index + 1;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
