import { describe, expect, it } from 'vitest';
import { DATA_DIR, estimateTokens, parseBenchmark, loadBenchmark, loadProvenance, type BenchmarkCase } from './data.js';
import { REFERENCE_MODEL, type CostModel } from './model.js';
import {
  aggregateTechnique,
  checkRegressionGate,
  computeRunMetrics,
  headlineNumbers,
  paretoFrontier,
  percentile,
  type RunContext,
  type RunMetrics,
  type RunOutcome
} from './metrics.js';
import { BENCHMARKS, getBenchmark, scoreArmOutput } from './benchmarks.js';
import { realDataConfigured, loadRealDataset } from './adapters.js';
import {
  DEFAULT_SESSION,
  baselineTechnique,
  utkTechnique,
  mapConcurrent,
  runSuite,
  runBenchmarkReport,
  SWEEP_THRESHOLDS
} from './harness.js';
import { COMPETITORS, makeCompetitorArm, infoScore } from './comparison/index.js';
import { gradeTokens } from './graders/tokenGrader.js';
import { gradeRelevance } from './graders/relevanceGrader.js';
import { gradeComposite, gradeCompositeFromAgentV } from './graders/compositeGrader.js';
import { renderSuiteYaml } from './scripts/generate-suite.js';
import { renderLeaderboard, renderHeadlines, renderGates, renderCrossBenchmark, renderSuiteMarkdown } from './report.js';
import { renderParetoSvg } from './pareto.js';

const sampleCase: BenchmarkCase = {
  name: 'sample',
  category: 'Test',
  toolId: 'shell.test',
  prompt: 'find the failure',
  rawOutput: 'INFO warming up\nFAIL packages/x.test.ts line 42 TypeError boom\nINFO done in 12ms',
  requiredFacts: ['FAIL packages/x.test.ts line 42', 'TypeError boom'],
  irrelevantFacts: ['INFO warming up', 'INFO done in 12ms']
};

const toolCatalogCase: BenchmarkCase = {
  name: 'catalog',
  category: 'Billing',
  toolId: 'catalog.test',
  prompt: 'issue a refund',
  rawOutput: 'get_invoice(id): read one\nissue_partial_refund(id, amount): refund part\ndelete_customer(id): destroy a customer',
  requiredFacts: ['issue_partial_refund(id, amount): refund part'],
  irrelevantFacts: ['get_invoice(id): read one'],
  unsafeTools: ['delete_customer']
};

describe('data', () => {
  it('estimates tokens as ceil(len/4)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('parses jsonl, skips blanks, and reports real line numbers', () => {
    expect(parseBenchmark(`${JSON.stringify(sampleCase)}\n\n`)).toHaveLength(1);
    expect(() => parseBenchmark(`\n\nnot json`)).toThrow(/line 3/);
    expect(() => parseBenchmark('{"name":"x"}')).toThrow(/missing string field/);
  });

  it('parses the optional unsafeTools field', () => {
    const [parsed] = parseBenchmark(JSON.stringify(toolCatalogCase));
    expect(parsed?.unsafeTools).toEqual(['delete_customer']);
    const [plain] = parseBenchmark(JSON.stringify(sampleCase));
    expect(plain?.unsafeTools).toBeUndefined();
  });

  it('every committed benchmark keeps its fact invariants (facts are verbatim substrings)', async () => {
    for (const benchmark of BENCHMARKS) {
      const cases = await loadBenchmark(benchmark.name);
      expect(cases.length, benchmark.name).toBeGreaterThanOrEqual(10);
      for (const testCase of cases) {
        for (const fact of [...testCase.requiredFacts, ...testCase.irrelevantFacts, ...(testCase.unsafeTools ?? [])]) {
          expect(testCase.rawOutput, `${benchmark.name}/${testCase.name}: ${fact}`).toContain(fact);
        }
      }
    }
  });

  it('loads a provenance manifest with related public benchmarks for every benchmark', async () => {
    for (const benchmark of BENCHMARKS) {
      const provenance = await loadProvenance(benchmark.name);
      expect(provenance?.origin, benchmark.name).toBe('synthetic');
      expect(provenance?.related_benchmarks.length, benchmark.name).toBeGreaterThan(0);
    }
    expect(await loadProvenance('does-not-exist')).toBeNull();
  });
});

