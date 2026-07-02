#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MinMapEntry } from '@utk/emission';
import { PONYTAIL_PARITY_MACROS } from '../fixtures/ponytailParityFixtures.js';
import { assertPonytailParity } from '../metrics/ponytailParityMetrics.js';

type AgentVCodeGraderInput = {
  input_text?: string;
  output?: string;
  output_text?: string;
  expected_output?: string;
  expected_output_text?: string;
  reference_answer?: string;
};

type PonytailParityExpected = {
  scenario?: string;
  ponytail_baseline?: string;
  verbose_baseline?: string;
  expected_pretty?: string;
  required_terms?: string[];
  map_entries?: MinMapEntry[];
  macro_names?: string[];
  max_token_ratio?: number;
};

type AgentVCodeGraderOutput = {
  score: number;
  assertions: Array<{ text: string; passed: boolean }>;
  reasoning: string;
  metadata: Record<string, unknown>;
};

export async function gradePonytailParityCodeGraderInput(input: AgentVCodeGraderInput): Promise<AgentVCodeGraderOutput> {
  const expected = parseExpected(input.expected_output_text ?? input.expected_output ?? input.reference_answer ?? '{}');
  const scenario = expected.scenario ?? 'ponytail-parity';
  const assertion = await assertPonytailParity({
    scenario,
    verboseBaseline: expected.verbose_baseline ?? '',
    ponytailBaseline: expected.ponytail_baseline ?? input.reference_answer ?? '',
    minEmission: input.output_text ?? input.output ?? '',
    expectedPretty: expected.expected_pretty ?? '',
    requiredTerms: expected.required_terms ?? [],
    mapEntries: expected.map_entries ?? [],
    macros: (expected.macro_names ?? []).map((name) => PONYTAIL_PARITY_MACROS[name]!),
    ...(expected.max_token_ratio !== undefined ? { maxTokenRatio: expected.max_token_ratio } : {})
  });
  const metrics = assertion.metrics;
  const qualityGatesFailed =
    metrics.roundTripFidelityScore < 1 ||
    metrics.parseValidityScore < 1 ||
    metrics.minLeakageScore < 1 ||
    metrics.requiredTermRetentionScore < 1;
  const score = qualityGatesFailed ? 0 : assertion.passed ? 1 : 0;

  return {
    score,
    assertions: [
      {
        text: `round-trip fidelity ${metrics.roundTripFidelityScore.toFixed(3)} == 1.000`,
        passed: metrics.roundTripFidelityScore === 1
      },
      {
        text: `parse validity ${metrics.parseValidityScore.toFixed(3)} == 1.000`,
        passed: metrics.parseValidityScore === 1
      },
      {
        text: `min leakage ${metrics.minLeakageScore.toFixed(3)} == 1.000`,
        passed: metrics.minLeakageScore === 1
      },
      {
        text: `required term retention ${metrics.requiredTermRetentionScore.toFixed(3)} == 1.000`,
        passed: metrics.requiredTermRetentionScore === 1
      },
      {
        text: `autoevals JSONDiff fact score ${metrics.autoevalsFactScore.toFixed(3)} == 1.000`,
        passed: metrics.autoevalsFactScore === 1
      },
      {
        text: `utk/ponytail token ratio ${metrics.utkVsPonytailTokenRatio.toFixed(3)} <= ${(expected.max_token_ratio ?? 1).toFixed(3)} with strict token win`,
        passed: metrics.utkVsPonytailTokenRatio <= (expected.max_token_ratio ?? 1) && metrics.utkVsPonytailTokenDelta > 0
      },
      {
        text: `utk/verbose token delta ${metrics.utkVsVerboseTokenDelta} > 0`,
        passed: metrics.utkVsVerboseTokenDelta > 0
      }
    ],
    reasoning:
      assertion.failures.length === 0
        ? `${scenario}: min emission beats ponytail baseline with every quality gate at 1.0.`
        : assertion.failures.join('\n'),
    metadata: metrics
  };
}

function parseExpected(text: string): PonytailParityExpected {
  try {
    const parsed = JSON.parse(text) as PonytailParityExpected;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return { ponytail_baseline: text };
  }
}

async function main(): Promise<void> {
  const input = JSON.parse(readFileSync(0, 'utf8')) as AgentVCodeGraderInput;
  process.stdout.write(`${JSON.stringify(await gradePonytailParityCodeGraderInput(input))}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
