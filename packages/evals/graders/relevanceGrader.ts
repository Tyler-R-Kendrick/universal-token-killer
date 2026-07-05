import { fileURLToPath } from 'node:url';
import {
  mean,
  parseActual,
  parseExpected,
  promptFromInput,
  referenceJudge,
  round,
  runGraderCli,
  type AgentVGraderInput,
  type GraderResult,
  type Judge
} from './shared.js';

export type RelevanceGradeInput = {
  prompt: string;
  visibleText: string;
  recoverableText: string;
  requiredFacts: string[];
  irrelevantFacts: string[];
  /** Quality judge; defaults to the deterministic {@link referenceJudge}. */
  judge?: Judge;
  /** Minimum per-dimension score required to pass (default 1 — no quality loss). */
  threshold?: number;
};

/**
 * Quality grader: scores relevance, accuracy, and groundedness of a compaction
 * via a pluggable {@link Judge}. NOT an LLM grader by default — the default
 * {@link referenceJudge} is deterministic substring bookkeeping, and every
 * committed result was produced with it. A real model judge must be constructed
 * by the caller and passed as `judge`; nothing in this repo does so. Score is the
 * mean of the three dimensions; it passes only when every dimension clears
 * `threshold`.
 */
export async function gradeRelevance(input: RelevanceGradeInput): Promise<GraderResult> {
  const judge = input.judge ?? referenceJudge;
  const threshold = input.threshold ?? 1;
  const scores = await judge({
    prompt: input.prompt,
    visibleText: input.visibleText,
    recoverableText: input.recoverableText,
    requiredFacts: input.requiredFacts,
    irrelevantFacts: input.irrelevantFacts
  });
  const dimensions: Array<[string, number]> = [
    ['relevance', scores.relevance],
    ['accuracy', scores.accuracy],
    ['groundedness', scores.groundedness]
  ];
  const score = mean(dimensions.map(([, value]) => value));
  return {
    score: round(score),
    assertions: dimensions.map(([name, value]) => ({
      text: `${name} ${round(value)} >= ${threshold}`,
      passed: value >= threshold
    })),
    reasoning: `relevance=${round(scores.relevance)}, accuracy=${round(scores.accuracy)}, groundedness=${round(scores.groundedness)}.`,
    metrics: {
      relevance: round(scores.relevance),
      accuracy: round(scores.accuracy),
      groundedness: round(scores.groundedness)
    }
  };
}

function gradeFromAgentV(input: AgentVGraderInput): Promise<GraderResult> {
  const expected = parseExpected(input.expected_output);
  const actual = parseActual(input.output);
  return gradeRelevance({
    prompt: expected.prompt ?? promptFromInput(input.input),
    visibleText: actual.visibleText,
    recoverableText: actual.recoverableText,
    requiredFacts: expected.requiredFacts ?? [],
    irrelevantFacts: expected.irrelevantFacts ?? []
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runGraderCli(gradeFromAgentV);
}

export { gradeFromAgentV as gradeRelevanceFromAgentV };
