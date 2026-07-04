import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { PACKAGE_ROOT } from '../paths.js';
import { loadToolCallingCases, recoverySliceTokens, runToolCallingEpisode, type ToolCallingCase } from './toolCallingEfficiency.js';
import { renderArmSurface } from './armCli.js';
import { buildArmSuiteFromRoot, buildToolCallingSuite } from './suiteBuilder.js';

let cases: ToolCallingCase[] = [];
let workspaceRoot = '';

beforeAll(async () => {
  cases = await loadToolCallingCases(path.join(PACKAGE_ROOT, 'data', 'tool-calling-efficiency.jsonl'));
  workspaceRoot = await mkdtemp(path.join(tmpdir(), 'utk-tce-test-'));
});

afterAll(async () => {
  await rm(workspaceRoot, { recursive: true, force: true });
});

describe('tool-calling-efficiency dataset', () => {
  it('loads committed cases with verbatim facts and a catalog-resident target tool', async () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    for (const testCase of cases) {
      for (const fact of testCase.requiredFacts) expect(testCase.toolOutput).toContain(fact);
      expect(testCase.tools.some((tool) => tool.name === testCase.targetTool)).toBe(true);
    }
  });
});

describe('runToolCallingEpisode (real UTK code paths)', () => {
  it('utk arm: run 1 pays schema generation, later runs hit the real cache and amortize', async () => {
    const report = await runToolCallingEpisode({ workspaceRoot, testCase: cases[0]!, arm: 'utk', runs: 3 });
    expect(report.runs).toHaveLength(3);
    expect(report.runs[0]!.cache_hit).toBe(false);
    expect(report.runs[0]!.schema_generation_tokens).toBeGreaterThan(0);
    for (const run of report.runs.slice(1)) {
      expect(run.cache_hit).toBe(true);
      expect(run.schema_generation_tokens).toBe(0);
    }
    expect(report.steady_state_avg_total).toBeLessThanOrEqual(report.run1_total);
    expect(report.model).toContain('none');
  }, 60_000);

  it('baseline arm: stateless — every run costs the same', async () => {
    const report = await runToolCallingEpisode({ workspaceRoot: `${workspaceRoot}-b`, testCase: cases[0]!, arm: 'baseline', runs: 3 });
    const totals = report.runs.map((run) => run.total_tokens);
    expect(new Set(totals).size).toBe(1);
    expect(report.runs.every((run) => !run.cache_hit)).toBe(true);
  }, 60_000);

  it('charges the recovery slice only for facts missing from the visible surface', () => {
    expect(recoverySliceTokens('a fact line\nnoise', ['a fact line'], 'a fact line visible')).toBe(0);
    expect(recoverySliceTokens('a fact line\nnoise', ['a fact line'], 'handle only')).toBeGreaterThan(0);
  });
});

describe('arm surface reports', () => {
  const sample = {
    name: 'sample',
    category: 'Test',
    toolId: 'shell.test',
    prompt: 'find the failure',
    rawOutput: 'INFO warming up\nFAIL x line 42 TypeError boom\nINFO done',
    requiredFacts: ['FAIL x line 42'],
    irrelevantFacts: ['INFO warming up']
  };

  it('utk arm charges recovery tokens when facts are only recoverable', async () => {
    const report = await renderArmSurface('utk', sample);
    expect(report.recovery_tokens).toBeGreaterThan(0);
    expect(report.recoverable).toContain('FAIL x line 42');
  });

  it('baseline arm keeps facts visible with zero recovery charge', async () => {
    const report = await renderArmSurface('baseline', sample);
    expect(report.recovery_tokens).toBe(0);
    expect(report.visible).toBe(sample.rawOutput);
  });

  it('rejects unknown arms', async () => {
    await expect(renderArmSurface('nope', sample)).rejects.toThrow(/Unknown arm/);
  });
});

describe('SDK suite builders', () => {
  it('builds arm suites with weighted custom assertions and provenance metadata', () => {
    const suite = buildArmSuiteFromRoot(PACKAGE_ROOT, 'tool-selection') as unknown as {
      name: string;
      assertions: Array<{ type: string }>;
      tests: Array<{ metadata: Record<string, unknown> }>;
    };
    expect(suite.name).toBe('utk-tool-selection');
    expect(suite.assertions.map((a) => a.type)).toContain('unsafe-tool-exposure');
    expect(suite.tests[0]!.metadata.origin).toBe('synthetic');
  });

  it('builds the tool-calling suite with the configured run count', () => {
    const suite = buildToolCallingSuite({ root: PACKAGE_ROOT, runs: 7 }) as unknown as {
      tests: Array<{ input: string; metadata: Record<string, unknown> }>;
    };
    expect(suite.tests[0]!.metadata.runs).toBe(7);
    expect(JSON.parse(suite.tests[0]!.input).runs).toBe(7);
  });
});
