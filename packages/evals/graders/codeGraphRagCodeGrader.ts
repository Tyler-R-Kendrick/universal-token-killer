import process from 'node:process';
import { assertCodeGraphRag } from '../metrics/codeGraphRagMetrics.js';
import type { CodeGraphRagFixture } from '../fixtures/codeGraphRagFixtures.js';
import type { CodeGraphRagCandidate } from '../metrics/codeGraphRagMetrics.js';

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
  query?: string;
  expected_symbol?: {
    name: string;
    filePath: string;
    kind?: string;
  };
  serena_baseline_tokens?: number;
  forbidden_snippets?: string[];
};

type ActualPayload = {
  ranked_symbols?: CodeGraphRagCandidate[];
  compact_text?: string;
  raw_artifact_exists?: boolean;
  compact_artifact_exists?: boolean;
};

export type CodeGraphRagCodeGraderResult = {
  score: number;
  reasoning: string;
  assertions: Array<{ name: string; passed: boolean; score: number; text: string }>;
};

export function gradeCodeGraphRagCodeGraderInput(input: AgentVCodeGraderInput): CodeGraphRagCodeGraderResult {
  const expected = parseExpected(input.expected_output_text ?? input.expected_output ?? input.reference_answer ?? '{}');
  const actual = parseActual(input.output_text ?? input.output ?? '{}');
  const scenario = expected.scenario ?? 'code-graph-rag';
  const fixture: CodeGraphRagFixture = {
    name: scenario,
    category: 'agentv',
    query: expected.query ?? input.input_text ?? '',
    useCase: scenario,
    files: {},
    expectedSymbol: expected.expected_symbol ?? { name: '', filePath: '' },
    serenaBaselineTokens: expected.serena_baseline_tokens ?? 1,
    forbiddenSnippets: expected.forbidden_snippets ?? [],
  };
  const assertion = assertCodeGraphRag({
    fixture,
    rankedSymbols: actual.ranked_symbols ?? [],
    compactText: actual.compact_text ?? '',
    rawArtifactExists: actual.raw_artifact_exists ?? false,
    compactArtifactExists: actual.compact_artifact_exists ?? false,
  });

  return {
    score: assertion.passed ? 1 : 0,
    reasoning: assertion.failures.length === 0 ? `${scenario}: recall/token/recoverability targets passed.` : assertion.failures.join('\n'),
    assertions: [
      {
        name: 'recall-at-5',
        passed: assertion.metrics.recallAt5 === 1,
        score: assertion.metrics.recallAt5,
        text: `recallAt5=${assertion.metrics.recallAt5}`,
      },
      {
        name: 'mrr',
        passed: assertion.metrics.mrr > 0,
        score: assertion.metrics.mrr,
        text: `mrr=${assertion.metrics.mrr.toFixed(3)}`,
      },
      {
        name: 'token-ratio',
        passed: assertion.metrics.tokenRatioVsSerena <= 0.6,
        score: assertion.metrics.tokenRatioVsSerena <= 0.6 ? 1 : 0,
        text: `visibleTokens=${assertion.metrics.visibleTokens}; serenaBaselineTokens=${assertion.metrics.serenaBaselineTokens}`,
      },
      {
        name: 'recoverability',
        passed: assertion.metrics.recoverability === 1,
        score: assertion.metrics.recoverability,
        text: `recoverability=${assertion.metrics.recoverability}`,
      },
      {
        name: 'no-raw-leakage',
        passed: assertion.metrics.noRawLeakage === 1,
        score: assertion.metrics.noRawLeakage,
        text: `noRawLeakage=${assertion.metrics.noRawLeakage}`,
      },
    ],
  };
}

function parseExpected(text: string): ExpectedPayload {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as ExpectedPayload) : {};
  } catch {
    return {};
  }
}

function parseActual(text: string): ActualPayload {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as ActualPayload) : { compact_text: text };
  } catch {
    return { compact_text: text };
  }
}

if (process.argv[1]?.endsWith('codeGraphRagCodeGrader.js')) {
  let stdin = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    stdin += chunk;
  });
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(stdin) as AgentVCodeGraderInput;
      process.stdout.write(`${JSON.stringify(gradeCodeGraphRagCodeGraderInput(input))}\n`);
    } catch (error: unknown) {
      process.stderr.write(`${(error as Error).message}\n`);
      process.exitCode = 1;
    }
  });
}
