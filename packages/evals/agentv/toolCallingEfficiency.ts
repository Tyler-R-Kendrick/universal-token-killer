import { readFile } from 'node:fs/promises';
import { estimateTokens } from '@utk/foundation';
import { filterToolDefinitionsForIntent, mediateToolExecution } from '@utk/core';
import { completeStructuredToolInvocation, type StructuredToolDefinition } from '@utk/tool-invocation';

/**
 * Tool-calling token-efficiency benchmark engine.
 *
 * Unlike the modeled comparison suite (`../harness.ts`), every surface measured
 * here is produced by REAL shipped UTK code paths:
 *
 * - tool selection    → `filterToolDefinitionsForIntent` (deferred-search discovery)
 * - invocation input  → `completeStructuredToolInvocation` (guidance-ts grammar,
 *                       template persistence under `.utk/tools/…/templates/`, and
 *                       the memoized planner cache under `.utk/cache/…`)
 * - tool output       → `mediateToolExecution` (schema routing + compact handle)
 *
 * The episode runs the same request N times against ONE persistent workspace,
 * so run 1 pays the real schema/template/grammar generation cost and later runs
 * exercise the real cache (`cache.hit` comes from the memoization layer, not a
 * simulation). Token numbers are `ceil(len/4)` estimates of the actual artifact
 * text — no LLM is invoked in this offline mode; wire a live target through
 * `.agentv/targets.yaml` to measure real provider `token_usage` instead.
 *
 * Honest-accounting rules carried over from the audit: the UTK arm's output
 * phase charges the recovery slice (the raw-output lines containing required
 * facts) whenever the facts are not visible on the mediated surface.
 */

export type ToolCallingToolDef = {
  name: string;
  description: string;
  /** Parameter name → completions/required metadata (drives grammar + planner). */
  parameters: Record<string, { description?: string; completions?: string[]; required?: boolean }>;
};

export type ToolCallingCase = {
  name: string;
  category: string;
  /** The user intent that should select and invoke `targetTool`. */
  request: string;
  tools: ToolCallingToolDef[];
  targetTool: string;
  /** Deterministic mock output the target tool produces when executed. */
  toolOutput: string;
  /** Verbatim substrings of `toolOutput` the task depends on. */
  requiredFacts: string[];
};

export type ToolCallingArm = 'baseline' | 'utk';

export type ToolCallingRunReport = {
  run: number;
  /** Tokens of the tool-catalog surface the model reads to select a tool. */
  selection_tokens: number;
  /** Tokens consumed+emitted to produce the tool invocation. */
  invocation_tokens: number;
  /** One-time schema/grammar/template generation overhead charged this run. */
  schema_generation_tokens: number;
  /** Tokens of the tool output surface entering the model context. */
  output_tokens: number;
  /** Recovery-slice tokens charged when facts are recoverable but not visible. */
  recovery_tokens: number;
  total_tokens: number;
  /** True when the invocation planner was served from the real UTK cache. */
  cache_hit: boolean;
};

export type ToolCallingEpisodeReport = {
  benchmark: 'tool-calling-efficiency';
  arm: ToolCallingArm;
  case: string;
  runs: ToolCallingRunReport[];
  run1_total: number;
  /** Mean total of runs 2..n (steady state); equals run1_total when n = 1. */
  steady_state_avg_total: number;
  avg_total: number;
  /** Model documentation: nothing here invokes an LLM. */
  model: 'none (offline deterministic surfaces; ceil(len/4) token estimate)';
};

export function parseToolCallingCase(text: string): ToolCallingCase {
  const parsed = JSON.parse(text) as ToolCallingCase;
  for (const key of ['name', 'category', 'request', 'targetTool', 'toolOutput'] as const) {
    if (typeof parsed[key] !== 'string') throw new Error(`tool-calling case missing string field "${key}"`);
  }
  if (!Array.isArray(parsed.tools) || parsed.tools.length === 0) throw new Error('tool-calling case needs a non-empty tools array');
  if (!Array.isArray(parsed.requiredFacts)) throw new Error('tool-calling case needs requiredFacts');
  for (const fact of parsed.requiredFacts) {
    if (!parsed.toolOutput.includes(fact)) throw new Error(`required fact is not a verbatim substring of toolOutput: ${fact}`);
  }
  if (!parsed.tools.some((tool) => tool.name === parsed.targetTool)) throw new Error(`targetTool ${parsed.targetTool} is not in the catalog`);
  return parsed;
}

export async function loadToolCallingCases(filePath: string): Promise<ToolCallingCase[]> {
  const jsonl = await readFile(filePath, 'utf8');
  return jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseToolCallingCase(line));
}

/** OpenAI-style function definitions — the surface a model reads during selection. */
function toOpenAiToolDefs(tools: ToolCallingToolDef[]): Array<Record<string, unknown>> {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([name, spec]) => [name, { type: 'string', ...(spec.description ? { description: spec.description } : {}) }])
        ),
        required: Object.entries(tool.parameters).filter(([, spec]) => spec.required).map(([name]) => name)
      }
    }
  }));
}

function toStructuredDefinition(tool: ToolCallingToolDef): StructuredToolDefinition {
  return {
    toolId: tool.name,
    description: tool.description,
    outputCache: true,
    parameters: Object.entries(tool.parameters).map(([name, spec]) => ({
      name,
      ...(spec.description ? { description: spec.description } : {}),
      ...(spec.completions ? { completions: spec.completions } : {}),
      ...(spec.required ? { required: true } : {})
    }))
  };
}

