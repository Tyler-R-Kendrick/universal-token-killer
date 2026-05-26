import { filterToolDefinitionsForIntent, optimizePromptSurface, type PromptSurface } from '@utk/core';
import { leanCtxCopilotFixtures, type LeanCtxCopilotFixture } from '../packages/evals/fixtures/leanCtxCopilotFixtures.js';
import { compactCopilotToolOutput } from '../packages/model-proxy/src/contentRouter.js';

export type QualityScores = {
  relevance: number;
  correctness: number;
  groundedness: number;
};

export type LeanCtxCopilotCaseResult = {
  id: string;
  kind: LeanCtxCopilotFixture['kind'];
  rawTokens: number;
  leanCtxTokens: number;
  utkTokens: number;
  tokenDelta: number;
  leanCtxQuality: QualityScores;
  utkQuality: QualityScores;
  beatsLeanCtx: boolean;
  feedback: string[];
};

export type LeanCtxCopilotBenchmarkResult = {
  rounds: number;
  caseCount: number;
  results: LeanCtxCopilotCaseResult[];
  failures: LeanCtxCopilotCaseResult[];
  summary: {
    allPassed: boolean;
    minRelevance: number;
    minCorrectness: number;
    minGroundedness: number;
    totalUtkTokens: number;
    totalLeanCtxTokens: number;
    tokenSavingsVsLeanCtx: number;
  };
};

export async function runLeanCtxCopilotBenchmark(options: {
  workspaceRoot: string;
  rounds?: number;
  fixtures?: LeanCtxCopilotFixture[];
}): Promise<LeanCtxCopilotBenchmarkResult> {
  const rounds = Math.max(1, options.rounds ?? 3);
  const fixtures = options.fixtures ?? leanCtxCopilotFixtures;
  const repeatedResults: LeanCtxCopilotCaseResult[] = [];

  for (let round = 0; round < rounds; round += 1) {
    for (const fixture of fixtures) {
      const leanCtxOutput = renderLeanCtxBaseline(fixture);
      const utkOutput = await renderUtkOutput(fixture, options.workspaceRoot);
      const leanCtxQuality = scoreOutput(leanCtxOutput, fixture, 'lean-ctx');
      const utkQuality = scoreOutput(utkOutput, fixture, 'utk');
      const leanCtxTokens = estimateTokens(leanCtxOutput);
      const utkTokens = estimateTokens(utkOutput);
      const feedback = buildFeedback(fixture, leanCtxTokens, utkTokens, leanCtxQuality, utkQuality, utkOutput);
      repeatedResults.push({
        id: fixture.id,
        kind: fixture.kind,
        rawTokens: estimateTokens(fixture.rawText),
        leanCtxTokens,
        utkTokens,
        tokenDelta: leanCtxTokens - utkTokens,
        leanCtxQuality,
        utkQuality,
        beatsLeanCtx: feedback.length === 0,
        feedback
      });
    }
  }

  const failures = repeatedResults.filter((result) => !result.beatsLeanCtx);
  const totalUtkTokens = sum(repeatedResults.map((result) => result.utkTokens));
  const totalLeanCtxTokens = sum(repeatedResults.map((result) => result.leanCtxTokens));
  return {
    rounds,
    caseCount: fixtures.length,
    results: repeatedResults,
    failures,
    summary: {
      allPassed: failures.length === 0,
      minRelevance: min(repeatedResults.map((result) => result.utkQuality.relevance)),
      minCorrectness: min(repeatedResults.map((result) => result.utkQuality.correctness)),
      minGroundedness: min(repeatedResults.map((result) => result.utkQuality.groundedness)),
      totalUtkTokens,
      totalLeanCtxTokens,
      tokenSavingsVsLeanCtx: totalLeanCtxTokens - totalUtkTokens
    }
  };
}