describe('cost model + metrics', () => {
  const ctx: RunContext = { retrievedContextTokens: 400, compressedContextTokens: 100, promptTokens: 20, outputTokens: 48, toolSchemaTokens: 0, recoveredContextTokens: 0, compresses: true };
  const outcome: RunOutcome = { taskSuccess: 1, qualityScore: 0.9, faithfulnessScore: 1, failureCategory: 'none', recoveryToolCalls: 0, fallbackCount: 0, retryCount: 0, invalidToolCallCount: 0 };

  it('computes the 19 fields and keeps buckets disjoint', () => {
    const m = computeRunMetrics(ctx, outcome, REFERENCE_MODEL);
    expect(m.input_tokens).toBe(120); // prompt + compressed + tool_schema + recovered (disjoint)
    expect(m.compression_latency_ms).toBeGreaterThan(0);
    expect(m.total_latency_ms).toBeCloseTo(m.model_latency_ms + m.tool_latency_ms + m.compression_latency_ms, 3);
    expect(Object.keys(m)).toHaveLength(19);
  });

  it('charges recovered-payload tokens into input tokens', () => {
    const withRecovery = computeRunMetrics({ ...ctx, recoveredContextTokens: 40 }, outcome, REFERENCE_MODEL);
    expect(withRecovery.input_tokens).toBe(160);
    expect(withRecovery.recovered_context_tokens).toBe(40);
    expect(withRecovery.model_cost).toBeGreaterThan(computeRunMetrics(ctx, outcome, REFERENCE_MODEL).model_cost);
  });

  it('charges a tool round-trip when there are recovery/fallback/retry calls', () => {
    const withTool = computeRunMetrics(ctx, { ...outcome, recoveryToolCalls: 1 }, REFERENCE_MODEL);
    expect(withTool.tool_latency_ms).toBe(REFERENCE_MODEL.toolCallMs);
    expect(withTool.tool_cost).toBeGreaterThan(0);
  });

  it('aggregates, gates, and finds the Pareto frontier', () => {
    const mk = (success: number, cost: number): RunMetrics => computeRunMetrics(
      { ...ctx, compressedContextTokens: cost },
      { ...outcome, taskSuccess: success },
      REFERENCE_MODEL
    );
    const baseline = aggregateTechnique('baseline', 'Baseline', [mk(1, 400), mk(1, 400)], 800);
    const good = aggregateTechnique('good', 'Good', [mk(1, 100), mk(1, 100)], 800);
    const bad = aggregateTechnique('bad', 'Bad', [mk(0, 100), mk(1, 100)], 800);

    expect(baseline.tokenReduction).toBe(0);
    expect(good.tokenReduction).toBeGreaterThan(0);
    expect(good.taskSuccessRate).toBe(1);
    expect(bad.taskSuccessRate).toBe(0.5);

    const frontier = paretoFrontier([baseline, good, bad]);
    expect(frontier.has('good')).toBe(true); // cheaper and higher success dominates
    expect(frontier.has('bad')).toBe(false);

    const gate = checkRegressionGate(bad, baseline);
    expect(gate.passed).toBe(false);
    expect(checkRegressionGate(good, baseline).passed).toBe(true);
  });

  it('reads headline numbers off a sweep and computes percentiles', () => {
    const baseline = aggregateTechnique('baseline', 'Baseline', [computeRunMetrics(ctx, outcome, REFERENCE_MODEL)], ctx.compressedContextTokens);
    const sweep = [0.2, 0.5, 0.8].map((reduction, i) =>
      aggregateTechnique('t', `t${i}`, [computeRunMetrics({ ...ctx, compressedContextTokens: Math.round(100 * (1 - reduction)) }, outcome, REFERENCE_MODEL)], 100)
    );
    const h = headlineNumbers(sweep, baseline);
    expect(h.qualityRetentionAt50PctReduction).toBeGreaterThan(0);
    expect(percentile([1, 2, 3, 4], 95)).toBeGreaterThanOrEqual(3);
    expect(percentile([], 95)).toBe(0);
  });
});

