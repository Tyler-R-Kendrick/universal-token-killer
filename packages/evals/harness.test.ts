import { describe, expect, it } from 'vitest';
import { estimateTokens, parseBenchmark, loadBenchmark, type BenchmarkCase } from './data.js';
import {
  DEFAULT_SESSION,
  runComparison,
  utkTechnique,
  baselineTechnique,
  mapConcurrent,
  type Comparison,
  type SessionConfig
} from './harness.js';
import { rtkComparison, compresrComparison, cavemanComparison, makeCompetitorArm, infoScore, COMPARISONS } from './comparison/index.js';
import { gradeTokens } from './graders/tokenGrader.js';
import { gradeRelevance } from './graders/relevanceGrader.js';
import { gradeComposite, gradeCompositeFromAgentV } from './graders/compositeGrader.js';
import { referenceJudge, type Judge } from './graders/shared.js';
import { renderSuiteYaml } from './scripts/generate-suite.js';
import { renderComparisonMarkdown, renderSummaryMarkdown } from './report.js';

const sampleCase: BenchmarkCase = {
  name: 'sample',
  category: 'Test',
  toolId: 'shell.test',
  prompt: 'find the failure',
  rawOutput: 'INFO warming up\nFAIL packages/x.test.ts line 42 TypeError boom\nINFO done in 12ms',
  requiredFacts: ['FAIL packages/x.test.ts line 42', 'TypeError boom'],
  irrelevantFacts: ['INFO warming up', 'INFO done in 12ms']
};

