import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile, canonicalJson, contentHash, safeJoin } from '@utk/core';
import { findSymbol } from '@utk/code-graph';
import type { MacroDescriptor } from '../macros/defineMacro.js';
import { appendEmissionLedgerEntry } from '../macros/ledger.js';
import { platformCapabilities, stdlibCapabilities } from './languageCapabilities.js';
import { resolveEmissionPolicy } from './policy.js';

export type EmissionStrategy = 'reuse' | 'stdlib' | 'platform' | 'dependency' | 'macro' | 'plain' | 'minified' | 'none';

export type EmissionLadderDecision = {
  rung: number;
  name: string;
  outcome: 'resolved' | 'unresolved';
  evidence: string;
};

export type PlanEmissionInput = {
  workspaceRoot: string;
  language: string;
  /** The requested change in the caller's words. */
  request: string;
  /** The symbol-shaped capability the request needs, e.g. 'httpGetJson'. */
  capability: string;
  mode?: string;
  carve_outs?: string[];
  macros?: MacroDescriptor[];
  /** Known capability lists per installed package, shipped by language packs. */
  dependencyCapabilities?: Record<string, string[]>;
};

export type EmissionPlan = {
  version: 1;
  language: string;
  request: string;
  capability: string;
  mode: string;
  decisions: EmissionLadderDecision[];
  selectedRung?: number;
  strategy: EmissionStrategy;
  planHash: string;
  planPath: string;
};

const NOT_REACHED = 'not reached — capability satisfied at an earlier rung';

/**
 * The Ponytail decision ladder, formalized: every rung is a deterministic
 * predicate with recorded evidence, and rung 1 (YAGNI) is the gate — when any
 * of rungs 2–5 resolve, emission is refused in favor of the existing
 * satisfier.
 */
export async function planEmission(input: PlanEmissionInput): Promise<EmissionPlan> {
  const policy = resolveEmissionPolicy({
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.carve_outs !== undefined ? { carve_outs: input.carve_outs } : {})
  });

  const decisions: EmissionLadderDecision[] = [];
  let selectedRung: number | undefined;
  let strategy: EmissionStrategy = 'none';

  if (policy.mode !== 'off') {
    const reuse = await reuseDecision(input);
    const stdlib = indexDecision(3, 'stdlib', stdlibCapabilities(input.language), input.capability);
    const platform = indexDecision(4, 'platform', platformCapabilities(input.language), input.capability);
    const dependency = await dependencyDecision(input);
    const resolvers: Array<{ decision: EmissionLadderDecision; strategy: EmissionStrategy }> = [
      { decision: reuse, strategy: 'reuse' },
      { decision: stdlib, strategy: 'stdlib' },
      { decision: platform, strategy: 'platform' },
      { decision: dependency, strategy: 'dependency' }
    ];
    const satisfied = resolvers.find((resolver) => resolver.decision.outcome === 'resolved');

    decisions.push(yagniDecision(satisfied?.decision), reuse, stdlib, platform, dependency);

    if (satisfied) {
      selectedRung = satisfied.decision.rung;
      strategy = satisfied.strategy;
      decisions.push(
        { rung: 6, name: 'one-liner-macro', outcome: 'unresolved', evidence: NOT_REACHED },
        { rung: 7, name: 'minimum-viable-emission', outcome: 'unresolved', evidence: NOT_REACHED }
      );
    } else {
      const macro = macroDecision(input, policy.mode);
      decisions.push(macro);
      if (macro.outcome === 'resolved') {
        selectedRung = 6;
        strategy = 'macro';
        decisions.push({ rung: 7, name: 'minimum-viable-emission', outcome: 'unresolved', evidence: NOT_REACHED });
      } else {
        selectedRung = 7;
        strategy = policy.mode === 'ultra' ? 'minified' : 'plain';
        decisions.push({
          rung: 7,
          name: 'minimum-viable-emission',
          outcome: 'resolved',
          evidence: `emit ${strategy} implementation constrained by the ${input.language} emission grammar`
        });
      }
    }
  }

  const persisted = {
    version: 1 as const,
    language: input.language,
    request: input.request,
    capability: input.capability,
    mode: policy.mode,
    decisions,
    ...(selectedRung !== undefined ? { selectedRung } : {}),
    strategy
  };
  const planHash = contentHash(persisted, 16);
  const planPath = safeJoin(input.workspaceRoot, '.utk', 'emission', 'plans', planHash, 'plan.json');
  await mkdir(path.dirname(planPath), { recursive: true });
  await atomicWriteFile(planPath, canonicalJson({ ...persisted, planHash }));
  await appendEmissionLedgerEntry(input.workspaceRoot, {
    type: 'emission-plan',
    data: { planHash, selectedRung: selectedRung ?? null, strategy }
  });

  return { ...persisted, planHash, planPath };
}