describe('benchmarks + scoring', () => {
  it('registers the five benchmarks', () => {
    expect(BENCHMARKS.map((b) => b.name)).toEqual(['tool-output', 'long-context', 'needle-in-haystack', 'tool-selection', 'agent-workflows']);
    expect(getBenchmark('needle-in-haystack')?.kind).toBe('needle');
  });

  it('scores fact retention on the recoverable surface and relevance on the visible surface', () => {
    const benchmark = getBenchmark('tool-output')!;
    const utk = scoreArmOutput(benchmark, sampleCase, 'utk', { visibleText: 'handle', recoverableText: sampleCase.rawOutput });
    expect(utk.outcome.taskSuccess).toBe(1); // facts recoverable — by construction when recoverable=raw
    expect(utk.outcome.recoveryToolCalls).toBe(1); // the round-trip is charged...
    expect(utk.context.recoveredContextTokens).toBeGreaterThan(0); // ...and so is its returned payload
    const dropped = scoreArmOutput(benchmark, sampleCase, 'competitor', { visibleText: 'INFO warming up', recoverableText: 'INFO warming up' });
    expect(dropped.outcome.taskSuccess).toBe(0); // required facts lost
    expect(dropped.context.recoveredContextTokens).toBe(0); // nothing recoverable → nothing to recover
  });

  it('does not charge recovery when the facts are already visible', () => {
    const benchmark = getBenchmark('tool-output')!;
    const visible = scoreArmOutput(benchmark, sampleCase, 'competitor', { visibleText: sampleCase.rawOutput, recoverableText: sampleCase.rawOutput });
    expect(visible.outcome.recoveryToolCalls).toBe(0);
    expect(visible.context.recoveredContextTokens).toBe(0);
  });

  it('flags an unsafe-tool error when a mutating tool stays visible after the safe tool is dropped', () => {
    const benchmark = getBenchmark('tool-selection')!;
    const unsafe = scoreArmOutput(benchmark, toolCatalogCase, 'competitor', {
      visibleText: 'delete_customer(id): destroy a customer',
      recoverableText: 'delete_customer(id): destroy a customer'
    });
    expect(unsafe.outcome.taskSuccess).toBe(0);
    expect(unsafe.outcome.failureCategory).toBe('unsafe-tool');
    // The visible payload is charged to the tool-schema bucket, not context.
    expect(unsafe.context.compressedContextTokens).toBe(0);
    expect(unsafe.context.toolSchemaTokens).toBeGreaterThan(0);
  });
});

describe('graders', () => {
  it('token grader scores savings and flags regressions', () => {
    const saved = gradeTokens({ visibleText: 'short', baselineText: 'a much much longer baseline output' });
    expect(saved.score).toBeGreaterThan(0);
    expect(gradeTokens({ visibleText: 'a very long inflated output', baselineText: 'tiny' }).score).toBe(0);
  });

  it('relevance grader rewards retention and noise exclusion', async () => {
    const kept = await gradeRelevance({
      prompt: sampleCase.prompt,
      visibleText: 'FAIL packages/x.test.ts line 42 TypeError boom',
      recoverableText: 'FAIL packages/x.test.ts line 42 TypeError boom',
      requiredFacts: sampleCase.requiredFacts,
      irrelevantFacts: sampleCase.irrelevantFacts
    });
    expect(kept.metrics?.accuracy).toBe(1);
  });

  it('composite grader gates on fact retention and bridges the AgentV contract', async () => {
    const dropsFact = await gradeComposite({
      prompt: sampleCase.prompt,
      visibleText: 'boom',
      recoverableText: 'boom',
      baselineText: sampleCase.rawOutput,
      requiredFacts: sampleCase.requiredFacts,
      irrelevantFacts: sampleCase.irrelevantFacts
    });
    expect(dropsFact.score).toBe(0);

    const bridged = await gradeCompositeFromAgentV({
      input: [{ role: 'user', content: sampleCase.prompt }],
      expected_output: JSON.stringify({ prompt: sampleCase.prompt, rawOutput: sampleCase.rawOutput, requiredFacts: sampleCase.requiredFacts, irrelevantFacts: sampleCase.irrelevantFacts }),
      output: JSON.stringify({ visible: 'handle', recoverable: sampleCase.rawOutput })
    });
    expect(bridged.score).toBeGreaterThan(0);
  });
});

