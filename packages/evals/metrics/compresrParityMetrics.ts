import { decode } from '@toon-format/toon';
import { JSONDiff } from 'autoevals';
import { estimateTokens } from '../assertions/tokenBudgets.js';
import type { CompresrParityFixture, CompresrRequiredFact } from '../fixtures/compresrParityFixtures.js';

export type CompresrParityMeasurementInput = {
  fixture: CompresrParityFixture;
  rawText: string;
  compactText: string;
  responseText: string;
  rawArtifactExists: boolean;
  compactArtifactExists: boolean;
};

export type CompresrParityMetrics = {
  name: string;
  rawTokens: number;
  compactTokens: number;
  responseTokens: number;
  compresrBaselineTokens: number;
  utkVsCompresrTokenDelta: number;
  utkVsCompresrTokenRatio: number;
  rawToUtkSavingsRatio: number;
  factRetentionScore: number;
  autoevalsFactScore: number;
  recoverabilityScore: number;
};

export type CompresrParityAssertion = {
  passed: boolean;
  failures: string[];
  metrics: CompresrParityMetrics;
};

export async function measureCompresrParity(input: CompresrParityMeasurementInput): Promise<CompresrParityMetrics> {
  const rawTokens = estimateTokens(input.rawText);
  const compactTokens = estimateTokens(input.compactText);
  const retainedFacts = retainedFactVector(input.fixture.requiredFacts, [input.rawText, input.compactText, input.responseText]);
  const autoevalsResult = await JSONDiff({
    output: retainedFacts,
    expected: Object.fromEntries(input.fixture.requiredFacts.map((fact) => [factKey(fact), true]))
  });
  return {
    name: input.fixture.name,
    rawTokens,
    compactTokens,
    responseTokens: estimateTokens(input.responseText),
    compresrBaselineTokens: input.fixture.compresrBaselineTokens,
    utkVsCompresrTokenDelta: input.fixture.compresrBaselineTokens - compactTokens,
    utkVsCompresrTokenRatio: ratio(compactTokens, input.fixture.compresrBaselineTokens),
    rawToUtkSavingsRatio: rawTokens === 0 ? 0 : 1 - ratio(compactTokens, rawTokens),
    factRetentionScore: factRetentionScore(input.fixture.requiredFacts, [input.rawText, input.compactText, input.responseText]),
    autoevalsFactScore: autoevalsResult.score ?? 0,
    recoverabilityScore: recoverabilityScore(input)
  };
}

export async function assertCompresrParity(input: CompresrParityMeasurementInput): Promise<CompresrParityAssertion> {
  const metrics = await measureCompresrParity(input);
  const failures: string[] = [];
  if (metrics.compactTokens >= metrics.compresrBaselineTokens) {
    failures.push(`${metrics.name}: compactTokens=${metrics.compactTokens} must be less than compresrBaselineTokens=${metrics.compresrBaselineTokens}`);
  }
  if (metrics.factRetentionScore < 1) {
    failures.push(`${metrics.name}: factRetentionScore=${metrics.factRetentionScore}`);
  }
  if (metrics.autoevalsFactScore < input.fixture.minFactScore) {
    failures.push(`${metrics.name}: autoevalsFactScore=${metrics.autoevalsFactScore} < minFactScore=${input.fixture.minFactScore}`);
  }
  if (metrics.recoverabilityScore < 1) {
    failures.push(`${metrics.name}: recoverabilityScore=${metrics.recoverabilityScore}`);
  }
  return { passed: failures.length === 0, failures, metrics };
}

export function factRetentionScore(facts: CompresrRequiredFact[], artifactTexts: string[]): number {
  if (facts.length === 0) return 1;
  return facts.filter((fact) => factIsRetained(fact, artifactTexts)).length / facts.length;
}

export function retainedFactVector(facts: CompresrRequiredFact[], artifactTexts: string[]): Record<string, boolean> {
  return Object.fromEntries(facts.map((fact) => [factKey(fact), factIsRetained(fact, artifactTexts)]));
}

export function recoverabilityScore(input: Pick<CompresrParityMeasurementInput, 'rawArtifactExists' | 'compactArtifactExists' | 'responseText'>): number {
  const hasRawReference = /Tool result stored at: .+output\.raw\.(json|txt|bin)/.test(input.responseText);
  const hasCompactReference = /Compact artifact: .+output\.compact\.(toon|json|tron)/.test(input.responseText);
  const hasSchema = /Schema: \S+/.test(input.responseText);
  return input.rawArtifactExists && input.compactArtifactExists && hasRawReference && hasCompactReference && hasSchema ? 1 : 0;
}

function factIsRetained(fact: CompresrRequiredFact, artifactTexts: string[]): boolean {
  if (fact.kind === 'literal') {
    return artifactTexts.some((text) => text.includes(fact.value));
  }
  return artifactTexts.some((text) => {
    const value = readJsonPath(parseArtifact(text), fact.path);
    return JSON.stringify(value) === JSON.stringify(fact.expected);
  });
}

function parseArtifact(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    try {
      return decode(text);
    } catch {
      return undefined;
    }
  }
}

function readJsonPath(value: unknown, path: string): unknown {
  if (!path.startsWith('$')) return undefined;
  return pathTokens(path).reduce<unknown>((current, token) => {
    if (current === undefined || current === null) return undefined;
    if (typeof token === 'number') return Array.isArray(current) ? current[token] : undefined;
    return typeof current === 'object' ? (current as Record<string, unknown>)[token] : undefined;
  }, value);
}

function pathTokens(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  if (!path.startsWith('$')) return tokens;
  let cursor = 1;
  while (cursor < path.length) {
    if (path[cursor] === '.') {
      cursor += 1;
      const start = cursor;
      while (cursor < path.length && path[cursor] !== '.' && path[cursor] !== '[') cursor += 1;
      if (cursor === start) return [];
      tokens.push(path.slice(start, cursor));
      continue;
    }
    if (path[cursor] === '[') {
      const end = path.indexOf(']', cursor);
      if (end === -1) return [];
      const index = Number(path.slice(cursor + 1, end));
      if (!Number.isInteger(index)) return [];
      tokens.push(index);
      cursor = end + 1;
      continue;
    }
    return [];
  }
  return tokens;
}

function factKey(fact: CompresrRequiredFact): string {
  return fact.kind === 'literal' ? `literal:${fact.value}` : `jsonPath:${fact.path}=${JSON.stringify(fact.expected)}`;
}

function ratio(value: number, baseline: number): number {
  return baseline === 0 ? 0 : value / baseline;
}