function yagniDecision(satisfier: EmissionLadderDecision | undefined): EmissionLadderDecision {
  if (satisfier) {
    return {
      rung: 1,
      name: 'yagni-gate',
      outcome: 'resolved',
      evidence: `capability already satisfied at rung ${satisfier.rung} — emission refused`
    };
  }
  return { rung: 1, name: 'yagni-gate', outcome: 'unresolved', evidence: 'no existing satisfier found' };
}

async function reuseDecision(input: PlanEmissionInput): Promise<EmissionLadderDecision> {
  const symbols = await findSymbol({ workspaceRoot: input.workspaceRoot }, { query: input.capability, limit: 5 });
  const exact = symbols.find((symbol) => symbol.name === input.capability);
  if (exact) {
    return {
      rung: 2,
      name: 'codebase-reuse',
      outcome: 'resolved',
      evidence: `existing symbol ${exact.name} at ${exact.filePath} (${exact.id})`
    };
  }
  return { rung: 2, name: 'codebase-reuse', outcome: 'unresolved', evidence: 'no exact code-graph symbol match' };
}

function indexDecision(
  rung: number,
  name: string,
  index: Record<string, string>,
  capability: string
): EmissionLadderDecision {
  const match = index[capability];
  if (match !== undefined) {
    return { rung, name, outcome: 'resolved', evidence: match };
  }
  return { rung, name, outcome: 'unresolved', evidence: `capability '${capability}' not in the ${name} index` };
}

async function dependencyDecision(input: PlanEmissionInput): Promise<EmissionLadderDecision> {
  const known = input.dependencyCapabilities ?? {};
  let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try {
    manifest = JSON.parse(await readFile(path.join(input.workspaceRoot, 'package.json'), 'utf8')) as typeof manifest;
  } catch {
    return { rung: 5, name: 'installed-dependency', outcome: 'unresolved', evidence: 'no readable package manifest' };
  }
  const installed = { ...manifest.dependencies, ...manifest.devDependencies };
  for (const [dependency, capabilities] of Object.entries(known)) {
    if (installed[dependency] !== undefined && capabilities.includes(input.capability)) {
      return {
        rung: 5,
        name: 'installed-dependency',
        outcome: 'resolved',
        evidence: `dependency '${dependency}' already provides '${input.capability}'`
      };
    }
  }
  return { rung: 5, name: 'installed-dependency', outcome: 'unresolved', evidence: 'no installed dependency covers the capability' };
}

function macroDecision(input: PlanEmissionInput, mode: string): EmissionLadderDecision {
  if (mode === 'lite') {
    return { rung: 6, name: 'one-liner-macro', outcome: 'unresolved', evidence: 'macros disabled in lite mode' };
  }
  const macro = (input.macros ?? []).find((candidate) => candidate.name === input.capability);
  if (macro) {
    return { rung: 6, name: 'one-liner-macro', outcome: 'resolved', evidence: `macro '${macro.name}' expands the idiom` };
  }
  return { rung: 6, name: 'one-liner-macro', outcome: 'unresolved', evidence: 'no registered macro matches' };
}
