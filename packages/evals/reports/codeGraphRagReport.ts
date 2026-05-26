import { CODE_GRAPH_RAG_FIXTURES, codeGraphRagExpectedPayload } from '../fixtures/codeGraphRagFixtures.js';

export function codeGraphRagActualPayload(params: {
  rankedSymbols: Array<{ name: string; filePath: string; kind?: string }>;
  compactText: string;
  rawArtifactExists: boolean;
  compactArtifactExists: boolean;
}): string {
  return JSON.stringify(
    {
      ranked_symbols: params.rankedSymbols,
      compact_text: params.compactText,
      raw_artifact_exists: params.rawArtifactExists,
      compact_artifact_exists: params.compactArtifactExists,
    },
    null,
    2,
  );
}

export function renderCodeGraphRagEvalYaml(): string {
  const blocks = CODE_GRAPH_RAG_FIXTURES.map((fixture) => {
    const expected = indent(codeGraphRagExpectedPayload(fixture), 6);
    return [
      `  - id: ${fixture.name}`,
      '    input:',
      '      - role: user',
      `        content: "${escapeYamlString(fixture.useCase)}"`,
      '    expected_output: |',
      expected,
      '    assertions:',
      '      - name: code-graph-rag',
      '        type: code-grader',
      '        command: ["node", "packages/evals/dist/graders/codeGraphRagCodeGrader.js"]',
    ].join('\n');
  });
  return `tests:\n${blocks.join('\n')}\n`;
}

function indent(value: string, spaces: number): string {
  const prefix = ' '.repeat(spaces);
  return value
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function escapeYamlString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}
