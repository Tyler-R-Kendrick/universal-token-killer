import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { renderOptimizedSkill } from './render-optimized-skill';
import { validateOptimizedSkill, type ValidationResult } from './validate-optimized-skill';

export type EvolutionBackend = 'trace' | 'agent-lightning';

export interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export type SpawnLike = (command: string, args: string[], input: string) => Promise<SpawnResult>;

export interface EvolveCandidatesArgs {
  sourceSkillRoot: string;
  outputRoot: string;
  iterations?: number;
  backend?: EvolutionBackend;
  python?: string;
  spawnFn?: SpawnLike;
}

export interface EvolvedCandidate {
  label: string;
  score: number;
  validation: ValidationResult;
  framework: EvolutionBackend;
}

export interface EvolveCandidatesResult {
  best: EvolvedCandidate;
  candidates: EvolvedCandidate[];
}

const traceProbe = `
from opto import trace
from opto.optimizers import OptoPrime
print("trace-opt ready")
`;

const agentLightningProbe = `
import agentlightning as agl
print("agentlightning ready")
`;

function backendSelectionScript(backend: EvolutionBackend): string {
  if (backend === 'trace') {
    return `
import json
import sys
from opto import trace
from opto.optimizers import OptoPrime

payload = json.loads(sys.stdin.read())

@trace.bundle(trainable=False)
def choose_best(candidates):
    """Select candidate with highest eval score."""
    return max(candidates, key=lambda item: item["score"])

candidate_node = trace.node(payload["candidates"], trainable=False)
best = choose_best(candidate_node)
print(json.dumps({"selected": best.data["label"], "framework": "trace"}))
`;
  }

  return `
import asyncio
import json
import sys
import agentlightning as agl
from agentlightning.store.memory import InMemoryLightningStore

async def main():
    payload = json.loads(sys.stdin.read())
    store = InMemoryLightningStore(thread_safe=True)
    resources = {"skill_optimizer": {"backend": "agent-lightning"}}
    resource_update = await store.update_resources("detoks-skill", resources)
    for candidate in payload["candidates"]:
        await store.enqueue_rollout(
            input=candidate,
            mode="eval",
            resources_id=resource_update.resources_id,
        )
    selected = max(payload["candidates"], key=lambda item: item["score"])
    print(json.dumps({"selected": selected["label"], "framework": "agent-lightning"}))

asyncio.run(main())
`;
}

function defaultSpawn(command: string, args: string[], input: string): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

async function requireBackend(backend: EvolutionBackend, python: string, spawnFn: SpawnLike): Promise<void> {
  const probe = backend === 'trace' ? traceProbe : agentLightningProbe;
  const result = await spawnFn(python, ['-c', probe], '');
  if (result.code !== 0) {
    const install =
      backend === 'trace'
        ? 'pip install trace-opt'
        : 'pip install --upgrade agentlightning';
    throw new Error(`${backend} backend unavailable. Install with: ${install}\n${result.stderr || result.stdout}`);
  }
}

async function selectWithBackend(
  backend: EvolutionBackend,
  python: string,
  spawnFn: SpawnLike,
  candidates: EvolvedCandidate[]
): Promise<string | undefined> {
  const payload = JSON.stringify({
    candidates: candidates.map((candidate) => ({
      label: candidate.label,
      score: candidate.score,
      ok: candidate.validation.ok,
      tokenRatio: candidate.validation.tokenRatio
    }))
  });
  const result = await spawnFn(python, ['-c', backendSelectionScript(backend)], payload);
  if (result.code !== 0) {
    throw new Error(`${backend} candidate selection failed.\n${result.stderr || result.stdout}`);
  }
  try {
    return (JSON.parse(result.stdout) as { selected?: string }).selected;
  } catch {
    return undefined;
  }
}

function score(validation: ValidationResult, iteration: number): number {
  const passed = validation.checks.filter((check) => check.ok).length / validation.checks.length;
  const ratioScore = Math.max(0, 1 - validation.tokenRatio);
  return passed * 100 + ratioScore * 25 - iteration;
}

export async function evolveCandidates(args: EvolveCandidatesArgs): Promise<EvolveCandidatesResult> {
  const backend = args.backend ?? 'trace';
  const python = args.python ?? 'python';
  const spawnFn = args.spawnFn ?? defaultSpawn;
  const iterations = args.iterations ?? 3;

  await requireBackend(backend, python, spawnFn);

  const candidates: EvolvedCandidate[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), `detoks-${backend}-${index}-`));
    await renderOptimizedSkill({
      sourceSkillRoot: args.sourceSkillRoot,
      outputSkillRoot: tempRoot,
      candidateLabel: `${backend}-${index}`
    });
    const validation = await validateOptimizedSkill({
      sourceSkillRoot: args.sourceSkillRoot,
      optimizedSkillRoot: tempRoot
    });
    candidates.push({
      label: `${backend}-${index}`,
      score: score(validation, index),
      validation,
      framework: backend
    });
  }

  const selectedLabel = await selectWithBackend(backend, python, spawnFn, candidates);
  const best =
    candidates.find((candidate) => candidate.label === selectedLabel) ??
    [...candidates].sort((left, right) => right.score - left.score)[0];
  if (!best) throw new Error('No candidates generated');

  await renderOptimizedSkill({
    sourceSkillRoot: args.sourceSkillRoot,
    outputSkillRoot: args.outputRoot,
    candidateLabel: best.label
  });

  return { best, candidates };
}
