#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseToolCallingCase, runToolCallingEpisode, type ToolCallingArm } from './toolCallingEfficiency.js';

/**
 * AgentV `cli`-provider target for the tool-calling token-efficiency benchmark.
 *
 * targets.yaml wires it as:
 *   command: node packages/evals/dist/agentv/toolCallingEfficiencyCli.js --arm utk --prompt {PROMPT} --output {OUTPUT_FILE}
 *
 * The rendered {PROMPT} is the JSON-encoded ToolCallingCase plus a `runs`
 * count. The CLI runs the N-run episode against a fresh temp workspace (so the
 * real `.utk/` cache starts cold and warms across runs) and writes the episode
 * report JSON to {OUTPUT_FILE}; assertions parse that JSON.
 */
export async function runCli(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const payload = JSON.parse(args.prompt) as { runs?: number } & Record<string, unknown>;
  const testCase = parseToolCallingCase(JSON.stringify(payload));
  const runs = typeof payload.runs === 'number' ? payload.runs : args.runs;

  const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'utk-toolcalling-'));
  try {
    const report = await runToolCallingEpisode({ workspaceRoot, testCase, arm: args.arm, runs });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    if (args.output) await writeFile(args.output, serialized, 'utf8');
    else process.stdout.write(serialized);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv: string[]): { arm: ToolCallingArm; prompt: string; output?: string; runs: number } {
  let arm: ToolCallingArm = 'utk';
  let prompt = '';
  let output: string | undefined;
  let runs = 5;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--arm' && (value === 'baseline' || value === 'utk')) {
      arm = value;
      i += 1;
    } else if (flag === '--prompt' && value !== undefined) {
      prompt = value;
      i += 1;
    } else if (flag === '--output' && value !== undefined) {
      output = value;
      i += 1;
    } else if (flag === '--runs' && value !== undefined) {
      runs = Number.parseInt(value, 10) || runs;
      i += 1;
    }
  }
  if (!prompt) throw new Error('Missing --prompt payload (JSON ToolCallingCase)');
  return { arm, prompt, ...(output ? { output } : {}), runs };
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
