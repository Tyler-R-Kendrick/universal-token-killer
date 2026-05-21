import process from 'node:process';
import { assertCompresrParity } from '../metrics/compresrParityMetrics.js';
import type { CompresrParityFixture, CompresrRequiredFact } from '../fixtures/compresrParityFixtures.js';

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
  required_facts?: CompresrRequiredFact[];
  compresr_baseline_text?: string;
  compresr_baseline_tokens?: number;
  min_fact_score?: number;
};

type ActualPayload = {
  raw_text?: string;
  compact_text?: string;
  response_text?: string;
  raw_artifact_exists?: boolean;
  compact_artifact_exists?: boolean;
};

export type CompresrParityCodeGraderResult = {
  score: number;
  reasoning: string;
  assertions: Array<{ name: string; passed: boolean; score: number; text: string }>;
};

export async function gradeCompresrParityCodeGraderInput(input: AgentVCodeGraderInput): Promise<CompresrParityCodeGraderResult> {
  const expected = parseExpected(input.expected_output_text ?? input.expected_output ?? input.reference_answer ?? '{}');
  const actual = parseActual(input.output_text ?? input.output ?? '{}');
  const scenario = expected.scenario ?? 'compresr-parity';
  const fixture: CompresrParityFixture = {
    name: scenario,
    category: 'AgentV',
    useCase: scenario,
    testStrategy: 'AgentV code-grader parity check.',
    compresrStrength: 'Installed Compresr SDK baseline.',
    utkApproach: 'UTK compact artifact recovery.',
    toolId: expected.tool_id ?? 'tool.unknown',
    input: {},
    rawOutput: actual.raw_text ?? '',
    requiredFacts: expected.required_facts ?? [],
    compresrBaselineText: expected.compresr_baseline_text ?? '',
    compresrBaselineTokens: expected.compresr_baseline_tokens ?? 0,
    minFactScore: expected.min_fact_score ?? 1
  };
  const assertion = await assertCompresrParity({
    fixture,
    rawText: actual.raw_text ?? input.input_text ?? '',
    compactText: actual.compact_text ?? '',
    responseText: actual.response_text ?? '',
    rawArtifactExists: actual.raw_artifact_exists ?? false,
    compactArtifactExists: actual.compact_artifact_exists ?? false
  });
  return {
    score: assertion.passed ? 1 : 0,
    reasoning: assertion.failures.length === 0 ? `${scenario}: UTK beats Compresr baseline while retaining recoverable facts.` : assertion.failures.join('\n'),
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
        name: 'token-parity',
        passed: assertion.metrics.utkVsCompresrTokenDelta > 0,
        score: assertion.metrics.utkVsCompresrTokenDelta > 0 ? 1 : 0,
        text: `compactTokens=${assertion.metrics.compactTokens}; compresrBaselineTokens=${assertion.metrics.compresrBaselineTokens}`
      }
    ]
  };
}

function parseExpected(text: string): ExpectedPayload {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed as ExpectedPayload;
    }
    return { scenario: 'compresr-parity' };
  } catch {
    return { scenario: 'compresr-parity' };
  }
}

function parseActual(text: string): ActualPayload {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed as ActualPayload;
    }
    return { compact_text: text };
  } catch {
    return { compact_text: text };
  }
}

if (process.argv[1]?.endsWith('compresrParityCodeGrader.js')) {
  let stdin = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    stdin += chunk;
  });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(stdin) as AgentVCodeGraderInput;
      gradeCompresrParityCodeGraderInput(input)
        .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
        .catch((error: unknown) => {
          process.stderr.write(`${(error as Error).message}\n`);
          process.exitCode = 1;
        });
    } catch (error: unknown) {
      process.stderr.write(`${(error as Error).message}\n`);
      process.exitCode = 1;
    }
  });
}
