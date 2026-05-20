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
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      continue;
    }
    if (matchWithBudget(regex, text)) hits += 1;
  }
  return hits / total;
}

const REGEX_INPUT_BUDGET = 50_000;
const REGEX_PATTERN_BUDGET = 200;

/**
 * `regex.test` against user-supplied patterns is a ReDoS surface: `(a+)+b` and
 * friends backtrack catastrophically on long inputs. There's no portable way to
 * sandbox a JS regex with a wall-clock timer (the engine runs synchronously and
 * can't be interrupted), so the only defensible mitigation in pure JS is to bound
 * the inputs: cap the pattern length and slice the haystack. Anything that
 * actually requires unbounded scanning belongs in a dedicated regex engine, not
 * the evaluator.
 */
function matchWithBudget(regex: RegExp, text: string): boolean {
  if (regex.source.length > REGEX_PATTERN_BUDGET) return false;
  const bounded = text.length > REGEX_INPUT_BUDGET ? text.slice(0, REGEX_INPUT_BUDGET) : text;
  return regex.test(bounded);
}

function readArray(value: unknown, invocationId: string): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string');
  if (!value || typeof value !== 'object') return [];
  const entry = (value as Record<string, unknown>)[invocationId];
  return Array.isArray(entry) ? entry.filter((item): item is string => typeof item === 'string') : [];
}
