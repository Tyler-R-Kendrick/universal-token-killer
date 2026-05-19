import type { Evaluator, EvaluatorInput, EvaluatorOutput, EvalSetToolUse } from './types.js';

export type ExpectedToolCall = { name: string; args?: Record<string, unknown> };

export const toolTrajectoryAvgScore: Evaluator = {
  metricName: 'tool_trajectory_avg_score',
  description: 'Average per-invocation ratio of expected tool calls that were observed, in the right order.',
  rubric: [
    'Every expected tool call appears at least once.',
    'Tool calls appear in the expected order.',
    'Each expected argument key/value pair is present in the observed args.'
  ],
  async evaluate(input: EvaluatorInput): Promise<EvaluatorOutput> {
    const perInvocationScores = input.invocations.map((invocation) => {
      const expected = readExpected(input.config, invocation.invocation_id);
      const observed = invocation.intermediate_data.tool_uses;
      return scoreOne(expected, observed);
    });
    const score = perInvocationScores.length === 0
      ? 0
      : perInvocationScores.reduce((sum, value) => sum + value, 0) / perInvocationScores.length;
    const passed = score >= input.threshold;
    return {
      score,
      status: passed ? 'PASSED' : 'FAILED',
      per_invocation_scores: perInvocationScores,
      details: { reason: passed ? 'observed trajectory matches expected within threshold' : 'observed trajectory diverged from expected' }
    };
  }
};

function readExpected(config: Record<string, unknown>, invocationId: string): ExpectedToolCall[] {
  const expected = config.expected;
  if (!expected || typeof expected !== 'object') return [];
  const entry = (expected as Record<string, unknown>)[invocationId];
  return Array.isArray(entry) ? (entry as ExpectedToolCall[]) : [];
}

export function scoreOne(expected: ExpectedToolCall[], observed: EvalSetToolUse[]): number {
  if (expected.length === 0) return 1;
  let matched = 0;
  let cursor = 0;
  for (const want of expected) {
    const found = observed.findIndex((entry, index) => index >= cursor && entry.name === want.name && argsContain(entry.args, want.args ?? {}));
    if (found >= 0) {
      matched += 1;
      cursor = found + 1;
    }
  }
  return matched / expected.length;
}

function argsContain(observed: unknown, expected: Record<string, unknown>): boolean {
  if (!observed || typeof observed !== 'object') return Object.keys(expected).length === 0;
  const obs = observed as Record<string, unknown>;
  for (const [key, value] of Object.entries(expected)) {
    if (obs[key] !== value) return false;
  }
  return true;
}
