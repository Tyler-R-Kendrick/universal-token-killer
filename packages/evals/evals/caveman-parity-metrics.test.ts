import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CAVEMAN_PARITY_EVALS, CAVEMAN_PARITY_FIXTURES, cavemanParityExpectedPayload } from '../fixtures/cavemanParityFixtures.js';
import { assertCavemanParity, exactTermRetentionScore, forbiddenLeakageScore, forbiddenPatternScore, measureCavemanParity, orderedTermScore, requiredPatternScore, requiredTermRetentionScore } from '../metrics/cavemanParityMetrics.js';
import { gradeCavemanParityCodeGraderInput } from '../graders/cavemanParityCodeGrader.js';
import { buildCavemanParityReport, renderCavemanParityEvalYaml } from '../reports/cavemanParityReport.js';

describe('caveman parity metrics', () => {
  it('uses autoevals JSONDiff to catch dropped required facts', async () => {
    const fixture = CAVEMAN_PARITY_FIXTURES[0]!;
    const missing = await assertCavemanParity({
      scenario: fixture.name,
      cavemanBaseline: fixture.cavemanBaseline,
      candidate: 'CI red. Rerun later.',
      requiredTerms: fixture.requiredTerms
    });

    expect(missing.passed).toBe(false);
    expect(missing.failures.join('\n')).toContain('autoevalsFactScore=');
    expect(missing.failures.join('\n')).toContain('requiredTermRetentionScore=');
  });

  it('calculates token parity against caveman baselines', async () => {
    const fixture = CAVEMAN_PARITY_FIXTURES[0]!;
    const metrics = await measureCavemanParity({
      scenario: fixture.name,
      cavemanBaseline: fixture.cavemanBaseline,
      candidate: fixture.utkCandidate,
      requiredTerms: fixture.requiredTerms,
      exactTerms: fixture.exactTerms ?? [],
      orderedTerms: fixture.orderedTerms ?? [],
      forbiddenTerms: fixture.forbiddenTerms ?? [],
      requiredPatterns: fixture.requiredPatterns ?? [],
      forbiddenPatterns: fixture.forbiddenPatterns ?? []
    });

    expect(metrics.candidateVsCavemanTokenDelta).toBeGreaterThan(0);
    expect(metrics.candidateVsCavemanTokenRatio).toBeLessThanOrEqual(1);
    expect(metrics.autoevalsFactScore).toBe(1);
  });

  it.each(CAVEMAN_PARITY_FIXTURES)('$name matches or beats caveman on meaningful terse-output use cases', async (fixture) => {
    const assertion = await assertCavemanParity({
      scenario: fixture.name,
      cavemanBaseline: fixture.cavemanBaseline,
      candidate: fixture.utkCandidate,
      requiredTerms: fixture.requiredTerms,
      exactTerms: fixture.exactTerms ?? [],
      orderedTerms: fixture.orderedTerms ?? [],
      forbiddenTerms: fixture.forbiddenTerms ?? [],
      requiredPatterns: fixture.requiredPatterns ?? [],
      forbiddenPatterns: fixture.forbiddenPatterns ?? [],
      maxTokenRatio: fixture.maxTokenRatio,
      minFactScore: fixture.minFactScore
    });

    expect(assertion.failures, assertion.failures.join('\n')).toEqual([]);
    expect(assertion.passed).toBe(true);
  });

  it('keeps eval names synchronized with fixture scenarios', () => {
    expect(CAVEMAN_PARITY_EVALS).toEqual(CAVEMAN_PARITY_FIXTURES.map((fixture) => fixture.name));
  });

  it('exposes AgentV code-grader output for autoevals-backed parity checks', async () => {
    const fixture = CAVEMAN_PARITY_FIXTURES[0]!;
    const result = await gradeCavemanParityCodeGraderInput({
      input_text: fixture.sourceText,
      output_text: fixture.utkCandidate,
      expected_output_text: cavemanParityExpectedPayload(fixture)
    });

    expect(result.score).toBe(1);
    expect(result.assertions.every((assertion) => assertion.passed)).toBe(true);
    expect(result.reasoning).toContain(fixture.name);
  });

  it('accepts alternate AgentV stdin field names used by code-grader integrations', async () => {
    const fixture = CAVEMAN_PARITY_FIXTURES[0]!;
    const result = await gradeCavemanParityCodeGraderInput({
      output: fixture.utkCandidate,
      expected_output: cavemanParityExpectedPayload(fixture)
    });

    expect(result.score).toBe(1);
  });

  it('declares AgentV YAML code-grader scenarios for every caveman parity fixture', async () => {
    const yaml = normalizeLineEndings(await readFile(new URL('./caveman-parity.EVAL.yaml', import.meta.url), 'utf8'));

    for (const name of CAVEMAN_PARITY_EVALS) {
      expect(yaml).toContain(`id: ${name}`);
    }
    expect(yaml).toContain('type: code-grader');
    expect(yaml).toContain('cavemanParityCodeGrader.js');
    expect(yaml).toBe(renderCavemanParityEvalYaml());
  });

  it('scores empty required-term sets as retained', () => {
    expect(requiredTermRetentionScore('anything', [])).toBe(1);
  });

  it('catches exact-term drift, ordered-step drift, forbidden leakage, and regex pattern drift', () => {
    expect(exactTermRetentionScore('Error: Access denied', ['Error: Access denied'])).toBe(1);
    expect(exactTermRetentionScore('error: access denied', ['Error: Access denied'])).toBe(0);
    expect(orderedTermScore('backup -> migrate -> verify', ['backup', 'migrate', 'verify'])).toBe(1);
    expect(orderedTermScore('migrate -> backup -> verify', ['backup', 'migrate', 'verify'])).toBe(0);
    expect(forbiddenLeakageScore('OPENAI_API_KEY=[REDACTED]', ['sk-live-123'])).toBe(1);
    expect(forbiddenLeakageScore('OPENAI_API_KEY=sk-live-123', ['sk-live-123'])).toBe(0);
    expect(requiredPatternScore('p95 184ms > 150ms', ['p95\\s+184ms\\s+>\\s+150ms'])).toBe(1);
    expect(requiredPatternScore('p95 184 milliseconds', ['p95\\s+184ms'])).toBe(0);
    expect(forbiddenPatternScore('0 fail', ['failures|failed|failing'])).toBe(1);
    expect(forbiddenPatternScore('0 failures', ['failures|failed|failing'])).toBe(0);
  });

  it('documents caveman strengths, UTK attempts, and measured results', async () => {
    const report = await buildCavemanParityReport();

    expect(report.rows).toHaveLength(CAVEMAN_PARITY_FIXTURES.length);
    expect(report.markdown).toContain('## Findings');
    expect(report.markdown).toContain('Caveman is strongest');
    expect(report.markdown).toContain('UTK outperforms');
    expect(report.rows.every((row) => row.metrics.candidateVsCavemanTokenDelta > 0)).toBe(true);
    expect(report.rows.every((row) => row.metrics.exactTermRetentionScore === 1)).toBe(true);
    expect(report.rows.every((row) => row.metrics.orderedTermScore === 1)).toBe(true);
    expect(report.rows.every((row) => row.metrics.forbiddenLeakageScore === 1)).toBe(true);
    expect(report.rows.every((row) => row.metrics.requiredPatternScore === 1)).toBe(true);
    expect(report.rows.every((row) => row.metrics.forbiddenPatternScore === 1)).toBe(true);
    expect(new Set(report.rows.map((row) => row.testStrategy)).size).toBe(report.rows.length);
  });
});

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}
