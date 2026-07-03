import { fileURLToPath } from 'node:url';
import { estimateTokens } from '../data.js';
import {
  parseActual,
  parseExpected,
  round,
  runGraderCli,
  type AgentVGraderInput,
  type GraderResult
} from './shared.js';

export type TokenGradeInput = {
  /** The model-visible chat surface this arm produced. */
  visibleText: string;
  /** The uncompacted output the arm is measured against. */
  baselineText: string;
  /** Minimum fraction of baseline tokens that must be saved to pass (default 0 — any non-regression). */
  minSavings?: number;
};

/**
 * Deterministic **code grader**: counts model-visible tokens and compares them
 * to the uncompacted baseline. Score is the token-savings ratio in [0, 1]
 * (`1 - visible/baseline`), clamped so a technique that inflates tokens scores 0.
 */
export function gradeTokens(input: TokenGradeInput): GraderResult {
  const visibleTokens = estimateTokens(input.visibleText);
  const baselineTokens = estimateTokens(input.baselineText);
  const savingsRatio = baselineTokens === 0 ? 0 : Math.max(0, 1 - visibleTokens / baselineTokens);
  const minSavings = input.minSavings ?? 0;
  const beatsBaseline = baselineTokens === 0 ? visibleTokens === 0 : visibleTokens < baselineTokens;
  const meetsFloor = savingsRatio >= minSavings;

  return {
    score: round(savingsRatio),
    assertions: [
      { text: `visible tokens ${visibleTokens} < baseline ${baselineTokens}`, passed: beatsBaseline },
      { text: `token savings ${round(savingsRatio)} >= floor ${minSavings}`, passed: meetsFloor }
    ],
    reasoning: `Visible ${visibleTokens} tok vs baseline ${baselineTokens} tok (saved ${round(savingsRatio * 100, 1)}%).`,
    metrics: {
      visibleTokens,
      baselineTokens,
      savingsRatio: round(savingsRatio),
      ratio: baselineTokens === 0 ? 0 : round(visibleTokens / baselineTokens)
    }
  };
}

function gradeFromAgentV(input: AgentVGraderInput): GraderResult {
  const expected = parseExpected(input.expected_output);
  const actual = parseActual(input.output);
  return gradeTokens({ visibleText: actual.visibleText, baselineText: expected.rawOutput ?? '' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runGraderCli(gradeFromAgentV);
}

export { gradeFromAgentV as gradeTokensFromAgentV };
