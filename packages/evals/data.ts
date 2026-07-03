import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths.js';

/**
 * A single, technique-agnostic benchmark case.
 *
 * The same case is replayed through every arm (baseline / competitor / utk) of a
 * comparison, so it never encodes anything provider-specific. Provider behaviour
 * lives in `comparison/<competitor>.ts`; the case only describes the raw tool
 * output and what a good compaction must (and must not) preserve.
 */
export type BenchmarkCase = {
  /** Stable unique id, also used as the eval-suite test id. */
  name: string;
  /** Coarse grouping for reporting (e.g. "Test output", "Kubernetes"). */
  category: string;
  /** The tool that produced `rawOutput` (e.g. "shell.kubectl.get-pods"). */
  toolId: string;
  /** The user intent driving the tool call; used as the suite input and the LLM-grader query. */
  prompt: string;
  /** The full, uncompacted tool output an agent would otherwise read verbatim. */
  rawOutput: string;
  /** Literal substrings that MUST remain recoverable after compaction (accuracy / groundedness). */
  requiredFacts: string[];
  /** Literal substrings that are noise and SHOULD be dropped from the chat surface (relevance). */
  irrelevantFacts: string[];
};

export { DATA_DIR } from './paths.js';

/** Coarse token estimate shared by the harness and every grader. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Parse a `.jsonl` benchmark file (one {@link BenchmarkCase} per line). */
export function parseBenchmark(jsonl: string): BenchmarkCase[] {
  return jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL on line ${index + 1}: ${(error as Error).message}`);
      }
      return assertCase(parsed, index + 1);
    });
}

/** Load a benchmark dataset by name from `packages/evals/data/<name>.jsonl`. */
export async function loadBenchmark(name: string, dir: string = DATA_DIR): Promise<BenchmarkCase[]> {
  const jsonl = await readFile(path.join(dir, `${name}.jsonl`), 'utf8');
  return parseBenchmark(jsonl);
}

function assertCase(value: unknown, line: number): BenchmarkCase {
  if (typeof value !== 'object' || value === null) {
    throw new Error(`Benchmark case on line ${line} is not an object.`);
  }
  const record = value as Record<string, unknown>;
  for (const key of ['name', 'category', 'toolId', 'prompt', 'rawOutput'] as const) {
    if (typeof record[key] !== 'string') {
      throw new Error(`Benchmark case on line ${line} is missing string field "${key}".`);
    }
  }
  return {
    name: record.name as string,
    category: record.category as string,
    toolId: record.toolId as string,
    prompt: record.prompt as string,
    rawOutput: record.rawOutput as string,
    requiredFacts: asStringArray(record.requiredFacts),
    irrelevantFacts: asStringArray(record.irrelevantFacts)
  };
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}
