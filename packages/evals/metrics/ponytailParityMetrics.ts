import { JSONDiff } from 'autoevals';
import {
  addMinMapEntry,
  applyMinMapPatch,
  createMinMap,
  expandEmissionSource,
  extractEmissionPatchBlock,
  parseMinMapPatch,
  planEmission,
  type MacroDescriptor,
  type MinMap,
  type MinMapEntry
} from '@utk/emission';
// Importing the language pack registers typescript with the emission core.
import { typescriptAdapter } from '@utk/lang-typescript';
import { estimateTokens } from '../assertions/tokenBudgets.js';
import { requiredTermRetentionScore } from './cavemanParityMetrics.js';
import type { PonytailLadderFixture } from '../fixtures/ponytailParityFixtures.js';

export type PonytailParityInput = {
  scenario: string;
  verboseBaseline: string;
  ponytailBaseline: string;
  minEmission: string;
  expectedPretty: string;
  requiredTerms: string[];
  mapEntries: MinMapEntry[];
  macros: MacroDescriptor[];
  maxTokenRatio?: number;
};

export type PonytailParityMetrics = {
  scenario: string;
  verboseTokens: number;
  ponytailTokens: number;
  utkMinTokens: number;
  prettyTokens: number;
  utkVsPonytailTokenDelta: number;
  utkVsPonytailTokenRatio: number;
  utkVsVerboseTokenDelta: number;
  utkVsVerboseTokenRatio: number;
  roundTripFidelityScore: number;
  parseValidityScore: number;
  minLeakageScore: number;
  requiredTermRetentionScore: number;
  autoevalsFactScore: number;
};

export type PonytailParityAssertion = {
  passed: boolean;
  failures: string[];
  metrics: PonytailParityMetrics;
};

export async function measurePonytailParity(input: PonytailParityInput): Promise<PonytailParityMetrics> {
  const map = buildFixtureMap(input.mapEntries, input.minEmission);
  let pretty = '';
  try {
    const { code } = extractEmissionPatchBlock(input.minEmission);
    pretty = await expandEmissionSource(code, map, input.macros, typescriptAdapter);
  } catch {
    pretty = '';
  }

  const roundTripFidelityScore = pretty === input.expectedPretty ? 1 : 0;
  const parseValidityScore = pretty.length > 0 && typescriptAdapter.isParseable(pretty) ? 1 : 0;
  const autoevalsResult = await JSONDiff({
    output: Object.fromEntries(input.requiredTerms.map((term) => [term, pretty.includes(term)])),
    expected: Object.fromEntries(input.requiredTerms.map((term) => [term, true]))
  });

  return {
    scenario: input.scenario,
    verboseTokens: estimateTokens(input.verboseBaseline),
    ponytailTokens: estimateTokens(input.ponytailBaseline),
    utkMinTokens: estimateTokens(input.minEmission),
    prettyTokens: estimateTokens(pretty),
    utkVsPonytailTokenDelta: estimateTokens(input.ponytailBaseline) - estimateTokens(input.minEmission),
    utkVsPonytailTokenRatio: ratio(estimateTokens(input.minEmission), estimateTokens(input.ponytailBaseline)),
    utkVsVerboseTokenDelta: estimateTokens(input.verboseBaseline) - estimateTokens(input.minEmission),
    utkVsVerboseTokenRatio: ratio(estimateTokens(input.minEmission), estimateTokens(input.verboseBaseline)),
    roundTripFidelityScore,
    parseValidityScore,
    minLeakageScore: minLeakageScore(pretty, map),
    requiredTermRetentionScore: requiredTermRetentionScore(pretty, input.requiredTerms),
    autoevalsFactScore: autoevalsResult.score ?? 0
  };
}

