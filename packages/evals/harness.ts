import { encode } from '@toon-format/toon';
import { estimateTokens, loadBenchmark, type BenchmarkCase } from './data.js';
import { loadRealDataset } from './adapters.js';
import { BENCHMARKS, getBenchmark, scoreArmOutput, type ArmKind, type Benchmark, type BenchmarkKind } from './benchmarks.js';
import {
  aggregateTechnique,
  checkRegressionGate,
  computeRunMetrics,
  headlineNumbers,
  paretoFrontier,
  type GateVerdict,
  type HeadlineNumbers,
  type RegressionGate,
  type RunMetrics,
  type TechniqueAggregate
} from './metrics.js';
import { REFERENCE_MODEL, type CostModel } from './model.js';
import { addSkill, COMPETITORS, makeCompetitorArm, type Competitor } from './comparison/index.js';
import type { ArmOutput } from './graders/shared.js';

/** Turn one case into an arm's model-visible + recoverable surface. May be async (a live target). */
export type ArmTechnique = (testCase: BenchmarkCase) => ArmOutput | Promise<ArmOutput>;

/**
 * The recorded execution environment for one arm. `tools`/`skills`/`model` are the
 * seam a live target wires its real tool + skill set + model into; the harness folds
 * a comparison's {@link Middleware} over {@link DEFAULT_SESSION} to build it. Cost and
 * latency come from the swappable {@link CostModel}, not from this record.
 */
export type SessionConfig = {
  tools: string[];
  skills: string[];
  model: string;
};

export type SessionMeta = { technique: string; benchmark: string; armKind: ArmKind };

/** A hook that configures one arm's session (tools/skills/model). */
export type Middleware = (config: SessionConfig, meta: SessionMeta) => SessionConfig;

export const DEFAULT_SESSION: SessionConfig = {
  tools: ['shell', 'read', 'edit'],
  skills: [],
  model: REFERENCE_MODEL.id
};

const BASELINE_LABEL = 'Baseline (raw context)';
const UTK_LABEL = 'UTK (mediated compaction)';

/** Aggressiveness sweep: the keep-threshold operating points that trace each competitor's curve. */
export const SWEEP_THRESHOLDS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4];

/** Baseline arm: the agent reads the full, uncompacted context. */
export const baselineTechnique: ArmTechnique = (testCase) => ({
  visibleText: testCase.rawOutput,
  recoverableText: testCase.rawOutput
});

/**
 * UTK arm: persist the raw output (fully recoverable) and surface only a compact,
 * schema-backed handle in chat.
 *
 * HONESTY NOTE: this is a configured model of UTK's strategy, not the shipped
 * `@utk/core` mediation pipeline — and because it declares the full raw output
 * recoverable, its fact retention is 100% BY CONSTRUCTION (required facts are
 * defined as substrings of the raw output). The comparison therefore measures the
 * price of the handle-plus-recovery strategy, not whether UTK's implementation
 * retains facts. The scorer charges each needed recovery round-trip a tool call
 * plus the tokens of the minimal recovered slice (see `scoreArmOutput`).
 */
export const utkTechnique: ArmTechnique = (testCase) => {
  const compact = toonify(testCase.rawOutput);
  const schema = schemaLabel(testCase.toolId);
  const rawTokens = estimateTokens(testCase.rawOutput);
  const compactTokens = estimateTokens(compact);
  const visibleText =
    `utk://${testCase.toolId} · schema ${schema} · ${rawTokens}→${compactTokens} tok · ` +
    `${testCase.requiredFacts.length} facts recoverable via utk_expand_context`;
  return { visibleText, recoverableText: testCase.rawOutput };
};

/** Full per-technique report for one benchmark: the primary operating point plus its sweep. */
export type TechniqueReport = {
  technique: string;
  label: string;
  armKind: ArmKind;
  session: SessionConfig;
  /** The operating point shown on the leaderboard + Pareto chart (competitor's configured aggressiveness). */
  primary: TechniqueAggregate;
  /** The full aggressiveness sweep tracing the quality-vs-reduction curve (single point for baseline/UTK). */
  sweep: TechniqueAggregate[];
  /** Three headline numbers read off the sweep, all relative to the baseline arm. */
  headlines: HeadlineNumbers;
  /** Regression-gate verdict vs baseline (null for the baseline arm itself). */
  gate: GateVerdict | null;
  /** Whether the primary point sits on the cost-vs-success Pareto frontier. */
  onFrontier: boolean;
  /** The 18-field per-case log at the primary operating point. */
  runs: RunMetrics[];
};

