import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mediateToolExecution } from '@utk/core';
import { COMPRESR_INSTALL_CONFIG } from '../config/compresrConfig.js';
import { COMPRESR_PARITY_EVALS, COMPRESR_PARITY_FIXTURES, compresrParityExpectedPayload } from '../fixtures/compresrParityFixtures.js';
import { gradeCompresrParityCodeGraderInput } from '../graders/compresrParityCodeGrader.js';
import { assertCompresrParity, factRetentionScore, measureCompresrParity, recoverabilityScore } from '../metrics/compresrParityMetrics.js';
import { buildCompresrParityReport, compresrParityActualPayload, renderCompresrParityEvalYaml } from '../reports/compresrParityReport.js';

describe('Compresr install and configuration', () => {
  it('documents the installed SDK configuration used by the deterministic benchmarks', () => {
    expect(COMPRESR_INSTALL_CONFIG.installedVersion).toBe('2.5.1');
    expect(COMPRESR_INSTALL_CONFIG.apiKeyEnvVar).toBe('COMPRESR_API_KEY');
    expect(COMPRESR_INSTALL_CONFIG.models).toContain('espresso_v1');
    expect(COMPRESR_INSTALL_CONFIG.models).toContain('latte_v1');
    expect(COMPRESR_INSTALL_CONFIG.models).toContain('agentic_tool_output_gemfilter');
  });

  it('verifies the local Compresr Python SDK install when available', () => {
    const output = execFileSync('python', ['scripts/verify-compresr-install.py'], {
      cwd: path.resolve(import.meta.dirname, '..'),
      encoding: 'utf8'
    });
    const parsed = JSON.parse(output) as { installed: boolean; version: string; models: string[]; apiKeyEnvVar: string };

    expect(parsed.installed).toBe(true);
    expect(parsed.version).toBe(COMPRESR_INSTALL_CONFIG.installedVersion);
    expect(parsed.apiKeyEnvVar).toBe(COMPRESR_INSTALL_CONFIG.apiKeyEnvVar);
    expect(parsed.models).toContain('espresso_v1');
    expect(parsed.models).toContain('latte_v1');
  });
});

