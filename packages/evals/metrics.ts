import type { CostModel } from './model.js';

/** The full per-run log for one case under one technique (19 fields). */
export type RunMetrics = {
  input_tokens: number;
  output_tokens: number;
  tool_schema_tokens: number;
  retrieved_context_tokens: number;
  compressed_context_tokens: number;
  /** Tokens the recovery round-trip re-injects into context (0 when no recovery happens). */
  recovered_context_tokens: number;
  compression_latency_ms: number;
  model_latency_ms: number;
  tool_latency_ms: number;
  total_latency_ms: number;
  model_cost: number;
  tool_cost: number;
  retry_count: number;
  fallback_count: number;
  invalid_tool_call_count: number;
  task_success: number; // 0 | 1
  quality_score: number; // 0..1
  faithfulness_score: number; // 0..1
  failure_category: string; // 'none' | 'fact-loss' | 'noise-retained' | 'wrong-tool' | 'unsafe-tool'
};

/** Token counts + technique flags feeding the cost/latency model. */
export type RunContext = {
  retrievedContextTokens: number;
  compressedContextTokens: number;
  promptTokens: number;
  outputTokens: number;
  toolSchemaTokens: number;
  /**
   * Tokens a recovery round-trip returns into the model context. A technique
   * whose correctness depends on recovering off-context facts must pay for the
   * payload the recovery call brings back, not just a flat tool-call fee —
   * otherwise its token-reduction numbers are inflated.
   */
  recoveredContextTokens: number;
  /** Technique runs a compaction pass over the retrieved context (adds compression latency). */
  compresses: boolean;
};

/** Grading-derived outcome for one run (quality gates + reliability events). */
export type RunOutcome = {
  taskSuccess: number;
  qualityScore: number;
  faithfulnessScore: number;
  failureCategory: string;
  /** On-purpose recovery round-trips (e.g. UTK `utk_expand_context`). */
  recoveryToolCalls: number;
  fallbackCount: number;
  retryCount: number;
  invalidToolCallCount: number;
};

/** Assemble a {@link RunMetrics} record from token context + outcome + the cost model. */
export function computeRunMetrics(ctx: RunContext, outcome: RunOutcome, model: CostModel): RunMetrics {
  const inputTokens = ctx.promptTokens + ctx.compressedContextTokens + ctx.toolSchemaTokens + ctx.recoveredContextTokens;
  const toolCalls = outcome.recoveryToolCalls + outcome.fallbackCount + outcome.retryCount;

  const compressionLatency = ctx.compresses ? round(ctx.retrievedContextTokens * model.compressMsPerToken) : 0;
  const modelLatency = round(model.baseModelMs + inputTokens * model.prefillMsPerToken + ctx.outputTokens * model.decodeMsPerToken);
  const toolLatency = round(toolCalls * model.toolCallMs);

  const modelCost = round6(inputTokens * model.priceInPerToken + ctx.outputTokens * model.priceOutPerToken);
  const toolCost = round6(toolCalls * model.toolCallCostUsd);

  return {
    input_tokens: inputTokens,
    output_tokens: ctx.outputTokens,
    tool_schema_tokens: ctx.toolSchemaTokens,
    retrieved_context_tokens: ctx.retrievedContextTokens,
    compressed_context_tokens: ctx.compressedContextTokens,
    recovered_context_tokens: ctx.recoveredContextTokens,
    compression_latency_ms: compressionLatency,
    model_latency_ms: modelLatency,
    tool_latency_ms: toolLatency,
    total_latency_ms: round(compressionLatency + modelLatency + toolLatency),
    model_cost: modelCost,
    tool_cost: toolCost,
    retry_count: outcome.retryCount,
    fallback_count: outcome.fallbackCount,
    invalid_tool_call_count: outcome.invalidToolCallCount,
    task_success: outcome.taskSuccess,
    quality_score: round(outcome.qualityScore),
    faithfulness_score: round(outcome.faithfulnessScore),
    failure_category: outcome.failureCategory
  };
}

/** Per-technique roll-up over all cases of a benchmark (one operating point). */
export type TechniqueAggregate = {
  technique: string;
  label: string;
  cases: number;
  taskSuccessRate: number;
  avgQuality: number;
  avgFaithfulness: number;
  visibleTokens: number;
  retrievedTokens: number;
  tokenReduction: number; // vs baseline retrieved tokens, 0..1
  costPerTask: number;
  costPerSuccess: number;
  p95LatencyMs: number;
  avgLatencyMs: number;
  unsafeToolErrors: number;
  invalidToolCalls: number;
};

export function aggregateTechnique(technique: string, label: string, runs: RunMetrics[], baselineRetrievedTokens: number): TechniqueAggregate {
  const cases = runs.length || 1;
  const successes = runs.filter((r) => r.task_success === 1).length;
  const totalCost = sum(runs.map((r) => r.model_cost + r.tool_cost));
  // Model-visible input surface = compacted context + tool-schema tokens (disjoint
  // buckets; a benchmark charges the payload to whichever one applies) PLUS any
  // tokens a recovery round-trip re-injects — recovered payloads enter the model
  // context just like compacted context does, so token reduction must count them.
  const visibleTokens = sum(runs.map((r) => r.compressed_context_tokens + r.tool_schema_tokens + r.recovered_context_tokens));
  const retrievedTokens = sum(runs.map((r) => r.retrieved_context_tokens));
  return {
    technique,
    label,
    cases: runs.length,
    taskSuccessRate: round(successes / cases),
    avgQuality: round(average(runs.map((r) => r.quality_score))),
    avgFaithfulness: round(average(runs.map((r) => r.faithfulness_score))),
    visibleTokens,
    retrievedTokens,
    tokenReduction: baselineRetrievedTokens === 0 ? 0 : round(1 - visibleTokens / baselineRetrievedTokens),
    costPerTask: round6(totalCost / cases),
    costPerSuccess: successes === 0 ? Infinity : round6(totalCost / successes),
    p95LatencyMs: percentile(runs.map((r) => r.total_latency_ms), 95),
    avgLatencyMs: round(average(runs.map((r) => r.total_latency_ms))),
    unsafeToolErrors: sum(runs.map((r) => (r.failure_category === 'unsafe-tool' ? 1 : 0))),
    invalidToolCalls: sum(runs.map((r) => r.invalid_tool_call_count))
  };
}