describe('data', () => {
  it('estimates tokens as ceil(len/4)', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('parses jsonl and skips blank lines', () => {
    const cases = parseBenchmark(`${JSON.stringify(sampleCase)}\n\n`);
    expect(cases).toHaveLength(1);
    expect(cases[0]?.requiredFacts).toEqual(sampleCase.requiredFacts);
  });

  it('rejects malformed lines and non-object cases', () => {
    expect(() => parseBenchmark('not json')).toThrow(/Invalid JSONL/);
    expect(() => parseBenchmark('123')).toThrow(/not an object/);
    expect(() => parseBenchmark('{"name":"x"}')).toThrow(/missing string field/);
  });

  it('loads the committed tool-output dataset with fact invariants intact', async () => {
    const cases = await loadBenchmark('tool-output');
    expect(cases.length).toBeGreaterThanOrEqual(10);
    for (const testCase of cases) {
      for (const fact of [...testCase.requiredFacts, ...testCase.irrelevantFacts]) {
        expect(testCase.rawOutput, `${testCase.name}: ${fact}`).toContain(fact);
      }
    }
  });
});

describe('graders', () => {
  it('token grader scores savings and flags regressions', () => {
    const saved = gradeTokens({ visibleText: 'short', baselineText: 'a much much longer baseline output' });
    expect(saved.metrics?.visibleTokens).toBeLessThan(saved.metrics?.baselineTokens ?? 0);
    expect(saved.score).toBeGreaterThan(0);
    const inflated = gradeTokens({ visibleText: 'a very long inflated output', baselineText: 'tiny' });
    expect(inflated.score).toBe(0);
    expect(inflated.assertions[0]?.passed).toBe(false);
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
    expect(kept.metrics?.relevance).toBe(1);
    const lost = await gradeRelevance({
      prompt: sampleCase.prompt,
      visibleText: 'TypeError boom',
      recoverableText: 'TypeError boom',
      requiredFacts: sampleCase.requiredFacts,
      irrelevantFacts: sampleCase.irrelevantFacts
    });
    expect(lost.metrics?.accuracy).toBe(0.5);
  });

  it('composite grader gates on fact retention', async () => {
    const dropsFact = await gradeComposite({
      prompt: sampleCase.prompt,
      visibleText: 'boom',
      recoverableText: 'boom',
      baselineText: sampleCase.rawOutput,
      requiredFacts: sampleCase.requiredFacts,
      irrelevantFacts: sampleCase.irrelevantFacts
    });
    expect(dropsFact.score).toBe(0);
    expect(dropsFact.assertions[0]?.passed).toBe(false);

    const keepsFacts = await gradeComposite({
      prompt: sampleCase.prompt,
      visibleText: 'FAIL packages/x.test.ts line 42 TypeError boom',
      recoverableText: 'FAIL packages/x.test.ts line 42 TypeError boom',
      baselineText: sampleCase.rawOutput,
      requiredFacts: sampleCase.requiredFacts,
      irrelevantFacts: sampleCase.irrelevantFacts
    });
    expect(keepsFacts.assertions[0]?.passed).toBe(true);
  });

  it('bridges the AgentV stdin/stdout contract', async () => {
    const result = await gradeCompositeFromAgentV({
      input: [{ role: 'user', content: sampleCase.prompt }],
      expected_output: JSON.stringify({
        prompt: sampleCase.prompt,
        rawOutput: sampleCase.rawOutput,
        requiredFacts: sampleCase.requiredFacts,
        irrelevantFacts: sampleCase.irrelevantFacts
      }),
      output: JSON.stringify({ visible: 'handle', recoverable: sampleCase.rawOutput })
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.assertions[0]?.passed).toBe(true);
  });
});

describe('techniques', () => {
  it('baseline shows raw, UTK shows a tiny recoverable handle', () => {
    const largeCase: BenchmarkCase = {
      ...sampleCase,
      rawOutput: `${sampleCase.rawOutput}\n${'noise line with detail '.repeat(20)}`
    };
    const baseline = baselineTechnique(largeCase, DEFAULT_SESSION, { arm: 'baseline', competitor: 'x', benchmark: 'b' });
    expect(baseline.visibleText).toBe(largeCase.rawOutput);

    const utk = utkTechnique(largeCase, DEFAULT_SESSION, { arm: 'utk', competitor: 'x', benchmark: 'b' });
    expect(estimateTokens(utk.visibleText)).toBeLessThan(estimateTokens(largeCase.rawOutput));
    expect(utk.recoverableText).toBe(largeCase.rawOutput);
    expect(utk.visibleText).not.toContain('TypeError boom');
  });

  it('infoScore ranks structured lines above prose', () => {
    expect(infoScore('packages/core/src/x.ts:42:14')).toBeGreaterThan(infoScore('warming up the reference judge'));
  });
});

describe('runComparison', () => {
  it('runs baseline, competitor, and UTK arms over the shared dataset', async () => {
    const result = await runComparison(rtkComparison);
    expect(result.cases).toBeGreaterThanOrEqual(10);
    expect(Object.keys(result.arms)).toEqual(['baseline', 'competitor', 'utk']);
    for (const arm of Object.values(result.arms)) {
      expect(arm.cases).toHaveLength(result.cases);
    }
  });

  it('UTK keeps every fact while cutting the most visible tokens', async () => {
    for (const comparison of COMPARISONS) {
      const result = await runComparison(comparison);
      const { baseline, competitor, utk } = result.arms;
      // eslint-disable-next-line no-console
      console.info(
        `${comparison.competitor}: baseline=${baseline.totals.visibleTokens} competitor=${competitor.totals.visibleTokens} ` +
          `utk=${utk.totals.visibleTokens} | quality b=${baseline.totals.avgQuality} c=${competitor.totals.avgQuality} u=${utk.totals.avgQuality} ` +
          `| composite b=${baseline.totals.avgComposite} c=${competitor.totals.avgComposite} u=${utk.totals.avgComposite} ` +
          `| facts c=${competitor.totals.passed}/${competitor.totals.cases} u=${utk.totals.passed}/${utk.totals.cases}`
      );
      expect(utk.totals.passed).toBe(utk.totals.cases);
      expect(utk.totals.avgQuality).toBe(1);
      expect(utk.totals.visibleTokens).toBeLessThan(competitor.totals.visibleTokens);
      expect(competitor.totals.visibleTokens).toBeLessThanOrEqual(baseline.totals.visibleTokens);
      expect(utk.totals.avgComposite).toBeGreaterThan(competitor.totals.avgComposite);
    }
  });

  it('applies middleware to configure the session per provider', async () => {
    const captured: string[] = [];
    const spyJudge: Judge = (request) => {
      captured.push(request.prompt);
      return referenceJudge(request);
    };
    const comparison: Comparison = {
      ...rtkComparison,
      middleware: [
        (config): SessionConfig => ({ ...config, model: 'spy-model', judge: spyJudge, skills: [...config.skills, 'rtk-shell-summary'] })
      ]
    };
    const result = await runComparison(comparison, { cases: [sampleCase] });
    expect(result.arms.utk.session.model).toBe('spy-model');
    expect(result.arms.utk.session.skills).toContain('rtk-shell-summary');
    expect(captured.length).toBeGreaterThan(0);
  });

  it('respects an injected competitor arm and base session', async () => {
    const comparison: Comparison = {
      competitor: 'noop',
      label: 'No-op passthrough',
      benchmark: 'tool-output',
      description: 'passes raw through',
      competitorArm: makeCompetitorArm({ keepThreshold: 0 })
    };
    const result = await runComparison(comparison, { cases: [sampleCase], concurrency: 1 });
    // keepThreshold 0 keeps every informative line but still drops pure noise,
    // so the competitor arm is no larger than the baseline and retains the facts.
    expect(result.arms.competitor.totals.visibleTokens).toBeLessThanOrEqual(result.arms.baseline.totals.visibleTokens);
    expect(result.arms.competitor.totals.passed).toBe(1);
  });
});

describe('artifacts', () => {
  it('renders a suite that references the composite grader', async () => {
    const cases = await loadBenchmark('tool-output');
    const yaml = renderSuiteYaml('tool-output', cases);
    expect(yaml).toContain('suite: tool-output');
    expect(yaml).toContain('packages/evals/dist/graders/compositeGrader.js');
    for (const testCase of cases) {
      expect(yaml).toContain(`- id: ${testCase.name}`);
    }
  });

  it('renders comparison and summary markdown', async () => {
    const results = await Promise.all(COMPARISONS.map((comparison) => runComparison(comparison)));
    expect(renderComparisonMarkdown(results[0]!)).toContain('vs UTK');
    const summary = renderSummaryMarkdown(results);
    expect(summary).toContain('Benchmark Summary');
    expect(summary).toContain('fewer');
  });
});

describe('mapConcurrent', () => {
  it('preserves order under concurrency', async () => {
    const out = await mapConcurrent([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });
});
