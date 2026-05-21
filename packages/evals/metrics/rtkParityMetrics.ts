import { decode } from '@toon-format/toon';
import { JSONDiff } from 'autoevals';
import { estimateTokens } from '../assertions/tokenBudgets.js';
import type { RequiredFact, RtkParityFixture } from '../fixtures/rtkParityFixtures.js';

export type RtkParityMeasurementInput = {
  fixture: RtkParityFixture;
  rawText: string;
  compactText: string;
  responseText: string;
  rawArtifactExists: boolean;
  compactArtifactExists: boolean;
};

export type RtkParityMetrics = {
  name: string;
  rawBytes: number;
  rawTokens: number;
  utkResponseBytes: number;
  utkResponseTokens: number;
  utkCompactBytes: number;
  utkCompactTokens: number;
  rtkBytes: number;
  rtkTokens: number;
  utkVsRtkTokenDelta: number;
  utkVsRtkTokenRatio: number;
  rawToUtkSavingsRatio: number;
  factRetentionScore: number;
  recoverabilityScore: number;
};

export type RtkParityAssertion = {
  passed: boolean;
  failures: string[];
  metrics: RtkParityMetrics;
};

export type RtkParityAutoevalsMetrics = RtkParityMetrics & {
  autoevalsFactScore: number;
};

export type RtkParityAutoevalsAssertion = {
  passed: boolean;
  failures: string[];
  metrics: RtkParityAutoevalsMetrics;
};

export function measureRtkParity(input: RtkParityMeasurementInput): RtkParityMetrics {
  const rawBytes = Buffer.byteLength(input.rawText);
  const rawTokens = estimateTokens(input.rawText);
  const utkCompactTokens = estimateTokens(input.compactText);
  return {
    name: input.fixture.name,
    rawBytes,
    rawTokens,
    utkResponseBytes: Buffer.byteLength(input.responseText),
    utkResponseTokens: estimateTokens(input.responseText),
    utkCompactBytes: Buffer.byteLength(input.compactText),
    utkCompactTokens,
    rtkBytes: input.fixture.rtkBaselineBytes,
    rtkTokens: input.fixture.rtkBaselineTokens,
    utkVsRtkTokenDelta: input.fixture.rtkBaselineTokens - utkCompactTokens,
    utkVsRtkTokenRatio: ratio(utkCompactTokens, input.fixture.rtkBaselineTokens),
    rawToUtkSavingsRatio: rawTokens === 0 ? 0 : 1 - ratio(utkCompactTokens, rawTokens),
    factRetentionScore: factRetentionScore(input.fixture.requiredFacts, [input.rawText, input.compactText, input.responseText]),
    recoverabilityScore: recoverabilityScore(input)
  };
}

export async function measureRtkParityWithAutoevals(input: RtkParityMeasurementInput): Promise<RtkParityAutoevalsMetrics> {
  const metrics = measureRtkParity(input);
  const autoevalsResult = await JSONDiff({
    output: retainedFactVector(input.fixture.requiredFacts, [input.rawText, input.compactText, input.responseText]),
    expected: Object.fromEntries(input.fixture.requiredFacts.map((fact) => [factKey(fact), true]))
  });
  return {
    ...metrics,
    autoevalsFactScore: autoevalsResult.score ?? 0
  };
}

export function assertRtkParity(input: RtkParityMeasurementInput): RtkParityAssertion {
  const metrics = measureRtkParity(input);
  const failures: string[] = [];
  if (metrics.factRetentionScore !== 1) {
    failures.push(`${metrics.name}: factRetentionScore=${metrics.factRetentionScore}`);
  }
  if (metrics.recoverabilityScore !== 1) {
    failures.push(`${metrics.name}: recoverabilityScore=${metrics.recoverabilityScore}`);
  }
  if (input.fixture.rtkSupported && metrics.utkCompactTokens >= metrics.rtkTokens) {
    failures.push(`${metrics.name}: utkCompactTokens=${metrics.utkCompactTokens} must be strictly less than rtkTokens=${metrics.rtkTokens}`);
  }
  if (!input.fixture.rtkSupported && metrics.utkCompactTokens > metrics.rawTokens * 0.35) {
    failures.push(`${metrics.name}: utkCompactTokens=${metrics.utkCompactTokens} > rawTokens*0.35=${metrics.rawTokens * 0.35}`);
  }
  return { passed: failures.length === 0, failures, metrics };
}

export async function assertRtkParityWithAutoevals(input: RtkParityMeasurementInput): Promise<RtkParityAutoevalsAssertion> {
  const base = assertRtkParity(input);
  const metrics = await measureRtkParityWithAutoevals(input);
  const failures = [...base.failures];
  if (metrics.autoevalsFactScore !== 1) {
    failures.push(`${metrics.name}: autoevalsFactScore=${metrics.autoevalsFactScore}`);
  }
  return { passed: failures.length === 0, failures, metrics };
}

export function factRetentionScore(facts: RequiredFact[], artifactTexts: string[]): number {
  if (facts.length === 0) return 1;
  const retained = facts.filter((fact) => factIsRetained(fact, artifactTexts)).length;
  return retained / facts.length;
}

export function retainedFactVector(facts: RequiredFact[], artifactTexts: string[]): Record<string, boolean> {
  return Object.fromEntries(facts.map((fact) => [factKey(fact), factIsRetained(fact, artifactTexts)]));
}

export function recoverabilityScore(input: Pick<RtkParityMeasurementInput, 'rawArtifactExists' | 'compactArtifactExists' | 'responseText'>): number {
  const hasRawReference = /Tool result stored at: .+output\.raw\.(json|txt|bin)/.test(input.responseText);
  const hasCompactReference = /Compact artifact: .+output\.compact\.(toon|json|tron)/.test(input.responseText);
  const hasSchema = /Schema: \S+/.test(input.responseText);
  return input.rawArtifactExists && input.compactArtifactExists && hasRawReference && hasCompactReference && hasSchema ? 1 : 0;
}

function factIsRetained(fact: RequiredFact, artifactTexts: string[]): boolean {
  if (fact.kind === 'literal') {
    return artifactTexts.some((text) => text.includes(fact.value));
  }
  return artifactTexts.some((text) => {
    const value = readJsonPath(parseArtifact(text), fact.path);
    return JSON.stringify(value) === JSON.stringify(fact.expected);
  });
}

function factKey(fact: RequiredFact): string {
  return fact.kind === 'literal' ? `literal:${fact.value}` : `jsonPath:${fact.path}=${JSON.stringify(fact.expected)}`;
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
      while (cursor < path.length && path[cursor] !== '.' && path[cursor] !== '[') {
        cursor += 1;
      }
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

function ratio(value: number, baseline: number): number {
  return baseline === 0 ? 0 : value / baseline;
}
