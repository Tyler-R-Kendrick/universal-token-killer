import type { BenchmarkProvenance } from './data.js';
import type { BenchmarkReport, SuiteResult, TechniqueReport } from './harness.js';
import type { GateVerdict, HeadlineNumbers, TechniqueAggregate } from './metrics.js';

const DEFAULT_DISCLAIMER =
  'Self-authored deterministic self-comparison. Competitor arms are configured models of each ' +
  "technique run against the same benchmark data, not the vendors' live systems. Token counts and " +
  'fact retention are real (a coarse `ceil(len/4)` token estimate); cost and latency are MODELED from ' +
  'those token counts by a deterministic reference cost model, not measured against a live endpoint. ' +
  'Swap the cost model (or point the real-dataset seam at a licensed export) to reproduce against a real target.';

/** The 18 per-run fields logged for every case, surfaced once in the methodology. */
const METRIC_FIELDS = [
  'input_tokens', 'output_tokens', 'tool_schema_tokens', 'retrieved_context_tokens', 'compressed_context_tokens',
  'compression_latency_ms', 'model_latency_ms', 'tool_latency_ms', 'total_latency_ms', 'model_cost', 'tool_cost',
  'retry_count', 'fallback_count', 'invalid_tool_call_count', 'task_success', 'quality_score', 'faithfulness_score', 'failure_category'
];

/* ---- formatting -------------------------------------------------------- */

function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function signedPct(value: number, digits = 1): string {
  if (value === 0) return '0%';
  const sign = value > 0 ? '+' : '−';
  return `${sign}${(Math.abs(value) * 100).toFixed(digits)}%`;
}

function usd(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  return `$${value.toFixed(5)}`;
}

function ms(value: number): string {
  return `${Math.round(value)} ms`;
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|');
}

/* ---- per-benchmark tables --------------------------------------------- */

function orderedTechniques(report: BenchmarkReport): TechniqueReport[] {
  return [report.baseline, ...report.competitors, report.utk];
}

/** Leaderboard: one row per technique at its primary operating point. */
export function renderLeaderboard(report: BenchmarkReport): string[] {
  const rows = orderedTechniques(report)
    .slice()
    .sort((a, b) => b.primary.visibleTokens - a.primary.visibleTokens)
    .map((tech) => {
      const p = tech.primary;
      return `| ${escapeCell(tech.label)}${tech.onFrontier ? ' ★' : ''} | ${p.visibleTokens} | ${signedTokenChange(p.tokenReduction)} | ${pct(p.taskSuccessRate)} | ${p.avgQuality.toFixed(2)} | ${usd(p.costPerTask)} | ${ms(p.p95LatencyMs)} |`;
    });
  return [
    '| Technique | Visible tokens | Token reduction | Task success | Avg quality | Cost/task | P95 latency |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows
  ];
}

function signedTokenChange(reduction: number): string {
  if (reduction === 0) return '0%';
  // Token reduction is a cut, shown as a negative change in visible tokens.
  return `−${(reduction * 100).toFixed(0)}%`;
}

/** The three headline numbers, one row per non-baseline technique. */
export function renderHeadlines(report: BenchmarkReport): string[] {
  const techniques = [...report.competitors, report.utk];
  const rows = techniques.map((tech) => {
    const h: HeadlineNumbers = tech.headlines;
    return `| ${escapeCell(tech.label)} | ${pct(h.qualityRetentionAt50PctReduction)} | ${signedPct(h.costReductionAt1PctQualityLoss)} | ${signedPct(h.p95LatencyReductionAt1PctQualityLoss)} |`;
  });
  return [
    '| Technique | Quality retention @ 50% token reduction | Cost reduction @ ≤1% quality loss | P95 latency reduction @ ≤1% quality loss |',
    '| --- | ---: | ---: | ---: |',
    ...rows
  ];
}

/** Regression-gate verdicts vs baseline, one row per non-baseline technique. */
export function renderGates(report: BenchmarkReport): string[] {
  const techniques = [...report.competitors, report.utk];
  const rows = techniques.map((tech) => {
    const g: GateVerdict | null = tech.gate;
    if (!g) return `| ${escapeCell(tech.label)} | — | — | — | — | — |`;
    const verdict = g.passed ? '✅ pass' : '❌ fail';
    const notes = g.passed ? 'within gates' : g.reasons.join('; ');
    return `| ${escapeCell(tech.label)} | ${verdict} | ${signedPct(g.taskSuccessDelta)} | ${usd(g.costPerSuccessDelta)} | ${g.unsafeToolDelta > 0 ? `+${g.unsafeToolDelta}` : g.unsafeToolDelta} | ${escapeCell(notes)} |`;
  });
  return [
    '| Technique | Gate | Δ task success | Δ cost/success | Δ unsafe-tool errors | Notes |',
    '| --- | :---: | ---: | ---: | ---: | --- |',
    ...rows
  ];
}

function renderRelatedBenchmarks(provenance: BenchmarkProvenance): string[] {
  return [
    '**Related public benchmarks** (task-category analogs, not data sources or scores):',
    '',
    ...provenance.related_benchmarks.map((bench) => `- [${bench.name}](${bench.url})${bench.org ? ` — ${bench.org}` : ''}: ${bench.note ?? bench.relation}`)
  ];
}

