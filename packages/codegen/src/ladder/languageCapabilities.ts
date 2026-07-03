import { maybeResolveLanguagePack } from '../languages/registry.js';

/**
 * Deterministic capability indexes backing ladder rungs 3 and 4. These are
 * data shipped by language packs, not heuristics: a capability resolves only
 * on an exact key match. Languages without a registered pack simply resolve
 * nothing, so the ladder falls through to rung 7.
 */
export function stdlibCapabilities(language: string): Record<string, string> {
  return maybeResolveLanguagePack(language)?.stdlibCapabilities ?? {};
}

export function platformCapabilities(language: string): Record<string, string> {
  return maybeResolveLanguagePack(language)?.platformCapabilities ?? {};
}
