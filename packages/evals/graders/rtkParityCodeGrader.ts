import process from 'node:process';
import { assertRtkParityWithAutoevals } from '../metrics/rtkParityMetrics.js';
import type { RequiredFact, RtkParityFixture } from '../fixtures/rtkParityFixtures.js';

type AgentVCodeGraderInput = {
  input_text?: string;
  output_text?: string;
  expected_output_text?: string;
  output?: string;
  expected_output?: string;
  reference_answer?: string;
};

type ExpectedPayload = {
  scenario?: string;
  tool_id?: string;
  required_facts?: RequiredFact[];
  rtk_supported?: boolean;
  rtk_baseline_bytes?: number;
  rtk_baseline_tokens?: number;
};

type ActualPayload = {
  raw_text?: string;
  compact_text?: string;
  response_text?: string;
  raw_artifact_exists?: boolean;
  compact_artifact_exists?: boolean;
};

export type RtkParityCodeGraderResult = {
  score: number;
  reasoning: string;
  assertions: Array<{ name: string; passed: boolean; score: number; text: string }>;
};

export async function gradeRtkParityCodeGraderInput(input: AgentVCodeGraderInput): Promise<RtkParityCodeGraderResult> {
  const expected = parseExpected(input.expected_output_text ?? input.expected_output ?? input.reference_answer ?? '{}');
  const actual = parseActual(input.output_text ?? input.output ?? '{}');
  const scenario = expected.scenario ?? 'rtk-parity';
  const fixture: RtkParityFixture = {
    name: scenario,
    toolId: expected.tool_id ?? 'tool.unknown',
    input: {},
    rawOutput: actual.raw_text ?? '',
    requiredFacts: expected.required_facts ?? [],
    rtkSupported: expected.rtk_supported ?? true,
    rtkBaselineBytes: expected.rtk_baseline_bytes ?? 0,
    rtkBaselineTokens: expected.rtk_baseline_tokens ?? 0
  };
  const assertion = await assertRtkParityWithAutoevals({
    fixture,
    rawText: actual.raw_text ?? input.input_text ?? '',
    compactText: actual.compact_text ?? '',
    responseText: actual.response_text ?? '',
    rawArtifactExists: actual.raw_artifact_exists ?? false,
    compactArtifactExists: actual.compact_artifact_exists ?? false
  });

  return {
    score: assertion.passed ? 1 : 0,
    reasoning: assertion.failures.length === 0 ? `${scenario}: UTK beats RTK while retaining recoverable facts.` : assertion.failures.join('\n'),
    assertions: [
      {
        name: 'autoevals-fact-retention',
        passed: assertion.metrics.autoevalsFactScore === 1,
        score: assertion.metrics.autoevalsFactScore,
        text: `autoevalsFactScore=${assertion.metrics.autoevalsFactScore.toFixed(3)}`
      },
      {
        name: 'fact-retention',
        passed: assertion.metrics.factRetentionScore === 1,
        score: assertion.metrics.factRetentionScore,
        text: `factRetentionScore=${assertion.metrics.factRetentionScore.toFixed(3)}`
      },
      {
        name: 'recoverability',
        passed: assertion.metrics.recoverabilityScore === 1,
        score: assertion.metrics.recoverabilityScore,
        text: `recoverabilityScore=${assertion.metrics.recoverabilityScore.toFixed(3)}`
      },
      {
        name: 'token-threshold',
        passed: fixture.rtkSupported ? assertion.metrics.utkVsRtkTokenDelta > 0 : assertion.metrics.utkCompactTokens <= assertion.metrics.rawTokens * 0.35,
        score: fixture.rtkSupported ? (assertion.metrics.utkVsRtkTokenDelta > 0 ? 1 : 0) : (assertion.metrics.utkCompactTokens <= assertion.metrics.rawTokens * 0.35 ? 1 : 0),
        text: fixture.rtkSupported
          ? `utkCompactTokens=${assertion.metrics.utkCompactTokens}; rtkTokens=${assertion.metrics.rtkTokens}`
          : `utkCompactTokens=${assertion.metrics.utkCompactTokens}; rawTokens*0.35=${(assertion.metrics.rawTokens * 0.35).toFixed(3)}`
      }
    ]
  };
}

function parseExpected(text: string): ExpectedPayload {
  try {
    return JSON.parse(text) as ExpectedPayload;
  } catch {
    return { scenario: 'rtk-parity' };
  }
}

function parseActual(text: string): ActualPayload {
  try {
    return JSON.parse(text) as ActualPayload;
  } catch {
    return { compact_text: text };
  }
}

if (process.argv[1]?.endsWith('rtkParityCodeGrader.js')) {
  let stdin = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    stdin += chunk;
  });
  process.stdin.on('end', () => {
    gradeRtkParityCodeGraderInput(JSON.parse(stdin) as AgentVCodeGraderInput)
      .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
      .catch((error: unknown) => {
        process.stderr.write(`${(error as Error).message}\n`);
        process.exitCode = 1;
      });
  });
}