/** One benchmark's full section: leaderboard, headline numbers, gates, Pareto chart, provenance. */
export function renderBenchmarkSection(report: BenchmarkReport, provenance: BenchmarkProvenance | null, chartHref: string): string[] {
  const frontier = report.frontier.map((t) => shortTechnique(report, t)).filter(Boolean);
  const lines = [
    `## ${report.title}`,
    '',
    report.description,
    '',
    `Cases: ${report.cases} · cost model: modeled · Pareto frontier: ${frontier.length ? frontier.join(', ') : '—'}.`,
    '',
    '### Leaderboard',
    '',
    'Primary operating point per technique. ★ marks the cost-vs-success Pareto frontier — the real winners for this workload, not simply whoever cuts the most tokens.',
    '',
    ...renderLeaderboard(report),
    '',
    '### Headline numbers',
    '',
    ...renderHeadlines(report),
    '',
    '### Regression gates',
    '',
    'Gates: ≤2% absolute task-success loss, no increase in unsafe/mutating tool errors, and a positive cost-per-success improvement vs baseline.',
    '',
    ...renderGates(report),
    '',
    '### Cost vs. task success (Pareto)',
    '',
    `![Pareto chart: ${escapeCell(report.title)} cost per task vs task success, bubble size p95 latency](${chartHref})`,
    ''
  ];
  if (provenance) lines.push(...renderRelatedBenchmarks(provenance), '');
  return lines;
}

/* ---- cross-benchmark summary ------------------------------------------ */

function shortTechnique(_report: BenchmarkReport, technique: string): string {
  if (technique === 'baseline') return 'baseline';
  if (technique === 'utk') return 'UTK';
  return technique;
}

/** Cross-benchmark matrix: token reduction per technique × benchmark (★ = on that benchmark's frontier). */
export function renderCrossBenchmark(suite: SuiteResult): string[] {
  const benchmarks = suite.benchmarks;
  const techniqueOrder = benchmarks[0] ? orderedTechniques(benchmarks[0]).map((t) => ({ technique: t.technique, label: t.label })) : [];
  const header = `| Technique | ${benchmarks.map((b) => escapeCell(b.title)).join(' | ')} |`;
  const divider = `| --- | ${benchmarks.map(() => '---:').join(' | ')} |`;
  const rows = techniqueOrder.map(({ technique, label }) => {
    const cells = benchmarks.map((b) => {
      const tech = orderedTechniques(b).find((t) => t.technique === technique);
      if (!tech) return '—';
      const star = tech.onFrontier ? ' ★' : '';
      return `${signedTokenChange(tech.primary.tokenReduction)} / ${pct(tech.primary.taskSuccessRate, 0)}${star}`;
    });
    return `| ${escapeCell(label)} | ${cells.join(' | ')} |`;
  });
  return [header, divider, ...rows];
}

/* ---- top-level suite document ----------------------------------------- */

export type SuiteDocOptions = {
  /** Provenance per benchmark name (for disclaimer + related benchmarks). */
  provenance: Record<string, BenchmarkProvenance | null>;
  /** Relative href to each benchmark's Pareto SVG, by benchmark name. */
  charts: Record<string, string>;
  timestamp?: string;
};

function frontmatter(timestamp: string | undefined): string[] {
  return [
    '---',
    'type: benchmark',
    'title: UTK Comparison Benchmarks',
    'description: "Multi-benchmark leaderboard (compression, needle-in-a-haystack, tool selection, agent workflows) comparing UTK, baseline, and competitor compaction techniques on tokens, quality, modeled cost, and modeled latency."',
    'tags: [evals, benchmark, leaderboard, utk]',
    ...(timestamp ? [`timestamp: ${timestamp}`] : []),
    '---',
    ''
  ];
}

/** Render the whole suite as one leaderboard-first results document. */
export function renderSuiteMarkdown(suite: SuiteResult, options: SuiteDocOptions): string {
  const lines: string[] = [
    ...frontmatter(options.timestamp),
    '# UTK comparison benchmarks',
    '',
    `Each benchmark is one table: **baseline** (raw context), every **competitor**, and **UTK** (raw persisted off-context, recoverable handle in chat) over the same cases. Techniques are swept across aggressiveness to trace a quality-vs-reduction curve; the leaderboard shows each one's primary operating point.`,
    '',
    // Suite-level disclaimer (the modeled-cost caveat); per-benchmark provenance carries its own.
    `> ${DEFAULT_DISCLAIMER}`,
    '',
    '## Reading the leaderboard',
    '',
    "Cutting the most tokens does not make a technique best. The winner is a technique on the **Pareto frontier** of cost per task vs. task success for your workload. Three headline numbers per technique keep the axes separate: quality retention at a fixed token reduction, cost reduction at fixed quality, and p95 latency reduction at fixed quality.",
    '',
    '## Cross-benchmark summary',
    '',
    'Each cell is `token reduction / task success` at the primary operating point; ★ marks a technique on that benchmark\'s cost-vs-success Pareto frontier.',
    '',
    ...renderCrossBenchmark(suite),
    ''
  ];

  for (const report of suite.benchmarks) {
    lines.push(...renderBenchmarkSection(report, options.provenance[report.benchmark] ?? null, options.charts[report.benchmark] ?? '#'));
  }

  lines.push(
    '## Methodology',
    '',
    `Cost model: \`${suite.model}\` (modeled, deterministic). Token counts and fact retention are real; cost and latency are derived from token counts and modeled tool round-trips, not measured on a live endpoint.`,
    '',
    'Every run logs these 18 fields (full per-case logs in `packages/evals/results/<benchmark>.json`):',
    '',
    '`' + METRIC_FIELDS.join('`, `') + '`',
    '',
    'Generated by `npm run evals --workspace @utk/evals`.'
  );
  return `${lines.join('\n')}\n`;
}
