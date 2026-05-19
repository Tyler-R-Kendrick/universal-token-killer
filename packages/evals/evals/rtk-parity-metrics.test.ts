import { access, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mediateToolExecution } from '@utk/core';
import { RTK_PARITY_FIXTURES } from '../fixtures/rtkParityFixtures.js';
import { assertRtkParity, factRetentionScore, measureRtkParity, recoverabilityScore } from '../metrics/rtkParityMetrics.js';
import { RTK_PARITY_EVALS } from './rtk-parity.eval.js';

describe('RTK parity metric helpers', () => {
  it('calculates deterministic comparative metrics', () => {
    const fixture = { ...RTK_PARITY_FIXTURES[0]!, rtkSupported: true, rtkBaselineBytes: 40, rtkBaselineTokens: 10 };
    const metrics = measureRtkParity({
      fixture,
      rawText: 'required fact text',
      compactText: 'tiny',
      responseText: 'Tool result stored at: .utk/tools/t/observations/r/output.raw.txt\nSchema: t.v1.a\nCompact artifact: .utk/tools/t/observations/r/output.compact.toon\nRoute confidence: 0.95',
      rawArtifactExists: true,
      compactArtifactExists: true
    });

    expect(metrics.rawBytes).toBe(Buffer.byteLength('required fact text'));
    expect(metrics.rawTokens).toBe(Math.ceil('required fact text'.length / 4));
    expect(metrics.utkVsRtkTokenDelta).toBe(9);
    expect(metrics.utkVsRtkTokenRatio).toBe(0.1);
    expect(metrics.rawToUtkSavingsRatio).toBe(0.8);
  });

  it('fails missing facts, missing recoverability, and RTK threshold regressions with scenario names', () => {
    const fixture = { ...RTK_PARITY_FIXTURES[0]!, rtkSupported: true, rtkBaselineTokens: 1 };
    const assertion = assertRtkParity({
      fixture,
      rawText: 'missing',
      compactText: 'this compact text is much too long',
      responseText: 'no artifacts',
      rawArtifactExists: false,
      compactArtifactExists: false
    });

    expect(assertion.passed).toBe(false);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: factRetentionScore=0`);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: recoverabilityScore=0`);
    expect(assertion.failures.join('\n')).toContain(`${fixture.name}: utkCompactTokens=`);
  });

  it('requires CLI RTK-supported scenarios to be strictly better than RTK baselines', () => {
    const fixture = { ...RTK_PARITY_FIXTURES[0]!, rtkSupported: true, rtkBaselineTokens: 1 };
    const assertion = assertRtkParity({
      fixture,
      rawText: 'M README.md',
      compactText: 'tiny',
      responseText: 'Tool result stored at: .utk/tools/t/observations/r/output.raw.txt\nSchema: t.v1.a\nCompact artifact: .utk/tools/t/observations/r/output.compact.toon\nRoute confidence: 0.95',
      rawArtifactExists: true,
      compactArtifactExists: true
    });

    expect(assertion.passed).toBe(false);
    expect(assertion.failures.join('\n')).toContain('must be strictly less than rtkTokens=1');
  });

  it('checks generalized non-shell scenarios against raw savings thresholds', () => {
    const fixture = { ...RTK_PARITY_FIXTURES.find((item) => item.name === 'arbitrary-structured-tool-output')!, rtkSupported: false };
    const assertion = assertRtkParity({
      fixture,
      rawText: 'x'.repeat(400),
      compactText: 'x'.repeat(200),
      responseText: 'Tool result stored at: .utk/tools/t/observations/r/output.raw.json\nSchema: t.v1.a\nCompact artifact: .utk/tools/t/observations/r/output.compact.toon\nRoute confidence: 0.95',
      rawArtifactExists: true,
      compactArtifactExists: true
    });

    expect(assertion.passed).toBe(false);
    expect(assertion.failures.join('\n')).toContain('rawTokens*0.35');
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
      responseText: 'Tool result stored at: .utk/tools/t/observations/r/output.raw.json\nSchema: t.v1.a\nCompact artifact: .utk/tools/t/observations/r/output.compact.json\nRoute confidence: 0.95'
    })).toBe(1);
    expect(recoverabilityScore({
      rawArtifactExists: true,
      compactArtifactExists: false,
      responseText: 'Tool result stored at: .utk/tools/t/observations/r/output.raw.json\nSchema: t.v1.a'
    })).toBe(0);
  });
});

describe('fixture-backed RTK parity scenarios', () => {
  it('covers every declared RTK parity eval scenario exactly once', () => {
    expect(RTK_PARITY_FIXTURES.map((fixture) => fixture.name).sort()).toEqual([...RTK_PARITY_EVALS].sort());
  });

  it.each(RTK_PARITY_FIXTURES)('$name meets UTK-vs-RTK comparative thresholds', async (fixture) => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), `utk-rtk-${fixture.name}-`));
    const result = await mediateToolExecution({
      workspaceRoot,
      toolId: fixture.toolId,
      input: fixture.input,
      execute: async () => fixture.rawOutput
    });
    const rawText = await readFile(result.rawPath, Buffer.isBuffer(fixture.rawOutput) ? undefined : 'utf8');
    const compactText = await readFile(result.serializedPath, 'utf8');
    await expect(access(result.rawPath)).resolves.toBeUndefined();
    await expect(access(result.serializedPath)).resolves.toBeUndefined();
    expect(result.response).not.toContain(typeof fixture.rawOutput === 'string' ? fixture.rawOutput.trim().slice(0, 20) : JSON.stringify(fixture.rawOutput).slice(0, 20));

    const assertion = assertRtkParity({
      fixture,
      rawText: rawText.toString(),
      compactText,
      responseText: result.response,
      rawArtifactExists: true,
      compactArtifactExists: true
    });

    expect(assertion.failures, assertion.failures.join('\n')).toEqual([]);
    expect(assertion.passed).toBe(true);
    if (fixture.rtkSupported) {
      expect(assertion.metrics.utkVsRtkTokenDelta, `${fixture.name}: expected UTK to beat RTK`).toBeGreaterThan(0);
      expect(assertion.metrics.utkVsRtkTokenRatio, `${fixture.name}: expected UTK token ratio under 1`).toBeLessThan(1);
    }
  });
});
