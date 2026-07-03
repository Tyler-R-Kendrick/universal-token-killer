import { encode } from '@toon-format/toon';
import { estimateTokens, loadBenchmark, type BenchmarkCase } from './data.js';
import { gradeComposite, type CompositeWeights } from './graders/compositeGrader.js';
import { referenceJudge, round, type ArmOutput, type Judge } from './graders/shared.js';

export type ArmId = 'baseline' | 'competitor' | 'utk';

/**
 * The execution environment a single arm ("session") runs under. The harness
 * builds one per arm by folding the comparison's {@link Middleware} over
 * {@link DEFAULT_SESSION}. `judge`/`model` drive the LLM grader; `tools`/`skills`
 * are recorded on the artifact and are the seam where a live target would wire in
 * its real tool + skill set.
 */
export type SessionConfig = {
  tools: string[];
  skills: string[];
  model: string;
  judge: Judge;
};

export type SessionMeta = { arm: ArmId; competitor: string; benchmark: string };

/** A middleware that tweaks the session config for one arm (tools/skills/model/judge). */
export type Middleware = (config: SessionConfig, meta: SessionMeta) => SessionConfig | Promise<SessionConfig>;

/** A compaction technique: turn one case into the arm's model-visible + recoverable surface. */
export type Technique = (testCase: BenchmarkCase, session: SessionConfig, meta: SessionMeta) => ArmOutput | Promise<ArmOutput>;

export type Comparison = {
  /** Competitor slug, also the results artifact filename (e.g. "rtk"). */
  competitor: string;
  /** Human-readable competitor label. */
  label: string;
  /** Benchmark dataset name under `data/` (e.g. "tool-output"). */
  benchmark: string;
  description: string;
  /** How the competitor arm compacts each case. Baseline + UTK arms are supplied by the harness. */
  competitorArm: Technique;
  /** Per-provider session tweaks applied to every arm of this comparison. */
  middleware?: Middleware[];
  /** Composite weighting of token savings vs quality (default 0.5 / 0.5). */
  weights?: CompositeWeights;
  /** Minimum per-dimension quality for savings to count (default 1). */
  qualityGate?: number;
};

export type RunOptions = {
  /** Override the loaded cases (used by tests). */
  cases?: BenchmarkCase[];
  /** Base session before middleware; defaults to {@link DEFAULT_SESSION}. */
  baseSession?: SessionConfig;
  /** Max cases graded concurrently within an arm (default 8). */
  concurrency?: number;
};

export type CaseScore = {
  name: string;
  category: string;
  visibleTokens: number;
  baselineTokens: number;
  savingsRatio: number;
  quality: number;
  composite: number;
  passed: boolean;
};

export type ArmTotals = {
  cases: number;
  passed: number;
  visibleTokens: number;
  baselineTokens: number;
  savedTokens: number;
  avgRatio: number;
  avgQuality: number;
  avgComposite: number;
};

export type ArmResult = {
  arm: ArmId;
  label: string;
  session: { tools: string[]; skills: string[]; model: string };
  cases: CaseScore[];
  totals: ArmTotals;
};

export type ComparisonResult = {
  competitor: string;
  label: string;
  benchmark: string;
  description: string;
  cases: number;
  arms: Record<ArmId, ArmResult>;
};

export const DEFAULT_SESSION: SessionConfig = {
  tools: ['shell', 'read', 'edit'],
  skills: [],
  model: 'reference-judge',
  judge: referenceJudge
};

const ARM_LABELS: Record<ArmId, string> = {
  baseline: 'Baseline (raw tool output)',
  competitor: 'Competitor',
  utk: 'UTK (mediated compaction)'
};

/** Baseline arm: the agent reads the full, uncompacted tool output. */
export const baselineTechnique: Technique = (testCase) => ({
  visibleText: testCase.rawOutput,
  recoverableText: testCase.rawOutput
});

/**
 * UTK arm: persist the raw output (fully recoverable) and surface only a compact,
 * schema-backed handle in chat. Facts stay recoverable via the raw artifact while
 * the model-visible token cost collapses to the handle.
 */
export const utkTechnique: Technique = (testCase) => {
  const compact = toonify(testCase.rawOutput);
  const schema = schemaLabel(testCase.toolId);
  const rawTokens = estimateTokens(testCase.rawOutput);
  const compactTokens = estimateTokens(compact);
  const visibleText =
    `utk://${testCase.toolId} · schema ${schema} · ${rawTokens}→${compactTokens} tok · ` +
    `${testCase.requiredFacts.length} facts recoverable via utk_expand_context`;
  return { visibleText, recoverableText: testCase.rawOutput };
};

