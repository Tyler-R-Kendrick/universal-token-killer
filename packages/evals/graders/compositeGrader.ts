import { fileURLToPath } from 'node:url';
import { gradeRelevance } from './relevanceGrader.js';
import { gradeTokens } from './tokenGrader.js';
import {
  parseActual,
  parseExpected,
  promptFromInput,
  round,
  runGraderCli,
  type AgentVGraderInput,
  type GraderResult,
  type Judge
} from './shared.js';

export type CompositeWeights = { tokens: number; quality: number };

export type CompositeGradeInput = {
  prompt: string;
  visibleText: string;
  recoverableText: string;
  baselineText: string;
  requiredFacts: string[];
  irrelevantFacts: string[];
  judge?: Judge;
  /** Relative weights for the token and quality components (default 0.5 / 0.5). */
  weights?: CompositeWeights;
  /** Minimum per-dimension quality required for token savings to count (default 1). */
  qualityGate?: number;
  minSavings?: number;
};

export type CompositeGraderResult = GraderResult & {
  components: { tokens: GraderResult; quality: GraderResult };
};

const DEFAULT_WEIGHTS: CompositeWeights = { tokens: 0.5, quality: 0.5 };

/**
 * **Composite grader**: combines the token (code) grader and the relevance (LLM)
 * grader. Quality is a hard gate — per the repo rule "token savings do not count
 * if quality drops", a technique that loses a required fact or dumps noise scores
 * 0 no matter how many tokens it saved. When quality clears the gate the score is
 * the weighted blend of savings and quality.
 */
export async function gradeComposite(input: CompositeGradeInput): Promise<CompositeGraderResult> {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const qualityGate = input.qualityGate ?? 1;
  const tokens = gradeTokens({ visibleText: input.visibleText, baselineText: input.baselineText, minSavings: input.minSavings });
  const quality = await gradeRelevance({
    prompt: input.prompt,
    visibleText: input.visibleText,
    recoverableText: input.recoverableText,
    requiredFacts: input.requiredFacts,
    irrelevantFacts: input.irrelevantFacts,
    judge: input.judge,
    threshold: qualityGate
  });

  // Hard gate on fact retention only: losing a required fact is a correctness
  // failure that zeroes the score. Keeping noise lowers the soft relevance
  // component but is not an outright fail.
  const accuracy = quality.metrics?.accuracy ?? 0;
  const groundedness = quality.metrics?.groundedness ?? 0;
  const factsRetained = accuracy >= qualityGate && groundedness >= qualityGate;
  const totalWeight = weights.tokens + weights.quality || 1;
  const blended = (weights.tokens * tokens.score + weights.quality * quality.score) / totalWeight;
  const score = factsRetained ? round(blended) : 0;

  return {
    score,
    assertions: [
      { text: `facts retained (accuracy & groundedness >= ${qualityGate})`, passed: factsRetained },
      ...tokens.assertions,
      ...quality.assertions
    ],
    reasoning: factsRetained
      ? `Facts retained; blended score ${score} (tokens ${tokens.score}, quality ${quality.score}).`
      : `Fact-retention gate FAILED — token savings do not count. ${quality.reasoning}`,
    metrics: {
      composite: score,
      tokenScore: tokens.score,
      qualityScore: quality.score,
      ...tokens.metrics,
      ...quality.metrics
    },
    components: { tokens, quality }
  };
}

function gradeFromAgentV(input: AgentVGraderInput): Promise<GraderResult> {
  const expected = parseExpected(input.expected_output);
  const actual = parseActual(input.output);
  return gradeComposite({
    prompt: expected.prompt ?? promptFromInput(input.input),
    visibleText: actual.visibleText,
    recoverableText: actual.recoverableText,
    baselineText: expected.rawOutput ?? '',
    requiredFacts: expected.requiredFacts ?? [],
    irrelevantFacts: expected.irrelevantFacts ?? []
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runGraderCli(gradeFromAgentV);
}

export { gradeFromAgentV as gradeCompositeFromAgentV };
