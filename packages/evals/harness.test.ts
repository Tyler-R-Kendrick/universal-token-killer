import { describe, expect, it } from 'vitest';
import { estimateTokens, parseBenchmark, loadBenchmark, loadProvenance, type BenchmarkCase } from './data.js';
import {
  DEFAULT_SESSION,
  runComparison,
  runBenchmark,
  utkTechnique,
  baselineTechnique,
  mapConcurrent,
  type Comparison,
  type SessionConfig
} from './harness.js';
import { COMPARISONS, makeCompetitorArm, infoScore, addSkill } from './comparison/index.js';
import { gradeTokens } from './graders/tokenGrader.js';
import { gradeRelevance } from './graders/relevanceGrader.js';
import { gradeComposite, gradeCompositeFromAgentV } from './graders/compositeGrader.js';
import { referenceJudge, type Judge } from './graders/shared.js';
import { renderSuiteYaml } from './scripts/generate-suite.js';
import { renderBenchmarkMarkdown, renderLeaderboard } from './report.js';

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

  it('reports the real source line number even after blank lines', () => {
    expect(() => parseBenchmark(`\n\nnot json`)).toThrow(/line 3/);
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

  it('loads the provenance manifest with related public benchmarks', async () => {
    const provenance = await loadProvenance('tool-output');
    expect(provenance?.origin).toBe('synthetic');
    expect(provenance?.related_benchmarks.map((b) => b.id)).toContain('terminal-bench');
    expect(await loadProvenance('does-not-exist')).toBeNull();
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
    const result = await runComparison(COMPARISONS[0]!);
    expect(result.cases).toBeGreaterThanOrEqual(10);
    expect(Object.keys(result.arms)).toEqual(['baseline', 'competitor', 'utk']);
    for (const arm of Object.values(result.arms)) {
      expect(arm.cases).toHaveLength(result.cases);
    }
  });

  it('applies the base-session model hook to all arms and per-provider middleware to its arm', async () => {
    const captured: string[] = [];
    const spyJudge: Judge = (request) => {
      captured.push(request.prompt);
      return referenceJudge(request);
    };
    // The model/judge hook is global (fair grading across arms); provider middleware
    // (skills) only tags that competitor's own arm.
    const baseSession: SessionConfig = { ...DEFAULT_SESSION, model: 'spy-model', judge: spyJudge };
    const result = await runComparison(COMPARISONS[0]!, { cases: [sampleCase], baseSession });
    expect(result.arms.utk.session.model).toBe('spy-model');
    expect(result.arms.competitor.session.skills).toContain('rtk-shell-summary');
    expect(result.arms.baseline.session.skills).not.toContain('rtk-shell-summary');
    expect(captured.length).toBeGreaterThan(0);
  });

  it('isolates a throwing technique to a single failed case', async () => {
    const comparison: Comparison = {
      competitor: 'boom',
      label: 'Throwing arm',
      benchmark: 'tool-output',
      description: 'always throws',
      competitorArm: () => {
        throw new Error('technique failed');
      }
    };
    const result = await runComparison(comparison, { cases: [sampleCase], concurrency: 1 });
    expect(result.arms.competitor.totals.passed).toBe(0);
    expect(result.arms.competitor.cases[0]?.composite).toBe(0);
    // Baseline and UTK arms still complete normally.
    expect(result.arms.utk.totals.passed).toBe(1);
  });
});

describe('runBenchmark (leaderboard)', () => {
  it('runs baseline + every competitor + UTK as sibling arms', async () => {
    const result = await runBenchmark(COMPARISONS);
    expect(result.arms).toHaveLength(COMPARISONS.length + 2);
    expect(result.arms[0]?.arm).toBe('baseline');
    expect(result.arms.at(-1)?.arm).toBe('utk');

    const baseline = result.arms.find((a) => a.arm === 'baseline')!;
    const utk = result.arms.find((a) => a.arm === 'utk')!;
    const competitors = result.arms.filter((a) => a.arm === 'competitor');
    expect(competitors).toHaveLength(COMPARISONS.length);

    // UTK spends the fewest visible tokens; baseline the most; UTK keeps every fact.
    for (const arm of [...competitors, baseline]) {
      expect(utk.totals.visibleTokens).toBeLessThan(arm.totals.visibleTokens);
      expect(baseline.totals.visibleTokens).toBeGreaterThanOrEqual(arm.totals.visibleTokens);
    }
    expect(utk.totals.passed).toBe(utk.totals.cases);
  });
});

describe('artifacts', () => {
  it('renders a provenance-tagged suite that references the composite grader', async () => {
    const [cases, provenance] = await Promise.all([loadBenchmark('tool-output'), loadProvenance('tool-output')]);
    const yaml = renderSuiteYaml('tool-output', cases, provenance);
    expect(yaml).toContain('name: tool-output');
    expect(yaml).toContain('provenance:');
    expect(yaml).toContain('related_benchmark:');
    expect(yaml).toContain('packages/evals/dist/graders/compositeGrader.js');
    for (const testCase of cases) {
      expect(yaml).toContain(`- id: ${testCase.name}`);
    }
  });

  it('renders a 3-column leaderboard with baseline and UTK as rows', async () => {
    const result = await runBenchmark(COMPARISONS);
    const leaderboard = renderLeaderboard(result).join('\n');
    expect(leaderboard).toContain('| Technique | Tokens | Change |');
    expect(leaderboard).toContain('Baseline');
    expect(leaderboard).toContain('UTK');

    const provenance = await loadProvenance('tool-output');
    const markdown = renderBenchmarkMarkdown(result, provenance);
    expect(markdown).toContain('## Leaderboard');
    expect(markdown).toContain('Terminal-Bench');
  });
});

describe('mapConcurrent', () => {
  it('preserves order under concurrency', async () => {
    const out = await mapConcurrent([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });
});