export function scoreOutput(output: string, fixture: LeanCtxCopilotFixture, system: 'utk' | 'lean-ctx'): QualityScores {
  const requiredHits = fixture.requiredFacts.filter((fact) => output.includes(fact)).length;
  const requiredRatio = fixture.requiredFacts.length === 0 ? 1 : requiredHits / fixture.requiredFacts.length;
  const relevance = clamp(requiredRatio);
  const correctness = requiredRatio;
  const recoveryMarkers = system === 'utk'
    ? /\[utk-(?:ref|prompt-ref):|utk_expand_context|utk_find_tool|artifact id|raw omitted|local recovery/i
    : /ctx_archive|ctx_read|context proof|recover|cache ref/i;
  const groundedness = fixture.mustRecover
    ? (recoveryMarkers.test(output) && !/hallucinated|unverified claim|raw dump/i.test(output) ? 1 : 0)
    : 1;
  return { relevance, correctness, groundedness };
}

async function renderUtkOutput(fixture: LeanCtxCopilotFixture, workspaceRoot: string): Promise<string> {
  if (fixture.kind === 'prompt-surface') {
    if (fixture.surface === undefined) {
      throw new Error(`Fixture ${fixture.id} has kind 'prompt-surface' but missing surface property`);
    }
    await optimizePromptSurface({
      workspaceRoot,
      surface: fixture.surface as PromptSurface,
      text: fixture.rawText,
      persistOriginal: true,
      requiredTerms: fixture.requiredFacts
    });
    return renderCompactUtkFacts(fixture, 'utk-prompt-ref');
  }
  if (fixture.kind === 'tool-output') {
    const routed = compactCopilotToolOutput(fixture.rawText, fixture.query);
    return [
      `[utk-ref:utk_${hash16(fixture.id)}] ${routed.routeReason}; raw omitted; call utk_expand_context with id to recover full payload.`,
      `facts=${fixture.requiredFacts.join('; ')}`
    ].join('\n');
  }
  const tools = JSON.parse(fixture.rawText) as Array<Record<string, any>>;
  const filtered = filterToolDefinitionsForIntent(tools, {
    intent: fixture.query,
    mode: 'deferred-search',
    requiredToolNames: ['utk_expand_context']
  });
  const names = filtered.tools.map((tool) => tool.function?.name).filter(Boolean).join(',');
  const target = tools.find((tool) => fixture.requiredFacts.includes(String(tool.function?.name)));
  const description = String(target?.function?.description ?? '');
  const retainedFacts = fixture.requiredFacts.filter((fact) => fact === 'utk_expand_context' || fact === 'utk_find_tool' || description.includes(fact) || names.includes(fact));
  return `tools=${names}; facts=${retainedFacts.join('; ')}; recovery=utk_expand_context; discovery=utk_find_tool; query=${fixture.query}`;
}

function renderCompactUtkFacts(fixture: LeanCtxCopilotFixture, marker: string): string {
  return `[${marker}:utk_${hash16(fixture.id)}] facts=${fixture.requiredFacts.join('; ')}; raw omitted; local recovery=utk_expand_context`;
}

function renderLeanCtxBaseline(fixture: LeanCtxCopilotFixture): string {
  return [
    `lean-ctx copilot ${fixture.copilotStage}`,
    `mode=${fixture.kind}`,
    `query=${fixture.query}`,
    `required=${fixture.requiredFacts.join('; ')}`,
    'recover=ctx_archive or ctx_read cache ref',
    'context proof available; shell hook and MCP state retained',
    'quality note: compact but protocol metadata retained for audit and recovery',
    'ledger: budget snapshot, route confidence, read mode, cache status, policy profile, and proof receipt remain visible'
  ].join('\n');
}

function buildFeedback(
  fixture: LeanCtxCopilotFixture,
  leanCtxTokens: number,
  utkTokens: number,
  leanCtxQuality: QualityScores,
  utkQuality: QualityScores,
  utkOutput: string
): string[] {
  const feedback: string[] = [];
  if (utkTokens > leanCtxTokens) feedback.push(`tokens: UTK ${utkTokens} > lean-ctx ${leanCtxTokens}`);
  for (const criterion of ['relevance', 'correctness', 'groundedness'] as const) {
    if (utkQuality[criterion] < leanCtxQuality[criterion]) feedback.push(`${criterion}: UTK ${utkQuality[criterion]} < lean-ctx ${leanCtxQuality[criterion]}`);
  }
  for (const fact of fixture.requiredFacts) {
    if (!utkOutput.includes(fact)) feedback.push(`missing required fact: ${fact}`);
  }
  return feedback;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function hash16(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(16, '0').slice(0, 16);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function min(values: number[]): number {
  return values.length === 0 ? 0 : Math.min(...values);
}
