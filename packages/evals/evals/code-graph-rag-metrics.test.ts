import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CODE_GRAPH_RAG_EVALS, CODE_GRAPH_RAG_FIXTURES, codeGraphRagExpectedPayload } from '../fixtures/codeGraphRagFixtures.js';
import { assertCodeGraphRag, measureCodeGraphRag } from '../metrics/codeGraphRagMetrics.js';
import { gradeCodeGraphRagCodeGraderInput } from '../graders/codeGraphRagCodeGrader.js';
import { codeGraphRagActualPayload, renderCodeGraphRagEvalYaml } from '../reports/codeGraphRagReport.js';

describe('code graph RAG metrics', () => {
  it('ships at least 100 meaningfully different code-RAG benchmark cases', () => {
    expect(CODE_GRAPH_RAG_FIXTURES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(CODE_GRAPH_RAG_FIXTURES.map((fixture) => fixture.name)).size).toBe(CODE_GRAPH_RAG_FIXTURES.length);
    expect(new Set(CODE_GRAPH_RAG_FIXTURES.map((fixture) => fixture.category)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(CODE_GRAPH_RAG_FIXTURES.map((fixture) => `${fixture.query}:${fixture.expectedSymbol.filePath}:${fixture.expectedSymbol.kind ?? ''}`)).size).toBeGreaterThanOrEqual(100);
  });

  it('calculates recall, MRR, token ratio, recoverability, and leakage metrics', () => {
    const fixture = CODE_GRAPH_RAG_FIXTURES[0]!;
    const metrics = measureCodeGraphRag({
      fixture,
      rankedSymbols: [fixture.expectedSymbol],
      compactText: 'tiny context',
      rawArtifactExists: true,
      compactArtifactExists: true,
    });

    expect(metrics.recallAt1).toBe(1);
    expect(metrics.recallAt5).toBe(1);
    expect(metrics.mrr).toBe(1);
    expect(metrics.tokenRatioVsSerena).toBeLessThanOrEqual(0.6);
    expect(metrics.recoverability).toBe(1);
    expect(metrics.noRawLeakage).toBe(1);
  });

  it('fails missing recall, high token ratio, missing artifacts, and raw leakage with scenario names', () => {
    const fixture = CODE_GRAPH_RAG_FIXTURES[0]!;
    const assertion = assertCodeGraphRag({
      fixture,
      rankedSymbols: [],
      compactText: `${fixture.forbiddenSnippets[0]} ${'x'.repeat(1000)}`,
      rawArtifactExists: false,
      compactArtifactExists: false,
    });

    expect(assertion.passed).toBe(false);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: recall@5=0`);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: tokenRatioVsSerena=`);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: recoverability=0`);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: noRawLeakage=0`);
  });

  it('exposes AgentV code-grader output for code-RAG checks', () => {
    const fixture = CODE_GRAPH_RAG_FIXTURES[0]!;
    const result = gradeCodeGraphRagCodeGraderInput({
      output_text: codeGraphRagActualPayload({
        rankedSymbols: [fixture.expectedSymbol],
        compactText: 'compact symbol path context',
        rawArtifactExists: true,
        compactArtifactExists: true,
      }),
      expected_output_text: codeGraphRagExpectedPayload(fixture),
    });

    expect(result.score).toBe(1);
    expect(result.assertions.every((assertion) => assertion.passed)).toBe(true);
    expect(result.reasoning).toContain(fixture.name);
  });

  it('declares AgentV YAML code-grader scenarios for every fixture', async () => {
    const yaml = normalizeLineEndings(await readFile(new URL('./code-graph-rag.EVAL.yaml', import.meta.url), 'utf8'));

    expect(CODE_GRAPH_RAG_FIXTURES.map((fixture) => fixture.name).sort()).toEqual([...CODE_GRAPH_RAG_EVALS].sort());
    for (const name of CODE_GRAPH_RAG_EVALS) {
      expect(yaml).toContain(`id: ${name}`);
    }
    expect(yaml).toContain('type: code-grader');
    expect(yaml).toContain('codeGraphRagCodeGrader.js');
    expect(yaml).toBe(renderCodeGraphRagEvalYaml());
  });
});

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}
