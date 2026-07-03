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
  /** Competitor slug (e.g. "rtk"). */
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
  competitor: string;
  label: string;
  session: { tools: string[]; skills: string[]; model: string };
  cases: CaseScore[];
  totals: ArmTotals;
};

/** One competitor's baseline/competitor/UTK view of the benchmark. */
export type ComparisonResult = {
  competitor: string;
  label: string;
  benchmark: string;
  description: string;
  cases: number;
  arms: Record<ArmId, ArmResult>;
};

/** The whole benchmark as one leaderboard: baseline, every competitor, and UTK as sibling arms. */
export type BenchmarkResult = {
  benchmark: string;
  cases: number;
  /** Baseline first, competitors in registry order, UTK last. */
  arms: ArmResult[];
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

/** Internal spec for one arm of a run. */
type ArmSpec = {
  arm: ArmId;
  competitor: string;
  label: string;
  technique: Technique;
  middleware: Middleware[];
  weights?: CompositeWeights;
  qualityGate?: number;
};

function baselineSpec(): ArmSpec {
  return { arm: 'baseline', competitor: 'baseline', label: ARM_LABELS.baseline, technique: baselineTechnique, middleware: [] };
}

function utkSpec(): ArmSpec {
  return { arm: 'utk', competitor: 'utk', label: ARM_LABELS.utk, technique: utkTechnique, middleware: [] };
}

function competitorSpec(comparison: Comparison): ArmSpec {
  return {
    arm: 'competitor',
    competitor: comparison.competitor,
    label: comparison.label,
    technique: comparison.competitorArm,
    middleware: comparison.middleware ?? [],
    weights: comparison.weights,
    qualityGate: comparison.qualityGate
  };
}

/** Run one comparison: baseline, this competitor, and UTK arms over the same data, concurrently. */
export async function runComparison(comparison: Comparison, options: RunOptions = {}): Promise<ComparisonResult> {
  const cases = options.cases ?? (await loadBenchmark(comparison.benchmark));
  const base = options.baseSession ?? DEFAULT_SESSION;
  const concurrency = options.concurrency ?? 8;
  const specs = [baselineSpec(), competitorSpec(comparison), utkSpec()];
  const [baseline, competitor, utk] = await Promise.all(
    specs.map((spec) => runArm(spec, comparison.benchmark, cases, base, concurrency))
  );
  return {
    competitor: comparison.competitor,
    label: comparison.label,
    benchmark: comparison.benchmark,
    description: comparison.description,
    cases: cases.length,
    arms: { baseline: baseline!, competitor: competitor!, utk: utk! }
  };
}

/**
 * Run the whole benchmark as one leaderboard: baseline, every competitor arm, and
 * UTK — all over the same data, concurrently. Arms come back baseline-first,
 * competitors in registry order, UTK last.
 */
export async function runBenchmark(comparisons: Comparison[], options: RunOptions = {}): Promise<BenchmarkResult> {
  const benchmark = comparisons[0]?.benchmark ?? 'tool-output';
  const cases = options.cases ?? (await loadBenchmark(benchmark));
  const base = options.baseSession ?? DEFAULT_SESSION;
  const concurrency = options.concurrency ?? 8;
  const specs = [baselineSpec(), ...comparisons.map(competitorSpec), utkSpec()];
  const arms = await Promise.all(specs.map((spec) => runArm(spec, benchmark, cases, base, concurrency)));
  return { benchmark, cases: cases.length, arms };
}

async function runArm(spec: ArmSpec, benchmark: string, cases: BenchmarkCase[], base: SessionConfig, concurrency: number): Promise<ArmResult> {
  const meta: SessionMeta = { arm: spec.arm, competitor: spec.competitor, benchmark };
  const session = await applyMiddleware(base, meta, spec.middleware);
  const qualityGate = spec.qualityGate ?? 1;

  const scores = await mapConcurrent(cases, concurrency, async (testCase) => {
    // Isolate per-case failures (a real injected judge can throw) so one bad case
    // does not abort the whole arm — record it as a failed, zero-savings score.
    try {
      const output = await spec.technique(testCase, session, meta);
      const graded = await gradeComposite({
        prompt: testCase.prompt,
        visibleText: output.visibleText,
        recoverableText: output.recoverableText,
        baselineText: testCase.rawOutput,
        requiredFacts: testCase.requiredFacts,
        irrelevantFacts: testCase.irrelevantFacts,
        judge: session.judge,
        weights: spec.weights,
        qualityGate
      });
      const factsRetained = graded.assertions.find((assertion) => assertion.text.startsWith('facts retained'))?.passed ?? false;
      return {
        name: testCase.name,
        category: testCase.category,
        visibleTokens: graded.components.tokens.metrics?.visibleTokens ?? 0,
        baselineTokens: graded.components.tokens.metrics?.baselineTokens ?? 0,
        savingsRatio: graded.components.tokens.score,
        quality: graded.components.quality.score,
        composite: graded.score,
        passed: factsRetained
      } satisfies CaseScore;
    } catch {
      const baselineTokens = estimateTokens(testCase.rawOutput);
      return {
        name: testCase.name,
        category: testCase.category,
        visibleTokens: baselineTokens,
        baselineTokens,
        savingsRatio: 0,
        quality: 0,
        composite: 0,
        passed: false
      } satisfies CaseScore;
    }
  });

  return {
    arm: spec.arm,
    competitor: spec.competitor,
    label: spec.label,
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
      return encode(JSON.parse(trimmed));
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
