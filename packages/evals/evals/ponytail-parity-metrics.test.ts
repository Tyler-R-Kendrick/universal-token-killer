import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PONYTAIL_LADDER_EVALS,
  PONYTAIL_LADDER_FIXTURES,
  PONYTAIL_MODES,
  PONYTAIL_PARITY_EVALS,
  PONYTAIL_PARITY_FIXTURES,
  PONYTAIL_PARITY_MACROS,
  PONYTAIL_PARITY_MODE_EVALS,
  ponytailBaselineForMode,
  ponytailParityExpectedPayload,
  type PonytailLadderFixture,
  type PonytailParityFixture
} from '../fixtures/ponytailParityFixtures.js';
import {
  assertPonytailParity,
  measurePonytailLadder,
  measurePonytailParity,
  minLeakageScore
} from '../metrics/ponytailParityMetrics.js';
import { gradePonytailParityCodeGraderInput } from '../graders/ponytailParityCodeGrader.js';
import { buildPonytailParityReport, renderPonytailParityEvalYaml } from '../reports/ponytailParityReport.js';
import { addMinMapEntry, createMinMap } from '@utk/emission';

function parityInput(fixture: PonytailParityFixture, ponytailBaseline = fixture.ponytailBaseline, scenario = fixture.name) {
  return {
    scenario,
    verboseBaseline: fixture.verboseBaseline,
    ponytailBaseline,
    minEmission: fixture.utkMinEmission,
    expectedPretty: fixture.utkPrettyExpected,
    requiredTerms: fixture.requiredTerms,
    mapEntries: fixture.mapEntries,
    macros: fixture.macroNames.map((name) => PONYTAIL_PARITY_MACROS[name]!),
    maxTokenRatio: fixture.maxTokenRatio
  };
}

async function ladderWorkspace(fixture: PonytailLadderFixture): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'utk-ponytail-ladder-test-'));
  for (const [relativePath, content] of Object.entries(fixture.files)) {
    const filePath = path.join(workspaceRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
  }
  return workspaceRoot;
}

