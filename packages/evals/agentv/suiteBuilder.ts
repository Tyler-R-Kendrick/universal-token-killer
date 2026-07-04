import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineEval, type EvalDefinition } from '@agentv/sdk';

/**
 * Shared builder for the AgentV SDK eval suites (https://agentv.dev/docs/evaluation/sdk/).
 *
 * Each `<benchmark>.eval.ts` file in this directory lowers to the canonical
 * AgentV eval contract: tests come from the committed `data/<benchmark>.jsonl`
 * cases, provenance metadata follows the benchmark-provenance guide
 * (informational `metadata`, operational fields stay operational), and grading
 * uses the custom SDK assertions under `.agentv/assertions/`.
 *
 * Targets are configured in `.agentv/targets.yaml`; run a matrix and compare:
 *   npx agentv eval packages/evals/evals --target arm-baseline --target arm-utk -o .agentv/results/latest
 *   npx agentv compare .agentv/results/latest --baseline arm-baseline --candidate arm-utk
 */

type ProvenanceManifest = {
  name: string;
  version: string;
  license: string;
  tags: string[];
  origin: string;
  authored_by: string;
  description: string;
  disclaimer: string;
  related_benchmarks: Array<{ id: string; name: string; url: string }>;
  category_benchmark: Record<string, string>;
};

type JsonlCase = {
  name: string;
  category: string;
  toolId: string;
  prompt: string;
  rawOutput: string;
  requiredFacts: string[];
  irrelevantFacts: string[];
  unsafeTools?: string[];
};

/** Resolve the @utk/evals package root from either `evals/` (source) or `dist/evals/` (compiled). */
export function packageRootFrom(evalFileUrl: string): string {
  let dir = path.dirname(fileURLToPath(evalFileUrl));
  for (let hops = 0; hops < 4; hops += 1) {
    if (existsSync(path.join(dir, 'data')) && existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`Could not locate @utk/evals package root from ${evalFileUrl}`);
}

export function loadCases(root: string, benchmark: string): JsonlCase[] {
  const jsonl = readFileSync(path.join(root, 'data', `${benchmark}.jsonl`), 'utf8');
  return jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as JsonlCase);
}

export function loadProvenanceManifest(root: string, benchmark: string): ProvenanceManifest {
  return JSON.parse(readFileSync(path.join(root, 'data', `${benchmark}.provenance.json`), 'utf8')) as ProvenanceManifest;
}

/**
 * Build one comparison-arm suite. The suite is target-agnostic: the arm under
 * test is selected with `--target arm-<name>` (see `.agentv/targets.yaml`), so
 * the same tests grade every arm and `agentv compare` computes honest deltas.
 */
export function buildArmSuite(options: { benchmark: string; evalFileUrl: string }): ReturnType<typeof defineEval> {
  const root = packageRootFrom(options.evalFileUrl);
  return buildArmSuiteFromRoot(root, options.benchmark);
}

/** Same as {@link buildArmSuite} for callers that already know the package root (e.g. the YAML generator). */
export function buildArmSuiteFromRoot(root: string, benchmark: string): ReturnType<typeof defineEval> {
  const cases = loadCases(root, benchmark);
  const provenance = loadProvenanceManifest(root, benchmark);

  const definition: EvalDefinition = {
    name: `utk-${benchmark}`,
    description:
      `${provenance.description} Deterministic self-comparison: no LLM is invoked by the offline arm targets; ` +
      'see docs/features/evals/benchmark-integrity.md for what is and is not measured.',
    version: provenance.version,
    license: provenance.license,
    tags: [...provenance.tags, 'agentv-sdk'],
    // Neutral default; select arms per run with --target (matrix) instead.
    target: 'arm-utk',
    // Comparison suites score arms on a continuous scale — regression gating
    // happens in `agentv compare` deltas, not a per-arm pass threshold.
    execution: { threshold: 0 },
    assertions: [
      // Weighted mean over the custom SDK assertions (.agentv/assertions/):
      // dropping a required fact is a correctness failure and weighs double.
      { type: 'fact-retention', name: 'fact_retention', weight: 2 },
      { type: 'noise-exclusion', name: 'noise_exclusion', weight: 1 },
      { type: 'token-reduction', name: 'token_reduction', weight: 1 },
      ...(benchmark === 'tool-selection'
        ? [{ type: 'unsafe-tool-exposure', name: 'unsafe_tool_exposure', weight: 1 }]
        : [])
    ],
    tests: cases.map((testCase) => ({
      id: testCase.name,
      criteria: testCase.prompt,
      // The target (an arm CLI) receives the full case as JSON and returns an
      // ArmSurfaceReport JSON; assertions grade that surface.
      input: JSON.stringify(testCase),
      metadata: {
        category: testCase.category,
        tool_id: testCase.toolId,
        required_facts: testCase.requiredFacts,
        irrelevant_facts: testCase.irrelevantFacts,
        ...(testCase.unsafeTools ? { unsafe_tools: testCase.unsafeTools } : {}),
        // Provenance (informational, per the benchmark-provenance guide).
        origin: provenance.origin,
        authored_by: provenance.authored_by,
        disclaimer: provenance.disclaimer,
        ...(provenance.category_benchmark[testCase.category]
          ? { related_benchmark: provenance.category_benchmark[testCase.category] }
          : {})
      }
    }))
  };
  return defineEval(definition);
}

type ToolCallingJsonlCase = {
  name: string;
  category: string;
  request: string;
  tools: unknown[];
  targetTool: string;
  toolOutput: string;
  requiredFacts: string[];
};

/**
 * Build the N-run tool-calling token-efficiency suite (real UTK code paths;
 * see ../agentv/toolCallingEfficiency.ts). N comes from UTK_EVAL_RUNS
 * (default 5) so the dispatch workflow can parameterize it.
 */
export function buildToolCallingSuite(options: { evalFileUrl?: string; root?: string; runs?: number }): ReturnType<typeof defineEval> {
  const root = options.root ?? packageRootFrom(options.evalFileUrl ?? import.meta.url);
  const provenance = loadProvenanceManifest(root, 'tool-calling-efficiency');
  const runs = options.runs ?? (Number.parseInt(process.env.UTK_EVAL_RUNS ?? '', 10) || 5);
  const cases = loadCases(root, 'tool-calling-efficiency') as unknown as ToolCallingJsonlCase[];

  return defineEval({
    name: 'utk-tool-calling-efficiency',
    description:
      `${provenance.description} Offline targets invoke no LLM (ceil(len/4) estimates over real surfaces); ` +
      'see docs/features/evals/benchmark-integrity.md.',
    version: provenance.version,
    license: provenance.license,
    tags: [...provenance.tags, 'agentv-sdk'],
    target: 'toolcalling-utk',
    execution: { threshold: 0 },
    assertions: [{ type: 'token-efficiency', name: 'token_efficiency', weight: 1 }],
    tests: cases.map((testCase) => ({
      id: testCase.name,
      criteria: testCase.request,
      input: JSON.stringify({ ...testCase, runs }),
      metadata: {
        category: testCase.category,
        target_tool: testCase.targetTool,
        runs,
        origin: provenance.origin,
        authored_by: provenance.authored_by,
        disclaimer: provenance.disclaimer,
        ...(provenance.category_benchmark[testCase.category]
          ? { related_benchmark: provenance.category_benchmark[testCase.category] }
          : {})
      }
    }))
  });
}