export async function assertPonytailParity(input: PonytailParityInput): Promise<PonytailParityAssertion> {
  const maxTokenRatio = input.maxTokenRatio ?? 1;
  const metrics = await measurePonytailParity(input);
  const failures: string[] = [];

  if (metrics.utkVsPonytailTokenDelta <= 0) {
    failures.push(`${input.scenario}: utkMinTokens=${metrics.utkMinTokens} must be less than ponytailTokens=${metrics.ponytailTokens}`);
  }
  if (metrics.utkVsVerboseTokenDelta <= 0) {
    failures.push(`${input.scenario}: utkMinTokens=${metrics.utkMinTokens} must be less than verboseTokens=${metrics.verboseTokens}`);
  }
  if (metrics.utkVsPonytailTokenRatio > maxTokenRatio) {
    failures.push(`${input.scenario}: utkVsPonytailTokenRatio=${metrics.utkVsPonytailTokenRatio} > maxTokenRatio=${maxTokenRatio}`);
  }
  if (metrics.roundTripFidelityScore < 1) {
    failures.push(`${input.scenario}: roundTripFidelityScore=${metrics.roundTripFidelityScore}`);
  }
  if (metrics.parseValidityScore < 1) {
    failures.push(`${input.scenario}: parseValidityScore=${metrics.parseValidityScore}`);
  }
  if (metrics.minLeakageScore < 1) {
    failures.push(`${input.scenario}: minLeakageScore=${metrics.minLeakageScore}`);
  }
  if (metrics.requiredTermRetentionScore < 1) {
    failures.push(`${input.scenario}: requiredTermRetentionScore=${metrics.requiredTermRetentionScore}`);
  }
  if (metrics.autoevalsFactScore < 1) {
    failures.push(`${input.scenario}: autoevalsFactScore=${metrics.autoevalsFactScore}`);
  }

  return { passed: failures.length === 0, failures, metrics };
}

export type PonytailLadderMetrics = {
  scenario: string;
  selectedRung: number | undefined;
  strategy: string;
  ladderCorrectnessScore: number;
};

export async function measurePonytailLadder(
  workspaceRoot: string,
  fixture: PonytailLadderFixture,
  macros: MacroDescriptor[]
): Promise<PonytailLadderMetrics> {
  const plan = await planEmission({
    workspaceRoot,
    language: 'typescript',
    request: fixture.request,
    capability: fixture.capability,
    ...(fixture.mode !== undefined ? { mode: fixture.mode } : {}),
    ...(macros.length > 0 ? { macros } : {}),
    ...(fixture.dependencyCapabilities !== undefined ? { dependencyCapabilities: fixture.dependencyCapabilities } : {})
  });
  const correct = plan.selectedRung === fixture.expectedRung && plan.strategy === fixture.expectedStrategy;
  return {
    scenario: fixture.name,
    selectedRung: plan.selectedRung,
    strategy: plan.strategy,
    ladderCorrectnessScore: correct ? 1 : 0
  };
}

/** The user boundary is pretty-only: no patch markers and no map min-ids may survive expansion. */
export function minLeakageScore(pretty: string, map: MinMap): number {
  if (pretty.length === 0 || pretty.includes('@minmap') || pretty.includes('@end')) {
    return 0;
  }
  const minIds = new Set(map.entries.map((entry) => entry.minId));
  for (const identifier of typescriptAdapter.collectIdentifiers(pretty)) {
    if (minIds.has(identifier)) {
      return 0;
    }
  }
  return 1;
}

function buildFixtureMap(mapEntries: MinMapEntry[], minEmission: string): MinMap {
  let map = createMinMap('typescript');
  for (const entry of mapEntries) {
    map = addMinMapEntry(map, entry);
  }
  try {
    const { patchText } = extractEmissionPatchBlock(minEmission);
    if (patchText !== undefined) {
      map = applyMinMapPatch(map, parseMinMapPatch(patchText));
    }
  } catch {
    /* leave the base map — downstream scores record the failure */
  }
  return map;
}

function ratio(value: number, baseline: number): number {
  return baseline === 0 ? 0 : value / baseline;
}