describe('ponytail parity metrics', () => {
  it('fails when the min emission drops declared facts or does not expand to the committed pretty form', async () => {
    const fixture = PONYTAIL_PARITY_FIXTURES[0]!;
    const broken = await assertPonytailParity({
      ...parityInput(fixture),
      minEmission: '@minmap + u requestUrl @end const u2 = fetch(u);'
    });

    expect(broken.passed).toBe(false);
    expect(broken.failures.join('\n')).toContain('roundTripFidelityScore=');
  });

  it.each(PONYTAIL_PARITY_FIXTURES)('$name beats the ponytail arm with every quality gate at 1.0', async (fixture) => {
    const assertion = await assertPonytailParity(parityInput(fixture));
    expect(assertion.failures, assertion.failures.join('\n')).toEqual([]);
    expect(assertion.passed).toBe(true);
  });

  it('measures strictly fewer min tokens than both baselines on every fixture', async () => {
    for (const fixture of PONYTAIL_PARITY_FIXTURES) {
      const metrics = await measurePonytailParity(parityInput(fixture));
      expect(metrics.utkVsPonytailTokenDelta, fixture.name).toBeGreaterThan(0);
      expect(metrics.utkVsVerboseTokenDelta, fixture.name).toBeGreaterThan(0);
      expect(metrics.utkVsPonytailTokenRatio, fixture.name).toBeLessThanOrEqual(1);
      expect(metrics.roundTripFidelityScore, fixture.name).toBe(1);
      expect(metrics.parseValidityScore, fixture.name).toBe(1);
      expect(metrics.minLeakageScore, fixture.name).toBe(1);
      expect(metrics.autoevalsFactScore, fixture.name).toBe(1);
    }
  });

  it('keeps eval names synchronized with fixture scenarios', () => {
    expect(PONYTAIL_PARITY_EVALS).toEqual(PONYTAIL_PARITY_FIXTURES.map((fixture) => fixture.name));
    expect(PONYTAIL_LADDER_EVALS).toEqual(PONYTAIL_LADDER_FIXTURES.map((fixture) => fixture.name));
  });

  it('declares every ponytail intensity mode as a benchmark dimension', () => {
    expect(PONYTAIL_MODES).toEqual(['lite', 'full', 'ultra']);
    expect(PONYTAIL_PARITY_MODE_EVALS).toHaveLength(PONYTAIL_PARITY_FIXTURES.length * PONYTAIL_MODES.length);
    expect(PONYTAIL_PARITY_MODE_EVALS).toContain(`${PONYTAIL_PARITY_FIXTURES[0]!.name}-lite`);
    expect(PONYTAIL_PARITY_MODE_EVALS).toContain(`${PONYTAIL_PARITY_FIXTURES[0]!.name}-ultra`);
  });

  it('keeps ponytail mode baselines independent from the UTK min emission and pretty forms', () => {
    const violations: string[] = [];
    for (const fixture of PONYTAIL_PARITY_FIXTURES) {
      for (const mode of PONYTAIL_MODES) {
        const baseline = ponytailBaselineForMode(fixture, mode);
        if (baseline === fixture.utkMinEmission) {
          violations.push(`${fixture.name}/${mode}: equals utkMinEmission`);
        }
        if (baseline.includes('@minmap')) {
          violations.push(`${fixture.name}/${mode}: contains @minmap`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('beats every ponytail mode baseline with the same quality gates', async () => {
    for (const fixture of PONYTAIL_PARITY_FIXTURES) {
      for (const mode of PONYTAIL_MODES) {
        const metrics = await measurePonytailParity(
          parityInput(fixture, ponytailBaselineForMode(fixture, mode), `${fixture.name}-${mode}`)
        );
        expect(metrics.ponytailTokens, `${fixture.name}-${mode}`).toBeGreaterThan(0);
        expect(metrics.utkVsPonytailTokenDelta, `${fixture.name}-${mode}`).toBeGreaterThan(0);
        expect(metrics.roundTripFidelityScore, `${fixture.name}-${mode}`).toBe(1);
        expect(metrics.parseValidityScore, `${fixture.name}-${mode}`).toBe(1);
        expect(metrics.minLeakageScore, `${fixture.name}-${mode}`).toBe(1);
        expect(metrics.requiredTermRetentionScore, `${fixture.name}-${mode}`).toBe(1);
        expect(metrics.autoevalsFactScore, `${fixture.name}-${mode}`).toBe(1);
      }
    }
  });

  it.each(PONYTAIL_LADDER_FIXTURES)('$name stops at the expected ladder rung', async (fixture) => {
    const workspaceRoot = await ladderWorkspace(fixture);
    const macros = (fixture.macroNames ?? []).map((name) => PONYTAIL_PARITY_MACROS[name]!);
    const metrics = await measurePonytailLadder(workspaceRoot, fixture, macros);

    expect(metrics.ladderCorrectnessScore, `${fixture.name}: rung=${metrics.selectedRung} strategy=${metrics.strategy}`).toBe(1);
  });

  it('scores min-id leakage and patch-marker leakage as failures', () => {
    const map = addMinMapEntry(createMinMap('typescript'), { minId: 'u', pretty: 'requestUrl', kind: 'ident', provenance: 'new' });
    expect(minLeakageScore('const requestUrl = 1;', map)).toBe(1);
    expect(minLeakageScore('const u = 1;', map)).toBe(0);
    expect(minLeakageScore('@minmap + u requestUrl @end', map)).toBe(0);
    expect(minLeakageScore('', map)).toBe(0);
  });

  it('exposes AgentV code-grader output for min emissions', async () => {
    const fixture = PONYTAIL_PARITY_FIXTURES[0]!;
    const result = await gradePonytailParityCodeGraderInput({
      input_text: fixture.request,
      output_text: fixture.utkMinEmission,
      expected_output_text: ponytailParityExpectedPayload(fixture)
    });

    expect(result.score).toBe(1);
    expect(result.assertions.every((assertion) => assertion.passed)).toBe(true);
    expect(result.reasoning).toContain(fixture.name);
  });

  it('accepts alternate AgentV stdin field names used by code-grader integrations', async () => {
    const fixture = PONYTAIL_PARITY_FIXTURES[0]!;
    const result = await gradePonytailParityCodeGraderInput({
      output: fixture.utkMinEmission,
      expected_output: ponytailParityExpectedPayload(fixture)
    });

    expect(result.score).toBe(1);
  });

  it('declares AgentV YAML code-grader scenarios for every ponytail parity fixture and mode', async () => {
    const yaml = normalizeLineEndings(await readFile(new URL('./ponytail-parity.EVAL.yaml', import.meta.url), 'utf8'));

    for (const name of PONYTAIL_PARITY_MODE_EVALS) {
      expect(yaml).toContain(`id: ${name}`);
    }
    expect(yaml).toContain('"ponytail_mode": "lite"');
    expect(yaml).toContain('"ponytail_mode": "ultra"');
    expect(yaml).toContain('type: code-grader');
    expect(yaml).toContain('ponytailParityCodeGrader.js');
    expect(yaml).toBe(renderPonytailParityEvalYaml());
  });

  it('documents ponytail strengths, UTK attempts, ladder outcomes, and measured results', async () => {
    const report = await buildPonytailParityReport();

    expect(report.rows).toHaveLength(PONYTAIL_PARITY_FIXTURES.length);
    expect(report.modeRows).toHaveLength(PONYTAIL_PARITY_FIXTURES.length * PONYTAIL_MODES.length);
    expect(report.ladderRows).toHaveLength(PONYTAIL_LADDER_FIXTURES.length);
    expect(report.markdown).toContain('## Findings');
    expect(report.markdown).toContain('## Mode Results');
    expect(report.markdown).toContain('## Ladder Results');
    expect(report.markdown).toContain('Ponytail is strongest');
    expect(report.markdown).toContain('UTK outperforms');
    expect(report.rows.every((row) => row.metrics.utkVsPonytailTokenDelta > 0)).toBe(true);
    expect(report.modeRows.every((row) => row.metrics.roundTripFidelityScore === 1)).toBe(true);
    expect(report.ladderRows.every((row) => row.metrics.ladderCorrectnessScore === 1)).toBe(true);
    expect(new Set(report.rows.map((row) => row.testStrategy)).size).toBe(report.rows.length);
  });
});

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n');
}
