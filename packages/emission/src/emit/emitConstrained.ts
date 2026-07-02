import { mkdir } from 'node:fs/promises';
import { atomicWriteFile, contentHash, safeJoin, type GrammarCompletion } from '@utk/core';
import { deriveMinGrammar } from '../grammars/deriveMinGrammar.js';
import { languageGrammar } from '../grammars/languageProfile.js';
import type { LanguageAdapter } from '../languages/adapter.js';
import { resolveLanguageAdapter } from '../languages/registry.js';
import type { MacroDescriptor } from '../macros/defineMacro.js';
import { expandEmissionSource } from '../macros/expandEmission.js';
import { appendEmissionLedgerEntry } from '../macros/ledger.js';
import { MIN_ID_PATTERN, type MinMap } from '../minmap/format.js';
import { appendMinMapPatch } from '../minmap/journal.js';
import { applyMinMapPatch, parseMinMapPatch } from '../minmap/patch.js';
import { planEmission, type EmissionPlan } from '../ladder/planEmission.js';
import { extractEmissionPatchBlock } from './patchBlock.js';

export type EmitConstrainedInput = {
  workspaceRoot: string;
  language: string;
  request: string;
  capability: string;
  map: MinMap;
  mode?: string;
  carve_outs?: string[];
  macros?: MacroDescriptor[];
  dependencyCapabilities?: Record<string, string[]>;
  /** Injected guidance completion — the constrained-decoder seam. */
  completeWithGrammar?: GrammarCompletion;
  /** Deterministic min emission used when no guidance runtime is configured. */
  fallbackMinSource?: string;
};

export type EmitConstrainedGuidance = {
  used: boolean;
  available: boolean;
  reason?: string;
};

export type EmitConstrainedResult = {
  plan: EmissionPlan;
  guidance: EmitConstrainedGuidance;
  minSource?: string;
  prettySource?: string;
  minGrammar?: string;
  artifacts?: { minPath: string; prettyPath: string };
};

/**
 * Constrained min emission with honest availability: when no guidance
 * runtime is injected the result says so and falls back deterministically —
 * it never fakes a constrained decode. The pretty expansion is the only
 * user-facing form.
 */
export async function emitConstrained(input: EmitConstrainedInput): Promise<EmitConstrainedResult> {
  const plan = await planEmission({
    workspaceRoot: input.workspaceRoot,
    language: input.language,
    request: input.request,
    capability: input.capability,
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.carve_outs !== undefined ? { carve_outs: input.carve_outs } : {}),
    ...(input.macros !== undefined ? { macros: input.macros } : {}),
    ...(input.dependencyCapabilities !== undefined ? { dependencyCapabilities: input.dependencyCapabilities } : {})
  });

  if (plan.strategy !== 'minified' && plan.strategy !== 'macro') {
    return { plan, guidance: { used: false, available: false } };
  }

  const grammar = languageGrammar(input.language);
  const adapter = resolveLanguageAdapter(input.language);
  const macroIds = input.map.entries.filter((entry) => entry.kind === 'macro').map((entry) => entry.minId);
  const minGrammar = deriveMinGrammar(grammar, macroIds.length > 0 ? { macroIds } : {});

  let minSource: string;
  let guidance: EmitConstrainedGuidance;
  if (input.completeWithGrammar) {
    minSource = await input.completeWithGrammar({
      prompt: `Emit minified ${input.language} for: ${input.request} (capability '${input.capability}')`,
      lark: minGrammar,
      slotName: 'emission'
    });
    guidance = { used: true, available: true };
  } else if (input.fallbackMinSource !== undefined) {
    minSource = input.fallbackMinSource;
    guidance = {
      used: true,
      available: false,
      reason: 'no guidance runtime configured — deterministic fallback emission used'
    };
  } else {
    return { plan, guidance: { used: true, available: false, reason: 'no guidance runtime configured' } };
  }

  const { patchText, code } = extractEmissionPatchBlock(minSource);
  let map = input.map;
  if (patchText !== undefined) {
    map = applyMinMapPatch(map, parseMinMapPatch(patchText));
    await appendMinMapPatch(input.workspaceRoot, input.language, patchText);
    await appendEmissionLedgerEntry(input.workspaceRoot, { type: 'minmap-patch', data: { patch: patchText } });
  }

  if (!adapter.isParseable(code)) {
    throw new Error(`Emission for '${input.capability}' does not parse as ${input.language}`);
  }
  assertMinIdentifiersResolve(adapter, code, map);

  const prettySource = await expandEmissionSource(code, map, input.macros ?? []);

  const runHash = contentHash({ planHash: plan.planHash, minSource }, 16);
  const runDir = safeJoin(input.workspaceRoot, '.utk', 'emission', 'runs', runHash);
  await mkdir(runDir, { recursive: true });
  const minPath = safeJoin(runDir, 'emission.min.ts');
  const prettyPath = safeJoin(runDir, 'emission.pretty.ts');
  await atomicWriteFile(minPath, minSource);
  await atomicWriteFile(prettyPath, prettySource);
  await appendEmissionLedgerEntry(input.workspaceRoot, {
    type: 'constrained-emission',
    data: {
      planHash: plan.planHash,
      runHash,
      guidanceAvailable: guidance.available,
      minChars: minSource.length,
      prettyChars: prettySource.length
    }
  });

  return { plan, guidance, minSource, prettySource, minGrammar, artifacts: { minPath, prettyPath } };
}

function assertMinIdentifiersResolve(adapter: LanguageAdapter, code: string, map: MinMap): void {
  const minIds = new Set(map.entries.map((entry) => entry.minId));
  for (const identifier of adapter.collectIdentifiers(code)) {
    if (MIN_ID_PATTERN.test(identifier) && !minIds.has(identifier)) {
      throw new Error(`Emission references undeclared min id '${identifier}'`);
    }
  }
}