/** One point on a technique's aggressiveness sweep. */
export type SweepPoint = TechniqueAggregate;

/** The three headline numbers, all relative to the baseline arm. */
export type HeadlineNumbers = {
  /** Quality retained at the sweep point closest to 50% token reduction. */
  qualityRetentionAt50PctReduction: number;
  /** Max cost reduction (vs baseline) among sweep points within 1% quality of baseline. */
  costReductionAt1PctQualityLoss: number;
  /** P95 latency reduction (vs baseline) at that same operating point. */
  p95LatencyReductionAt1PctQualityLoss: number;
};

export function headlineNumbers(sweep: SweepPoint[], baseline: TechniqueAggregate): HeadlineNumbers {
  const baseQuality = baseline.avgQuality || 1;
  const baseCostPerTask = baseline.costPerTask || 0;
  const baseP95 = baseline.p95LatencyMs || 0;

  // Quality @ 50% token reduction: nearest sweep point by reduction.
  const at50 = sweep.length
    ? sweep.reduce((best, p) => (Math.abs(p.tokenReduction - 0.5) < Math.abs(best.tokenReduction - 0.5) ? p : best))
    : undefined;

  // Points that keep quality within 1% of baseline.
  const withinBudget = sweep.filter((p) => p.avgQuality >= baseQuality * 0.99);
  // Prefer the operating point with the greatest cost reduction.
  const best = withinBudget.reduce<SweepPoint | undefined>(
    (b, p) => (b === undefined || p.costPerTask < b.costPerTask ? p : b),
    undefined
  );

  return {
    qualityRetentionAt50PctReduction: at50 ? round(at50.avgQuality) : 0,
    costReductionAt1PctQualityLoss: best && baseCostPerTask > 0 ? round(1 - best.costPerTask / baseCostPerTask) : 0,
    p95LatencyReductionAt1PctQualityLoss: best && baseP95 > 0 ? round(1 - best.p95LatencyMs / baseP95) : 0
  };
}

/** Regression gates (defaults per the user's spec). */
export type RegressionGate = {
  maxTaskSuccessLoss?: number; // absolute, default 0.02 (2%)
  requirePositiveCostPerSuccess?: boolean; // default true
  noUnsafeToolIncrease?: boolean; // default true
};

export type GateVerdict = {
  passed: boolean;
  taskSuccessDelta: number;
  costPerSuccessDelta: number;
  unsafeToolDelta: number;
  reasons: string[];
};

export function checkRegressionGate(technique: TechniqueAggregate, baseline: TechniqueAggregate, gate: RegressionGate = {}): GateVerdict {
  const maxLoss = gate.maxTaskSuccessLoss ?? 0.02;
  const taskSuccessDelta = round(technique.taskSuccessRate - baseline.taskSuccessRate);
  const costPerSuccessDelta = round6((baseline.costPerSuccess === Infinity ? 0 : baseline.costPerSuccess) - (technique.costPerSuccess === Infinity ? Infinity : technique.costPerSuccess));
  const unsafeToolDelta = technique.unsafeToolErrors - baseline.unsafeToolErrors;
  const reasons: string[] = [];
  if (taskSuccessDelta < -maxLoss) reasons.push(`task success dropped ${Math.abs(taskSuccessDelta * 100).toFixed(1)}% (> ${maxLoss * 100}%)`);
  if ((gate.noUnsafeToolIncrease ?? true) && unsafeToolDelta > 0) reasons.push(`+${unsafeToolDelta} unsafe/mutating tool errors`);
  if ((gate.requirePositiveCostPerSuccess ?? true) && technique.costPerSuccess >= baseline.costPerSuccess) reasons.push('no cost-per-success improvement');
  return { passed: reasons.length === 0, taskSuccessDelta, costPerSuccessDelta, unsafeToolDelta, reasons };
}

/** Pareto frontier: techniques not dominated on (cost per task ↓, task success ↑). */
export function paretoFrontier(points: TechniqueAggregate[]): Set<string> {
  const frontier = new Set<string>();
  for (const p of points) {
    const dominated = points.some((q) => q.technique !== p.technique && q.costPerTask <= p.costPerTask && q.taskSuccessRate >= p.taskSuccessRate && (q.costPerTask < p.costPerTask || q.taskSuccessRate > p.taskSuccessRate));
    if (!dominated) frontier.add(p.technique);
  }
  return frontier;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return round(sorted[low]!);
  return round(sorted[low]! + (rank - low) * (sorted[high]! - sorted[low]!));
}

function sum(values: number[]): number {
  return values.reduce((t, v) => t + v, 0);
}
function average(values: number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}
function round(value: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
