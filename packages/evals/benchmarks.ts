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
 */
export function scoreArmOutput(benchmark: Benchmark, testCase: BenchmarkCase, armKind: ArmKind, output: ArmOutput): { context: RunContext; outcome: RunOutcome } {
  const retrievedContextTokens = estimateTokens(testCase.rawOutput);
  const visibleTokens = estimateTokens(output.visibleText);
  const isToolSelection = benchmark.kind === 'tool-selection';
  // The visible payload is charged to exactly one bucket: for tool selection it is
  // the tool catalog (tool-schema tokens); for every other kind it is compacted
  // context. Keeping them disjoint avoids double-counting in input_tokens.
  const context: RunContext = {
    retrievedContextTokens,
    compressedContextTokens: isToolSelection ? 0 : visibleTokens,
    promptTokens: estimateTokens(testCase.prompt),
    outputTokens: OUTPUT_TOKENS[benchmark.kind],
    toolSchemaTokens: isToolSelection ? visibleTokens : 0,
    compresses: armKind !== 'baseline'
  };

  const factsRetained = retentionRatio(testCase.requiredFacts, output.recoverableText) === 1;
  const relevance = exclusionRatio(testCase.irrelevantFacts, output.visibleText);
  const accuracy = retentionRatio(testCase.requiredFacts, output.recoverableText);
  // Weight accuracy (fact retention) twice against relevance: dropping a required
  // fact is a correctness failure and matters more than leaving some noise visible.
  const quality = round((relevance + accuracy + accuracy) / 3);
  const recoveryToolCalls = armKind === 'utk' ? 1 : 0;

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

function round(value: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