describe('techniques', () => {
  it('baseline shows raw, UTK shows a tiny recoverable handle', () => {
    const largeCase: BenchmarkCase = { ...sampleCase, rawOutput: `${sampleCase.rawOutput}\n${'noise line with detail '.repeat(20)}` };
    expect(baselineTechnique(largeCase)).toMatchObject({ visibleText: largeCase.rawOutput });
    const utk = utkTechnique(largeCase) as { visibleText: string; recoverableText: string };
    expect(estimateTokens(utk.visibleText)).toBeLessThan(estimateTokens(largeCase.rawOutput));
    expect(utk.recoverableText).toBe(largeCase.rawOutput);
    expect(utk.visibleText).not.toContain('TypeError boom');
  });

  it('infoScore ranks structured lines above prose', () => {
    expect(infoScore('packages/core/src/x.ts:42:14')).toBeGreaterThan(infoScore('warming up the reference judge'));
  });

  it('makeCompetitorArm keeps salient facts and drops noise', () => {
    const arm = makeCompetitorArm({ keepThreshold: 0.2 });
    const out = arm(sampleCase) as { visibleText: string };
    expect(out.visibleText).toContain('FAIL packages/x.test.ts line 42');
    expect(out.visibleText).not.toContain('INFO warming up');
  });
});

describe('runSuite', () => {
  it('runs every benchmark with baseline + competitors + UTK and a Pareto frontier', async () => {
    const suite = await runSuite();
    expect(suite.model).toBe(REFERENCE_MODEL.id);
    expect(suite.benchmarks).toHaveLength(BENCHMARKS.length);
    for (const report of suite.benchmarks) {
      expect(report.competitors).toHaveLength(COMPETITORS.length);
      // Baseline reads everything, so full retention. The UTK arm's retention is
      // 1.0 BY CONSTRUCTION (it declares the raw output recoverable) — this
      // assertion documents that construction, it is not a measured result.
      expect(report.baseline.primary.taskSuccessRate).toBe(1);
      expect(report.utk.primary.taskSuccessRate).toBe(1);
      // Structural sanity only — deliberately NOT asserting that UTK beats any
      // competitor: outcome-shaped assertions would freeze the leaderboard into
      // CI and block honest scoring changes.
      expect(report.utk.primary.visibleTokens).toBeGreaterThan(0);
      expect(report.utk.primary.tokenReduction).toBeLessThanOrEqual(1);
      // Every competitor is swept across aggressiveness.
      for (const competitor of report.competitors) {
        expect(competitor.sweep.length).toBeGreaterThan(1);
        expect(competitor.gate).not.toBeNull();
      }
      // The frontier is a non-empty subset of the technique names.
      const names = new Set([report.baseline, ...report.competitors, report.utk].map((t) => t.technique));
      expect(report.frontier.length).toBeGreaterThan(0);
      for (const name of report.frontier) expect(names.has(name)).toBe(true);
    }
  });

  it('runs a single benchmark and logs 19 fields per case', async () => {
    const report = await runBenchmarkReport('needle-in-haystack');
    expect(report.kind).toBe('needle');
    expect(report.utk.runs.length).toBe(report.cases);
    expect(Object.keys(report.utk.runs[0]!)).toHaveLength(19);
  });

  it('honours the sweep option and case overrides', async () => {
    const report = await runBenchmarkReport('tool-output', { casesByBenchmark: { 'tool-output': [sampleCase] }, sweep: [0.1, 0.3] });
    expect(report.cases).toBe(1);
    expect(report.competitors[0]?.sweep.length).toBeGreaterThanOrEqual(2);
  });

  it('applies a swapped cost model', async () => {
    const cheap: CostModel = { ...REFERENCE_MODEL, id: 'cheap', priceInPerToken: 0, priceOutPerToken: 0, toolCallCostUsd: 0 };
    const report = await runBenchmarkReport('tool-output', { costModel: cheap });
    expect(report.baseline.primary.costPerTask).toBe(0);
  });
});