/** One benchmark as one table: baseline, every competitor, and UTK over the same cases. */
export type BenchmarkReport = {
  benchmark: string;
  kind: BenchmarkKind;
  title: string;
  description: string;
  cases: number;
  baseline: TechniqueReport;
  competitors: TechniqueReport[];
  utk: TechniqueReport;
  /** Technique names on the Pareto frontier (cost per task ↓, task success ↑). */
  frontier: string[];
};

export type SuiteResult = {
  /** Id of the cost/latency model the numbers were produced under. */
  model: string;
  benchmarks: BenchmarkReport[];
};

export type RunSuiteOptions = {
  competitors?: Competitor[];
  benchmarks?: Benchmark[];
  costModel?: CostModel;
  gate?: RegressionGate;
  sweep?: number[];
  /** Test override: cases per benchmark name (bypasses the dataset + real-data seam). */
  casesByBenchmark?: Record<string, BenchmarkCase[]>;
  baseSession?: SessionConfig;
  concurrency?: number;
};

/**
 * Run the whole suite: every benchmark × (baseline, each competitor swept across
 * aggressiveness, UTK), all under one cost model. Real datasets are used when the
 * adapter seam is configured; otherwise the committed synthetic analogs.
 */
export async function runSuite(options: RunSuiteOptions = {}): Promise<SuiteResult> {
  const competitors = options.competitors ?? COMPETITORS;
  const benchmarks = options.benchmarks ?? BENCHMARKS;
  const model = options.costModel ?? REFERENCE_MODEL;
  const reports = await Promise.all(benchmarks.map((benchmark) => runOneBenchmark(benchmark, competitors, model, options)));
  return { model: model.id, benchmarks: reports };
}

/** Run a single benchmark and return its report (convenience wrapper over {@link runSuite}). */
export async function runBenchmarkReport(benchmark: string, options: RunSuiteOptions = {}): Promise<BenchmarkReport> {
  const def = getBenchmark(benchmark);
  if (!def) throw new Error(`Unknown benchmark: ${benchmark}`);
  const model = options.costModel ?? REFERENCE_MODEL;
  return runOneBenchmark(def, options.competitors ?? COMPETITORS, model, options);
}

async function runOneBenchmark(benchmark: Benchmark, competitors: Competitor[], model: CostModel, options: RunSuiteOptions): Promise<BenchmarkReport> {
  const cases = options.casesByBenchmark?.[benchmark.name] ?? (await loadRealDataset(benchmark.name)) ?? (await loadBenchmark(benchmark.name));
  const base = options.baseSession ?? DEFAULT_SESSION;
  const concurrency = options.concurrency ?? 8;
  const sweep = options.sweep ?? SWEEP_THRESHOLDS;

  // Baseline first — it fixes the raw-token denominator every reduction is measured against.
  const baselineRuns = await runArm(benchmark, cases, 'baseline', baselineTechnique, model, concurrency);
  const baselineRetrieved = sum(baselineRuns.map((r) => r.retrieved_context_tokens));
  const baselineAgg = aggregateTechnique('baseline', BASELINE_LABEL, baselineRuns, baselineRetrieved);
  const baseline: TechniqueReport = {
    technique: 'baseline',
    label: BASELINE_LABEL,
    armKind: 'baseline',
    session: buildSession(base, { technique: 'baseline', benchmark: benchmark.name, armKind: 'baseline' }, []),
    primary: baselineAgg,
    sweep: [baselineAgg],
    headlines: { qualityRetentionAt50PctReduction: baselineAgg.avgQuality, costReductionAt1PctQualityLoss: 0, p95LatencyReductionAt1PctQualityLoss: 0 },
    gate: null,
    onFrontier: false,
    runs: baselineRuns
  };

  const competitorReports = await Promise.all(
    competitors.map((competitor) => runCompetitor(benchmark, cases, competitor, model, baselineAgg, baselineRetrieved, sweep, base, concurrency, options.gate))
  );

  const utkRuns = await runArm(benchmark, cases, 'utk', utkTechnique, model, concurrency);
  const utkAgg = aggregateTechnique('utk', UTK_LABEL, utkRuns, baselineRetrieved);
  const utk: TechniqueReport = {
    technique: 'utk',
    label: UTK_LABEL,
    armKind: 'utk',
    session: buildSession(base, { technique: 'utk', benchmark: benchmark.name, armKind: 'utk' }, [addSkill('utk-mediated-compaction')]),
    primary: utkAgg,
    sweep: [utkAgg],
    headlines: headlineNumbers([utkAgg], baselineAgg),
    gate: checkRegressionGate(utkAgg, baselineAgg, options.gate),
    onFrontier: false,
    runs: utkRuns
  };

  const all = [baseline, ...competitorReports, utk];
  const frontier = paretoFrontier(all.map((report) => report.primary));
  for (const report of all) report.onFrontier = frontier.has(report.technique);

  return {
    benchmark: benchmark.name,
    kind: benchmark.kind,
    title: benchmark.title,
    description: benchmark.description,
    cases: cases.length,
    baseline,
    competitors: competitorReports,
    utk,
    frontier: [...frontier]
  };
}

