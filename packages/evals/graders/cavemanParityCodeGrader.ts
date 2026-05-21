#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertCavemanParity } from '../metrics/cavemanParityMetrics.js';

type AgentVCodeGraderInput = {
  input_text?: string;
  output?: string;
  output_text?: string;
  expected_output?: string;
  expected_output_text?: string;
  reference_answer?: string;
};

type CavemanParityExpected = {
  scenario?: string;
  caveman_baseline?: string;
  required_terms?: string[];
  exact_terms?: string[];
  ordered_terms?: string[];
  forbidden_terms?: string[];
  required_patterns?: string[];
  forbidden_patterns?: string[];
  max_token_ratio?: number;
  min_fact_score?: number;
};

type AgentVCodeGraderOutput = {
  score: number;
  assertions: Array<{ text: string; passed: boolean }>;
  reasoning: string;
  metadata: Record<string, unknown>;
};

export async function gradeCavemanParityCodeGraderInput(input: AgentVCodeGraderInput): Promise<AgentVCodeGraderOutput> {
  const expected = parseExpected(input.expected_output_text ?? input.expected_output ?? input.reference_answer ?? '{}');
  const scenario = expected.scenario ?? 'caveman-parity';
  const cavemanBaseline = expected.caveman_baseline ?? input.reference_answer ?? '';
  const candidate = input.output_text ?? input.output ?? '';
  const requiredTerms = expected.required_terms ?? [];
  const assertion = await assertCavemanParity({
    scenario,
    cavemanBaseline,
    candidate,
    requiredTerms,
    exactTerms: expected.exact_terms ?? [],
    orderedTerms: expected.ordered_terms ?? [],
    forbiddenTerms: expected.forbidden_terms ?? [],
    requiredPatterns: expected.required_patterns ?? [],
    forbiddenPatterns: expected.forbidden_patterns ?? [],
    maxTokenRatio: expected.max_token_ratio,
    minFactScore: expected.min_fact_score
  });
  const metrics = assertion.metrics;
  const score = assertion.passed ? 1 : Math.min(metrics.autoevalsFactScore, metrics.candidateVsCavemanTokenRatio <= (expected.max_token_ratio ?? 1) ? 1 : 0);

  return {
    score,
    assertions: [
      {
        text: `autoevals JSONDiff fact score ${metrics.autoevalsFactScore.toFixed(3)} >= ${(expected.min_fact_score ?? 1).toFixed(3)}`,
        passed: metrics.autoevalsFactScore >= (expected.min_fact_score ?? 1)
      },
      {
        text: `required term retention ${metrics.requiredTermRetentionScore.toFixed(3)} == 1.000`,
        passed: metrics.requiredTermRetentionScore === 1
      },
      {
        text: `candidate/caveman token ratio ${metrics.candidateVsCavemanTokenRatio.toFixed(3)} <= ${(expected.max_token_ratio ?? 1).toFixed(3)}`,
        passed: metrics.candidateVsCavemanTokenRatio <= (expected.max_token_ratio ?? 1)
      },
      {
        text: `exact term retention ${metrics.exactTermRetentionScore.toFixed(3)} == 1.000`,
        passed: metrics.exactTermRetentionScore === 1
      },
      {
        text: `ordered term score ${metrics.orderedTermScore.toFixed(3)} == 1.000`,
        passed: metrics.orderedTermScore === 1
      },
      {
        text: `forbidden leakage score ${metrics.forbiddenLeakageScore.toFixed(3)} == 1.000`,
        passed: metrics.forbiddenLeakageScore === 1
      },
      {
        text: `required pattern score ${metrics.requiredPatternScore.toFixed(3)} == 1.000`,
        passed: metrics.requiredPatternScore === 1
      },
      {
        text: `forbidden pattern score ${metrics.forbiddenPatternScore.toFixed(3)} == 1.000`,
        passed: metrics.forbiddenPatternScore === 1
      }
    ],
    reasoning: assertion.failures.length === 0 ? `${scenario}: candidate matches or beats caveman baseline.` : assertion.failures.join('\n'),
    metadata: metrics
  };
}

function parseExpected(text: string): CavemanParityExpected {
  try {
    const parsed = JSON.parse(text) as CavemanParityExpected;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return { caveman_baseline: text };
  }
}

async function main(): Promise<void> {
  const input = JSON.parse(readFileSync(0, 'utf8')) as AgentVCodeGraderInput;
  process.stdout.write(`${JSON.stringify(await gradeCavemanParityCodeGraderInput(input))}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