describe('Compresr parity metrics', () => {
  it('calculates deterministic comparative metrics', async () => {
    const fixture = { ...COMPRESR_PARITY_FIXTURES[0]!, compresrBaselineTokens: 20 };
    const metrics = await measureCompresrParity({
      fixture,
      rawText: '{"route":"tool-output","events":[{"status":"failed"}]}',
      compactText: 'tiny',
      responseText: 'Tool result stored at: .utk/tools/t/observations/r/output.raw.json\nSchema: t.v1.a\nCompact artifact: .utk/tools/t/observations/r/output.compact.toon\nRoute confidence: 0.95',
      rawArtifactExists: true,
      compactArtifactExists: true
    });

    expect(metrics.compactTokens).toBe(1);
    expect(metrics.utkVsCompresrTokenDelta).toBe(19);
    expect(metrics.utkVsCompresrTokenRatio).toBe(0.05);
    expect(metrics.recoverabilityScore).toBe(1);
  });

  it('fails missing facts, missing recoverability, and Compresr threshold regressions with scenario names', async () => {
    const fixture = { ...COMPRESR_PARITY_FIXTURES[0]!, compresrBaselineTokens: 1 };
    const assertion = await assertCompresrParity({
      fixture,
      rawText: 'missing',
      compactText: 'this compact text is much too long',
      responseText: 'no artifacts',
      rawArtifactExists: false,
      compactArtifactExists: false
    });

    expect(assertion.passed).toBe(false);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: compactTokens=`);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: factRetentionScore=0`);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: recoverabilityScore=0`);
  });

  it('retains literal and json-path facts across artifact text', () => {
    expect(factRetentionScore([{ kind: 'literal', value: 'needle' }], ['hay needle stack'])).toBe(1);
    expect(factRetentionScore([{ kind: 'jsonPath', path: '$.items[0].name', expected: 'Ada' }], ['{"items":[{"name":"Ada"}]}'])).toBe(1);
    expect(factRetentionScore([{ kind: 'jsonPath', path: '$.items[1].name', expected: 'Ada' }], ['{"items":[{"name":"Ada"}]}'])).toBe(0);
    expect(factRetentionScore([], [])).toBe(1);
  });

  it('scores recoverability from raw and compact artifact references', () => {
    expect(recoverabilityScore({
      rawArtifactExists: true,
      compactArtifactExists: true,
      responseText: 'Tool result stored at: .utk/tools/t/observations/r/output.raw.json\nSchema: t.v1.a\nCompact artifact: .utk/tools/t/observations/r/output.compact.toon\nRoute confidence: 0.95'
    })).toBe(1);
    expect(recoverabilityScore({
      rawArtifactExists: true,
      compactArtifactExists: false,
      responseText: 'Tool result stored at: .utk/tools/t/observations/r/output.raw.json\nSchema: t.v1.a'
    })).toBe(0);
  });
});

describe('fixture-backed Compresr parity scenarios', () => {
  it('covers at least 35 new Compresr benchmark evals exactly once', () => {
    expect(COMPRESR_PARITY_FIXTURES.length).toBeGreaterThanOrEqual(35);
    expect(new Set(COMPRESR_PARITY_EVALS).size).toBe(COMPRESR_PARITY_FIXTURES.length);
    expect(COMPRESR_PARITY_EVALS).toEqual(COMPRESR_PARITY_FIXTURES.map((fixture) => fixture.name));
  });

  it.each(COMPRESR_PARITY_FIXTURES)('$name beats the configured Compresr baseline', async (fixture) => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `utk-compresr-${fixture.name}-`));
    const result = await mediateToolExecution({
      workspaceRoot,
      toolId: fixture.toolId,
      input: fixture.input,
      execute: async () => fixture.rawOutput
    });
    const rawText = (await readFile(result.rawPath)).toString();
    const compactText = await readFile(result.serializedPath, 'utf8');
    const assertion = await assertCompresrParity({
      fixture,
      rawText,
      compactText,
      responseText: result.response,
      rawArtifactExists: true,
      compactArtifactExists: true
    });

    expect(assertion.failures, assertion.failures.join('\n')).toEqual([]);
    expect(assertion.passed).toBe(true);
    expect(assertion.metrics.utkVsCompresrTokenDelta).toBeGreaterThan(0);
    expect(assertion.metrics.autoevalsFactScore).toBe(1);
  });

  it('exposes AgentV code-grader output for autoevals-backed Compresr parity checks', async () => {
    const report = await buildCompresrParityReport();
    const row = report.rows[0]!;
    const result = await gradeCompresrParityCodeGraderInput({
      output_text: compresrParityActualPayload(row),
      expected_output_text: compresrParityExpectedPayload(row.fixture)
    });

    expect(result.score).toBe(1);
    expect(result.assertions.every((assertion) => assertion.passed)).toBe(true);
    expect(result.reasoning).toContain(row.fixture.name);
  }, 30000);

  it('declares AgentV YAML code-grader scenarios for every Compresr parity fixture', async () => {
    const yaml = normalizeLineEndings(await readFile(new URL('./compresr-parity.EVAL.yaml', import.meta.url), 'utf8'));

    for (const name of COMPRESR_PARITY_EVALS) {
      expect(yaml).toContain(`id: ${name}`);
    }
    expect(yaml).toContain('type: code-grader');
    expect(yaml).toContain('compresrParityCodeGrader.js');
    expect(yaml).toBe(renderCompresrParityEvalYaml());
  });

  it('documents Compresr strengths, UTK attempts, and measured results', async () => {
    const report = await buildCompresrParityReport();

    expect(report.rows).toHaveLength(COMPRESR_PARITY_FIXTURES.length);
    expect(report.markdown).toContain('## Findings');
    expect(report.markdown).toContain('Compresr is strongest');
    expect(report.markdown).toContain('UTK wins');
    expect(report.rows.every((row) => row.passed)).toBe(true);
    expect(report.rows.every((row) => row.metrics.autoevalsFactScore === 1)).toBe(true);
    expect(report.rows.every((row) => row.metrics.recoverabilityScore === 1)).toBe(true);
    expect(new Set(report.rows.map((row) => row.fixture.testStrategy)).size).toBe(report.rows.length);
  }, 30000);
});

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}
