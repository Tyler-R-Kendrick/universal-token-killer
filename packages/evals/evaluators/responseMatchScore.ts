import type { Evaluator, EvaluatorInput, EvaluatorOutput, Invocation } from './types.js';

export const responseMatchScore: Evaluator = {
  metricName: 'response_match_score',
  description: 'Fraction of expected substrings (or regex patterns) found in the observed final response text.',
  rubric: [
    'Each expected substring appears in final_response text.',
    'Regex patterns (config.expected_patterns) match the response.',
    'Empty expectations → score 1 (vacuously true).'
  ],
  async evaluate(input: EvaluatorInput): Promise<EvaluatorOutput> {
    const perInvocationScores = input.invocations.map((invocation) => scoreInvocation(input.config, invocation));
    const score = perInvocationScores.length === 0
      ? 0
      : perInvocationScores.reduce((sum, value) => sum + value, 0) / perInvocationScores.length;
    const passed = score >= input.threshold;
    return {
      score,
      status: passed ? 'PASSED' : 'FAILED',
      per_invocation_scores: perInvocationScores,
      details: { reason: passed ? 'response contained expected substrings' : 'response missing one or more expected substrings' }
    };
  }
};

function scoreInvocation(config: Record<string, unknown>, invocation: Invocation): number {
  const text = invocation.final_response.parts.map((part) => part.text).join('');
  const expected = readArray(config.expected_substrings, invocation.invocation_id);
  const patterns = readArray(config.expected_patterns, invocation.invocation_id);
  const total = expected.length + patterns.length;
  if (total === 0) return 1;
  let hits = 0;
  for (const substring of expected) {
    if (text.includes(substring)) hits += 1;
  }
  for (const pattern of patterns) {
    if (new RegExp(pattern).test(text)) hits += 1;
  }
  return hits / total;
}

function readArray(value: unknown, invocationId: string): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (!value || typeof value !== 'object') return [];
  const entry = (value as Record<string, unknown>)[invocationId];
  return Array.isArray(entry) ? entry.filter((item): item is string => typeof item === 'string') : [];
}
