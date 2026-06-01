import { wasForwardedUpstream, type ToolCallingBypassActualPayload, type ToolCallingBypassExpectedPayload } from './toolCallingBypassPayloads.js';

export {
  parseToolCallingBypassActualPayload,
  parseToolCallingBypassExpectedPayload
} from './toolCallingBypassPayloads.js';
export type {
  ToolCallingBypassActualPayload,
  ToolCallingBypassExpectedPayload
} from './toolCallingBypassPayloads.js';

export type ToolCallingBypassMeasurementInput = {
  expected: ToolCallingBypassExpectedPayload;
  actual: ToolCallingBypassActualPayload;
};

export type ToolCallingBypassMetrics = {
  scenario: string;
  bypassDecisionScore: number;
  toolSelectionScore: number;
  reasonScore: number;
  argumentScore: number;
  executionScore: number;
  upstreamForwardingScore: number;
  outputScore: number;
  safetyScore: number;
  overallScore: number;
};

export type ToolCallingBypassAssertion = {
  passed: boolean;
  failures: string[];
  metrics: ToolCallingBypassMetrics;
};

export function measureToolCallingBypass(input: ToolCallingBypassMeasurementInput): ToolCallingBypassMetrics {
  const expected = input.expected;
  const actual = input.actual;
  const bypassDecisionScore = booleanScore(actual.bypassed === true, expected.should_bypass === true);
  const toolSelectionScore = expected.expected_tool ? booleanScore(actual.tool_name === expected.expected_tool, true) : 1;
  const reasonScore = expected.expected_reason && actual.reason !== undefined ? booleanScore(actual.reason === expected.expected_reason, true) : 1;
  const argumentScoreValue = argumentScore(expected.expected_args ?? {}, actual.args ?? {});
  const executionScore = expected.should_execute === undefined ? 1 : booleanScore(actual.executed === true, expected.should_execute === true);
  const upstreamForwardingScore = expected.should_forward_upstream === undefined
    ? 1
    : booleanScore(wasForwardedUpstream(actual), expected.should_forward_upstream === true);
  const outputScoreValue = outputScore(expected.expected_output_contains ?? [], actual.output_text ?? actual.clarification ?? '');
  const safetyScoreValue = safetyScore(expected, actual);
  const overallScore = Math.min(
    bypassDecisionScore,
    toolSelectionScore,
    reasonScore,
    argumentScoreValue,
    executionScore,
    upstreamForwardingScore,
    outputScoreValue,
    safetyScoreValue
  );

  return {
    scenario: expected.scenario ?? 'tool-calling-bypass',
    bypassDecisionScore,
    toolSelectionScore,
    reasonScore,
    argumentScore: argumentScoreValue,
    executionScore,
    upstreamForwardingScore,
    outputScore: outputScoreValue,
    safetyScore: safetyScoreValue,
    overallScore
  };
}

export function assertToolCallingBypass(input: ToolCallingBypassMeasurementInput): ToolCallingBypassAssertion {
  const metrics = measureToolCallingBypass(input);
  const expected = input.expected;
  const actual = input.actual;
  const failures: string[] = [];

  if (metrics.bypassDecisionScore !== 1) {
    failures.push(`${metrics.scenario}: bypassed=${actual.bypassed === true} expected=${expected.should_bypass === true}`);
  }
  if (metrics.toolSelectionScore !== 1) {
    failures.push(`${metrics.scenario}: tool_name=${actual.tool_name ?? '<missing>'} expected=${expected.expected_tool}`);
  }
  if (metrics.reasonScore !== 1) {
    failures.push(`${metrics.scenario}: reason=${actual.reason ?? '<missing>'} expected=${expected.expected_reason}`);
  }
  if (metrics.argumentScore !== 1) {
    failures.push(`${metrics.scenario}: args=${JSON.stringify(actual.args ?? {})} expected_subset=${JSON.stringify(expected.expected_args ?? {})}`);
  }
  if (metrics.executionScore !== 1) {
    failures.push(`${metrics.scenario}: executed=${actual.executed === true} expected=${expected.should_execute === true}`);
  }
  if (metrics.upstreamForwardingScore !== 1) {
    failures.push(`${metrics.scenario}: forwarded_upstream=${wasForwardedUpstream(actual)} expected=${expected.should_forward_upstream === true}`);
  }
  if (metrics.outputScore !== 1) {
    failures.push(`${metrics.scenario}: output_text missing ${JSON.stringify(expected.expected_output_contains ?? [])}`);
  }
  if (metrics.safetyScore !== 1) {
    failures.push(`${metrics.scenario}: miss_reason=${actual.miss_reason ?? '<missing>'} expected=${expected.expected_miss_reason ?? '<none>'}`);
  }

  return { passed: failures.length === 0, failures, metrics };
}

export function argumentScore(expectedArgs: Record<string, unknown>, actualArgs: Record<string, unknown>): number {
  const entries = Object.entries(expectedArgs);
  if (entries.length === 0) return 1;
  const retained = entries.filter(([key, value]) => valuesEqual(actualArgs[key], value)).length;
  return retained / entries.length;
}

export function outputScore(required: string[], output: string): number {
  if (required.length === 0) return 1;
  const retained = required.filter((item) => output.includes(item)).length;
  return retained / required.length;
}

function safetyScore(expected: ToolCallingBypassExpectedPayload, actual: ToolCallingBypassActualPayload): number {
  if (expected.should_bypass === true) return 1;
  if (actual.bypassed === true) return 0;
  const missReason = expected.expected_miss_reason;
  if (!missReason) return 1;
  if (missReason === 'ambiguous') return actual.ambiguous === true || actual.miss_reason === 'ambiguous' ? 1 : 0;
  if (missReason === 'denied-tool') return actual.denied === true || actual.miss_reason === 'denied-tool' ? 1 : 0;
  if (missReason === 'protected-tool') return actual.protected === true || actual.miss_reason === 'protected-tool' ? 1 : 0;
  if (missReason === 'missing-required-args') {
    const text = actual.clarification ?? actual.output_text ?? '';
    const required = expected.clarification_contains ?? [];
    return (actual.miss_reason === 'missing-required-args' || text.includes('Missing required')) && outputScore(required, text) === 1 ? 1 : 0;
  }
  return actual.miss_reason === missReason ? 1 : 0;
}

function booleanScore(actual: boolean, expected: boolean): number {
  return actual === expected ? 1 : 0;
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}