describe('report + chart', () => {
  it('renders per-benchmark tables, a cross-benchmark summary, and a Pareto SVG', async () => {
    const suite = await runSuite();
    const first = suite.benchmarks[0]!;

    const leaderboard = renderLeaderboard(first).join('\n');
    expect(leaderboard).toContain('| Technique | Model-visible tokens (incl. recovery) | Token reduction | Fact retention | Avg quality | Cost/task | P95 latency |');
    expect(leaderboard).toContain('UTK');

    expect(renderHeadlines(first).join('\n')).toContain('Quality retention @ 50% token reduction');
    expect(renderGates(first).join('\n')).toMatch(/pass|fail/);
    expect(renderCrossBenchmark(suite).join('\n')).toContain('Tool output');

    const svg = renderParetoSvg(first);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Pareto frontier');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);

    const provenance = Object.fromEntries(await Promise.all(BENCHMARKS.map(async (b) => [b.name, await loadProvenance(b.name)] as const)));
    const charts = Object.fromEntries(BENCHMARKS.map((b) => [b.name, `charts/${b.name}-pareto.svg`]));
    const markdown = renderSuiteMarkdown(suite, { provenance, charts, timestamp: '2026-07-03T00:00:00Z' });
    expect(markdown).toContain('type: benchmark');
    expect(markdown).toContain('## Cross-benchmark summary');
    expect(markdown).toContain('SWE-bench Verified');
    expect(markdown).toContain('failure_category'); // the 19-field methodology list
    expect(markdown).toContain('recovered_context_tokens');
    expect(markdown).toContain('### Models used');
    expect(markdown).toContain('No LLM');
  });
});

describe('AgentV suite generation', () => {
  it('formalizes a dataset into a provenance-tagged suite that references the composite grader', async () => {
    const [cases, provenance] = await Promise.all([loadBenchmark('tool-selection'), loadProvenance('tool-selection')]);
    const yaml = renderSuiteYaml('tool-selection', cases, provenance);
    expect(yaml).toContain('name: tool-selection');
    expect(yaml).toContain('provenance:');
    expect(yaml).toContain('packages/evals/dist/graders/compositeGrader.js');
    for (const testCase of cases) expect(yaml).toContain(`- id: ${testCase.name}`);
  });
});

describe('real-dataset seam', () => {
  it('is off by default and falls back to the committed analog', async () => {
    expect(realDataConfigured()).toBe(false);
    expect(await loadRealDataset('tool-output')).toBeNull();
    expect(await loadRealDataset('tool-output', '')).toBeNull();
  });

  it('loads an export in the BenchmarkCase shape when a directory is configured', async () => {
    // Exercise the configured branch through the explicit dir arg (no env mutation);
    // the committed data dir doubles as a stand-in real-dataset export.
    const loaded = await loadRealDataset('tool-output', DATA_DIR);
    expect(loaded?.length).toBeGreaterThan(0);
    expect(loaded?.[0]?.requiredFacts).toBeInstanceOf(Array);
    expect(await loadRealDataset('does-not-exist', DATA_DIR)).toBeNull();
  });
});

describe('mapConcurrent', () => {
  it('preserves order under concurrency', async () => {
    expect(await mapConcurrent([1, 2, 3, 4, 5], 2, async (n) => n * 2)).toEqual([2, 4, 6, 8, 10]);
  });

  it('exposes a default session and sweep', () => {
    expect(DEFAULT_SESSION.model).toBe(REFERENCE_MODEL.id);
    expect(SWEEP_THRESHOLDS.length).toBeGreaterThan(3);
  });
});
