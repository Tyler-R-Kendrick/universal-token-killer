import { estimateTokens, type BenchmarkCase } from './data.js';
import { retentionRatio, exclusionRatio, type ArmOutput } from './graders/shared.js';
import type { RunContext, RunOutcome } from './metrics.js';

export type ArmKind = 'baseline' | 'competitor' | 'utk';

export type BenchmarkKind = 'compression' | 'needle' | 'tool-selection' | 'workflow';

export type Benchmark = {
  name: string;
  kind: BenchmarkKind;
  title: string;
  description: string;
};

/** The benchmark suite. Each is one table; competitors run across all of them. */
export const BENCHMARKS: Benchmark[] = [
  { name: 'tool-output', kind: 'compression', title: 'Tool output', description: 'Compact CLI/API tool output while keeping the facts recoverable.' },
  { name: 'long-context', kind: 'compression', title: 'Long-context compression', description: 'Compress a long document while the answer must survive (LongBench v2 / RULER analog).' },
  { name: 'needle-in-haystack', kind: 'needle', title: 'Needle-in-a-haystack', description: 'Bury a needle in a large distractor context; the compaction must keep it recoverable.' },
  { name: 'tool-selection', kind: 'tool-selection', title: 'Tool selection', description: 'Compact a tool catalog while the correct (safe) tool stays selectable (BFCL / τ-bench analog).' },
  { name: 'agent-workflows', kind: 'workflow', title: 'Agent workflows', description: 'Keep the fix-relevant context for a multi-step task (SWE-bench Verified / AppWorld analog).' }
];

export function getBenchmark(name: string): Benchmark | undefined {
  return BENCHMARKS.find((b) => b.name === name);
}

/** Modeled model-answer size per kind (output tokens the model would emit). */
const OUTPUT_TOKENS: Record<BenchmarkKind, number> = {
  compression: 48,
  needle: 32,
  'tool-selection': 24,
  workflow: 64
};

/**
 * Score one arm's output for a case, producing the token context + outcome the
 * cost/latency model needs. Facts/selection are checked against the RECOVERABLE
 * surface (what the agent can still reach, possibly via a recovery round-trip);
 * relevance / unsafe-tool exposure is checked against the VISIBLE chat surface.
 *
 * HONESTY NOTE: "task success" here is deterministic verbatim-substring fact
 * retention, not a model completing a task — no LLM is invoked anywhere in this
 * suite. An arm that persists the raw payload (the UTK arm does) retains 100% of
 * facts BY CONSTRUCTION; what the comparison actually measures for such an arm is
 * the token/cost/latency price of keeping facts recoverable, which is why the
 * recovery round-trip is charged both a tool call AND the tokens it returns.
 */
export function scoreArmOutput(benchmark: Benchmark, testCase: BenchmarkCase, armKind: ArmKind, output: ArmOutput): { context: RunContext; outcome: RunOutcome } {
  const retrievedContextTokens = estimateTokens(testCase.rawOutput);
  const visibleTokens = estimateTokens(output.visibleText);
  const isToolSelection = benchmark.kind === 'tool-selection';
  // An arm whose facts are NOT in its visible surface only reaches them through a
  // recovery round-trip, and the payload that round-trip returns re-enters the
  // model context. Charge the minimal slice a selective recovery could return:
  // the raw-output lines containing the required facts. This is an OPTIMISTIC
  // lower bound (a real recovery tool may return far more); charging nothing —
  // as this harness previously did — inflated recovery-based token reductions.
  const factsVisible = retentionRatio(testCase.requiredFacts, output.visibleText) === 1;
  const recoverableRetention = retentionRatio(testCase.requiredFacts, output.recoverableText);
  const needsRecovery = !factsVisible && testCase.requiredFacts.length > 0 && recoverableRetention === 1;
  const recoveredContextTokens = needsRecovery ? estimateTokens(recoverySlice(testCase)) : 0;
  // The visible payload is charged to exactly one bucket: for tool selection it is
  // the tool catalog (tool-schema tokens); for every other kind it is compacted
  // context. Keeping them disjoint avoids double-counting in input_tokens.
  const context: RunContext = {
    retrievedContextTokens,
    compressedContextTokens: isToolSelection ? 0 : visibleTokens,
    promptTokens: estimateTokens(testCase.prompt),
    outputTokens: OUTPUT_TOKENS[benchmark.kind],
    toolSchemaTokens: isToolSelection ? visibleTokens : 0,
    recoveredContextTokens,
    compresses: armKind !== 'baseline'
  };

  const factsRetained = recoverableRetention === 1;
  const relevance = exclusionRatio(testCase.irrelevantFacts, output.visibleText);
  const accuracy = recoverableRetention;
  // Weight accuracy (fact retention) twice against relevance: dropping a required
  // fact is a correctness failure and matters more than leaving some noise visible.
  const quality = round((relevance + accuracy + accuracy) / 3);
  const recoveryToolCalls = needsRecovery ? 1 : 0;

  if (isToolSelection) {
    const unsafeVisible = (testCase.unsafeTools ?? []).some((tool) => output.visibleText.includes(tool));
    const failureCategory = factsRetained ? 'none' : unsafeVisible ? 'unsafe-tool' : 'wrong-tool';
    return {
      context,
      outcome: {
        taskSuccess: factsRetained ? 1 : 0,
        qualityScore: factsRetained ? 1 : 0,
        faithfulnessScore: factsRetained ? 1 : 0,
        failureCategory,
        recoveryToolCalls,
        fallbackCount: factsRetained ? 0 : 1,
        retryCount: factsRetained ? 0 : 1,
        invalidToolCallCount: factsRetained ? 0 : 1
      }
    };
  }

  return {
    context,
    outcome: {
      taskSuccess: factsRetained ? 1 : 0,
      qualityScore: quality,
      faithfulnessScore: round(accuracy),
      failureCategory: factsRetained ? (relevance < 1 ? 'noise-retained' : 'none') : 'fact-loss',
      recoveryToolCalls,
      fallbackCount: factsRetained ? 0 : 1,
      retryCount: 0,
      invalidToolCallCount: 0
    }
  };
}

/**
 * The minimal recovery payload for a case: the deduplicated raw-output lines
 * containing each required fact (falling back to the fact itself when it spans
 * lines). This is what an ideal, perfectly selective recovery tool would return.
 */
export function recoverySlice(testCase: BenchmarkCase): string {
  const lines = testCase.rawOutput.split('\n');
  const slice = new Set<string>();
  for (const fact of testCase.requiredFacts) {
    const matches = lines.filter((line) => line.includes(fact));
    if (matches.length > 0) slice.add(matches[0]!);
    else slice.add(fact);
  }
  return [...slice].join('\n');
}

function round(value: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
