#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { estimateTokens } from '@utk/foundation';
import type { BenchmarkCase } from '../data.js';
import { recoverySlice } from '../benchmarks.js';
import { baselineTechnique, utkTechnique, type ArmTechnique } from '../harness.js';
import { getCompetitor, makeCompetitorArm } from '../comparison/index.js';

/**
 * AgentV `cli`-provider target for the modeled comparison arms.
 *
 * targets.yaml wires each arm as its own target, e.g.:
 *   command: node packages/evals/dist/agentv/armCli.js --arm utk --prompt {PROMPT} --output {OUTPUT_FILE}
 *
 * {PROMPT} is the JSON-encoded BenchmarkCase; the CLI applies the arm's
 * technique and writes a JSON surface report to {OUTPUT_FILE} for the custom
 * assertions (`.agentv/assertions/`) to grade.
 *
 * HONESTY NOTE (same as ../harness.ts): these arms are configured models of
 * each technique — the UTK arm persists-and-hands-back by construction, and
 * competitor arms are one shared extractive heuristic. No LLM is invoked.
 * Recovery tokens are charged per the audit's accounting rules.
 */
export type ArmSurfaceReport = {
  arm: string;
  visible: string;
  recoverable: string;
  visible_tokens: number;
  /** Recovery-slice tokens charged when facts are recoverable but not visible. */
  recovery_tokens: number;
  raw_tokens: number;
  model: 'none (offline deterministic surfaces; ceil(len/4) token estimate)';
};

export async function renderArmSurface(arm: string, testCase: BenchmarkCase): Promise<ArmSurfaceReport> {
  const technique = resolveArm(arm);
  const output = await technique(testCase);
  const factsVisible = testCase.requiredFacts.every((fact) => output.visibleText.includes(fact));
  const factsRecoverable = testCase.requiredFacts.every((fact) => output.recoverableText.includes(fact));
  const recoveryTokens = !factsVisible && factsRecoverable && testCase.requiredFacts.length > 0
    ? estimateTokens(recoverySlice(testCase))
    : 0;
  return {
    arm,
    visible: output.visibleText,
    recoverable: output.recoverableText,
    visible_tokens: estimateTokens(output.visibleText),
    recovery_tokens: recoveryTokens,
    raw_tokens: estimateTokens(testCase.rawOutput),
    model: 'none (offline deterministic surfaces; ceil(len/4) token estimate)'
  };
}

function resolveArm(arm: string): ArmTechnique {
  if (arm === 'baseline') return baselineTechnique;
  if (arm === 'utk') return utkTechnique;
  const competitor = getCompetitor(arm);
  if (!competitor) throw new Error(`Unknown arm: ${arm}`);
  return makeCompetitorArm({ keepThreshold: competitor.keepThreshold, ...(competitor.queryAware ? { queryAware: true } : {}) });
}

export async function runCli(argv: string[]): Promise<void> {
  let arm = 'baseline';
  let prompt = '';
  let output: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--arm' && value !== undefined) {
      arm = value;
      i += 1;
    } else if (flag === '--prompt' && value !== undefined) {
      prompt = value;
      i += 1;
    } else if (flag === '--output' && value !== undefined) {
      output = value;
      i += 1;
    }
  }
  if (!prompt) throw new Error('Missing --prompt payload (JSON BenchmarkCase)');
  const testCase = JSON.parse(prompt) as BenchmarkCase;
  const report = await renderArmSurface(arm, testCase);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (output) await writeFile(output, serialized, 'utf8');
  else process.stdout.write(serialized);
}

if (isMainModule()) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}
