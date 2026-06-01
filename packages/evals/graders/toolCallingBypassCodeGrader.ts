#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertToolCallingBypass,
  parseToolCallingBypassActualPayload,
  parseToolCallingBypassExpectedPayload,
  type ToolCallingBypassActualPayload,
  type ToolCallingBypassExpectedPayload
} from '../metrics/toolCallingBypassMetrics.js';

type AgentVCodeGraderInput = {
  input_text?: string;
  output?: string;
  output_text?: string;
  expected_output?: string;
  expected_output_text?: string;
  reference_answer?: string;
};

export type ToolCallingBypassCodeGraderOutput = {
  score: number;
  assertions: Array<{ name: string; passed: boolean; score: number; text: string }>;
  reasoning: string;
  metadata: Record<string, unknown>;
};

export async function gradeToolCallingBypassCodeGraderInput(input: AgentVCodeGraderInput): Promise<ToolCallingBypassCodeGraderOutput> {
  const expected = parseToolCallingBypassExpectedPayload(input.expected_output_text ?? input.expected_output ?? input.reference_answer ?? '{}');
  const actual = parseToolCallingBypassActualPayload(input.output_text ?? input.output ?? '{}');
  const assertion = assertToolCallingBypass({ expected, actual });
  const metrics = assertion.metrics;

  return {
    score: metrics.overallScore,
    assertions: [
      assertionLine('bypass-decision', metrics.bypassDecisionScore, `bypassed ${actual.bypassed === true} expected ${expected.should_bypass === true}`),
      assertionLine('tool-selection', metrics.toolSelectionScore, `tool ${actual.tool_name ?? '<missing>'} expected ${expected.expected_tool ?? '<none>'}`),
      assertionLine('match-reason', metrics.reasonScore, `reason ${actual.reason ?? '<not-observable>'} expected ${expected.expected_reason ?? '<none>'}`),
      assertionLine('argument-capture', metrics.argumentScore, `args ${JSON.stringify(actual.args ?? {})}`),
      assertionLine('local-execution', metrics.executionScore, `executed ${actual.executed === true} expected ${expected.should_execute === true}`),
      assertionLine('upstream-forwarding', metrics.upstreamForwardingScore, `forwarded ${actual.forwarded_upstream === true || (actual.upstream_calls ?? 0) > 0}`),
      assertionLine('output-contract', metrics.outputScore, `output contains ${(expected.expected_output_contains ?? []).join(', ') || '<none>'}`),
      assertionLine('safety-fail-open', metrics.safetyScore, `miss ${actual.miss_reason ?? '<none>'} expected ${expected.expected_miss_reason ?? '<none>'}`)
    ],
    reasoning: assertion.failures.length === 0 ? `${metrics.scenario}: tool bypass contract satisfied.` : assertion.failures.join('\n'),
    metadata: {
      metrics,
      expected: sanitizeExpected(expected),
      actual: sanitizeActual(actual)
    }
  };
}

function assertionLine(name: string, score: number, text: string): { name: string; passed: boolean; score: number; text: string } {
  return { name, passed: score === 1, score, text };
}

function sanitizeExpected(expected: ToolCallingBypassExpectedPayload): Record<string, unknown> {
  return {
    scenario: expected.scenario,
    category: expected.category,
    level: expected.level,
    should_bypass: expected.should_bypass,
    should_execute: expected.should_execute,
    should_forward_upstream: expected.should_forward_upstream,
    expected_tool: expected.expected_tool,
    expected_reason: expected.expected_reason,
    expected_args: expected.expected_args,
    expected_miss_reason: expected.expected_miss_reason
  };
}

function sanitizeActual(actual: ToolCallingBypassActualPayload): Record<string, unknown> {
  return {
    bypassed: actual.bypassed,
    tool_name: actual.tool_name,
    reason: actual.reason,
    args: actual.args,
    executed: actual.executed,
    forwarded_upstream: actual.forwarded_upstream,
    upstream_calls: actual.upstream_calls,
    miss_reason: actual.miss_reason
  };
}

async function main(): Promise<void> {
  const input = JSON.parse(readFileSync(0, 'utf8')) as AgentVCodeGraderInput;
  process.stdout.write(`${JSON.stringify(await gradeToolCallingBypassCodeGraderInput(input))}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