/** Run a comparison: baseline, competitor, and UTK arms over the same data, concurrently. */
export async function runComparison(comparison: Comparison, options: RunOptions = {}): Promise<ComparisonResult> {
  const cases = options.cases ?? (await loadBenchmark(comparison.benchmark));
  const base = options.baseSession ?? DEFAULT_SESSION;
  const concurrency = options.concurrency ?? 8;

  const arms: Array<{ id: ArmId; technique: Technique }> = [
    { id: 'baseline', technique: baselineTechnique },
    { id: 'competitor', technique: comparison.competitorArm },
    { id: 'utk', technique: utkTechnique }
  ];

  const armResults = await Promise.all(
    arms.map((arm) => runArm(arm.id, arm.technique, comparison, cases, base, concurrency))
  );

  return {
    competitor: comparison.competitor,
    label: comparison.label,
    benchmark: comparison.benchmark,
    description: comparison.description,
    cases: cases.length,
    arms: {
      baseline: armResults[0]!,
      competitor: armResults[1]!,
      utk: armResults[2]!
    }
  };
}

async function runArm(
  arm: ArmId,
  technique: Technique,
  comparison: Comparison,
  cases: BenchmarkCase[],
  base: SessionConfig,
  concurrency: number
): Promise<ArmResult> {
  const meta: SessionMeta = { arm, competitor: comparison.competitor, benchmark: comparison.benchmark };
  const session = await applyMiddleware(base, meta, comparison.middleware ?? []);
  const qualityGate = comparison.qualityGate ?? 1;

  const scores = await mapConcurrent(cases, concurrency, async (testCase) => {
    const output = await technique(testCase, session, meta);
    const graded = await gradeComposite({
      prompt: testCase.prompt,
      visibleText: output.visibleText,
      recoverableText: output.recoverableText,
      baselineText: testCase.rawOutput,
      requiredFacts: testCase.requiredFacts,
      irrelevantFacts: testCase.irrelevantFacts,
      judge: session.judge,
      weights: comparison.weights,
      qualityGate
    });
    const score: CaseScore = {
      name: testCase.name,
      category: testCase.category,
      visibleTokens: graded.components.tokens.metrics?.visibleTokens ?? 0,
      baselineTokens: graded.components.tokens.metrics?.baselineTokens ?? 0,
      savingsRatio: graded.components.tokens.score,
      quality: graded.components.quality.score,
      composite: graded.score,
      passed: graded.assertions[0]?.passed ?? false
    };
    return score;
  });

  return {
    arm,
    label: arm === 'competitor' ? comparison.label : ARM_LABELS[arm],
    session: { tools: session.tools, skills: session.skills, model: session.model },
    cases: scores,
    totals: totalsOf(scores)
  };
}

async function applyMiddleware(base: SessionConfig, meta: SessionMeta, middleware: Middleware[]): Promise<SessionConfig> {
  let config = base;
  for (const mw of middleware) {
    config = await mw(config, meta);
  }
  return config;
}

function totalsOf(scores: CaseScore[]): ArmTotals {
  const visibleTokens = sum(scores.map((s) => s.visibleTokens));
  const baselineTokens = sum(scores.map((s) => s.baselineTokens));
  return {
    cases: scores.length,
    passed: scores.filter((s) => s.passed).length,
    visibleTokens,
    baselineTokens,
    savedTokens: baselineTokens - visibleTokens,
    avgRatio: baselineTokens === 0 ? 0 : round(visibleTokens / baselineTokens),
    avgQuality: round(average(scores.map((s) => s.quality))),
    avgComposite: round(average(scores.map((s) => s.composite)))
  };
}

/** Bounded-concurrency map used to fan cases out within an arm. */
export async function mapConcurrent<T, U>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let next = 0;
  const workerCount = Math.min(Math.max(1, Math.floor(limit)), Math.max(1, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await run(items[index]!, index);
      }
    })
  );
  return results;
}

function toonify(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return encode(JSON.parse(trimmed) as never);
    } catch {
      /* not JSON — fall through to the text form */
    }
  }
  return raw;
}

function schemaLabel(toolId: string): string {
  return `${toolId.replace(/[^a-z0-9]+/gi, '-')}.v1`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}