async function runCompetitor(
  benchmark: Benchmark,
  cases: BenchmarkCase[],
  competitor: Competitor,
  model: CostModel,
  baselineAgg: TechniqueAggregate,
  baselineRetrieved: number,
  sweep: number[],
  base: SessionConfig,
  concurrency: number,
  gate: RegressionGate | undefined
): Promise<TechniqueReport> {
  const thresholds = uniqueSorted([...sweep, competitor.keepThreshold]);
  const sweepPoints = await Promise.all(
    thresholds.map(async (threshold) => {
      const arm = makeCompetitorArm({ keepThreshold: threshold, queryAware: competitor.queryAware });
      const runs = await runArm(benchmark, cases, 'competitor', arm, model, concurrency);
      return aggregateTechnique(competitor.name, `${competitor.label} @keep=${threshold}`, runs, baselineRetrieved);
    })
  );

  // Primary operating point: the competitor's configured aggressiveness (kept with per-case runs).
  const primaryArm = makeCompetitorArm({ keepThreshold: competitor.keepThreshold, queryAware: competitor.queryAware });
  const primaryRuns = await runArm(benchmark, cases, 'competitor', primaryArm, model, concurrency);
  const primary = aggregateTechnique(competitor.name, competitor.label, primaryRuns, baselineRetrieved);

  return {
    technique: competitor.name,
    label: competitor.label,
    armKind: 'competitor',
    session: buildSession(base, { technique: competitor.name, benchmark: benchmark.name, armKind: 'competitor' }, competitor.middleware ?? []),
    primary,
    sweep: sweepPoints,
    headlines: headlineNumbers(sweepPoints, baselineAgg),
    gate: checkRegressionGate(primary, baselineAgg, gate),
    onFrontier: false,
    runs: primaryRuns
  };
}

async function runArm(benchmark: Benchmark, cases: BenchmarkCase[], armKind: ArmKind, technique: ArmTechnique, model: CostModel, concurrency: number): Promise<RunMetrics[]> {
  return mapConcurrent(cases, concurrency, async (testCase) => {
    // Isolate per-case failures (a live technique can throw) so one bad case does
    // not abort the arm — record it as a zero-quality, full-context failed run.
    try {
      const output = await technique(testCase);
      const { context, outcome } = scoreArmOutput(benchmark, testCase, armKind, output);
      return computeRunMetrics(context, outcome, model);
    } catch {
      const raw = estimateTokens(testCase.rawOutput);
      const failed = scoreArmOutput(benchmark, testCase, armKind, { visibleText: testCase.rawOutput, recoverableText: '' });
      return computeRunMetrics({ ...failed.context, retrievedContextTokens: raw }, { ...failed.outcome, taskSuccess: 0, qualityScore: 0, faithfulnessScore: 0, failureCategory: 'error' }, model);
    }
  });
}

/** Fold an arm's middleware over a fresh copy of the base session (records tools/skills/model). */
function buildSession(base: SessionConfig, meta: SessionMeta, middleware: Middleware[]): SessionConfig {
  return middleware.reduce((config, mw) => mw(config, meta), { tools: [...base.tools], skills: [...base.skills], model: base.model });
}

/** Bounded-concurrency map used to fan cases out within an arm (the seam for a live async target). */
export async function mapConcurrent<T, U>(items: readonly T[], limit: number, run: (item: T, index: number) => Promise<U>): Promise<U[]> {
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

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