/** Deduplicated raw-output lines containing each required fact — the minimal recovery payload. */
export function recoverySliceTokens(toolOutput: string, requiredFacts: string[], visibleSurface: string): number {
  const missing = requiredFacts.filter((fact) => !visibleSurface.includes(fact));
  if (missing.length === 0) return 0;
  const lines = toolOutput.split('\n');
  const slice = new Set<string>();
  for (const fact of missing) {
    const match = lines.find((line) => line.includes(fact));
    slice.add(match ?? fact);
  }
  return estimateTokens([...slice].join('\n'));
}

/**
 * Run one N-run episode for one arm against a persistent workspace.
 * The workspace MUST be reused across all runs of the episode so the real
 * `.utk/` cache and template artifacts carry over between runs.
 */
export async function runToolCallingEpisode(params: {
  workspaceRoot: string;
  testCase: ToolCallingCase;
  arm: ToolCallingArm;
  runs: number;
}): Promise<ToolCallingEpisodeReport> {
  const { workspaceRoot, testCase, arm } = params;
  if (!Number.isFinite(params.runs)) throw new Error(`runs must be a finite number, got ${params.runs}`);
  const runCount = Math.max(1, Math.floor(params.runs));
  const openAiDefs = toOpenAiToolDefs(testCase.tools);
  const fullCatalogTokens = estimateTokens(JSON.stringify(openAiDefs));
  const structuredTools = testCase.tools.map(toStructuredDefinition);
  const runs: ToolCallingRunReport[] = [];

  for (let run = 1; run <= runCount; run += 1) {
    if (arm === 'baseline') {
      runs.push(await runBaselineOnce(run, testCase, fullCatalogTokens));
    } else {
      runs.push(await runUtkOnce(run, testCase, workspaceRoot, openAiDefs, structuredTools));
    }
  }

  const totals = runs.map((r) => r.total_tokens);
  const steady = totals.length > 1 ? totals.slice(1) : totals;
  return {
    benchmark: 'tool-calling-efficiency',
    arm,
    case: testCase.name,
    runs,
    run1_total: totals[0] ?? 0,
    steady_state_avg_total: round(mean(steady)),
    avg_total: round(mean(totals)),
    model: 'none (offline deterministic surfaces; ceil(len/4) token estimate)'
  };
}

async function runBaselineOnce(run: number, testCase: ToolCallingCase, fullCatalogTokens: number): Promise<ToolCallingRunReport> {
  // Baseline: the model reads the full catalog every run, emits verbose JSON
  // args, and the raw tool output enters context unmediated. Stateless — the
  // baseline has no cache, so every run costs the same.
  const target = testCase.tools.find((tool) => tool.name === testCase.targetTool)!;
  const args = Object.fromEntries(
    Object.entries(target.parameters).map(([name, spec]) => [name, spec.completions?.[0] ?? ''])
  );
  const invocationSurface = JSON.stringify({ type: 'tool_call', name: target.name, arguments: args }, null, 2);
  const selection = fullCatalogTokens;
  const invocation = estimateTokens(invocationSurface);
  const output = estimateTokens(testCase.toolOutput);
  return {
    run,
    selection_tokens: selection,
    invocation_tokens: invocation,
    schema_generation_tokens: 0,
    output_tokens: output,
    recovery_tokens: 0,
    total_tokens: selection + invocation + output,
    cache_hit: false
  };
}

async function runUtkOnce(
  run: number,
  testCase: ToolCallingCase,
  workspaceRoot: string,
  openAiDefs: Array<Record<string, unknown>>,
  structuredTools: StructuredToolDefinition[]
): Promise<ToolCallingRunReport> {
  // Phase 1 — selection: real deferred-search discovery filters the catalog.
  const discovery = filterToolDefinitionsForIntent(openAiDefs, {
    intent: testCase.request,
    mode: 'deferred-search',
    requiredToolNames: [testCase.targetTool]
  });
  const selection = discovery.afterTokens;

  // Phase 2 — invocation: real grammar-grounded planning with the real
  // memoized cache. Run 1 generates + persists the template and guidance
  // grammar (schema-generation overhead); later runs hit the cache.
  const completion = await completeStructuredToolInvocation({
    workspaceRoot,
    request: testCase.request,
    tools: structuredTools
  });
  const templateText = await readFile(completion.templatePath, 'utf8');
  const invocation = estimateTokens(templateText);
  const schemaGeneration = completion.cache.hit
    ? 0
    : estimateTokens(JSON.stringify(completion.guidance.serializedGrammar ?? ''));

  // Phase 3 — output: real mediation compacts the tool output to a handle;
  // facts not visible on the handle charge the recovery slice.
  const mediated = await mediateToolExecution({
    workspaceRoot,
    toolId: testCase.targetTool,
    input: completion.invocation.args,
    execute: async () => testCase.toolOutput
  });
  const output = estimateTokens(mediated.response);
  const recovery = recoverySliceTokens(testCase.toolOutput, testCase.requiredFacts, mediated.response);

  return {
    run,
    selection_tokens: selection,
    invocation_tokens: invocation,
    schema_generation_tokens: schemaGeneration,
    output_tokens: output,
    recovery_tokens: recovery,
    total_tokens: selection + invocation + schemaGeneration + output + recovery,
    cache_hit: completion.cache.hit
  };
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
