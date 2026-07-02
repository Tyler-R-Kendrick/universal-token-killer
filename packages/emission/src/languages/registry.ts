import type { LanguageAdapter } from './adapter.js';

/**
 * A pluggable language pack: everything the emission core needs to plan,
 * constrain, and expand emissions for one language. Packs live outside the
 * core (reference implementation: `@utk/lang-typescript` under
 * `packages/plugins/languages/typescript`, with future languages as sibling
 * folders) and register themselves here.
 */
export type LanguageEmissionPack = {
  language: string;
  adapter: LanguageAdapter;
  /** Base emission-profile grammar (.lark source shipped by the pack). */
  grammar: string;
  /** Ladder rung 3 index: capability id -> stdlib evidence. */
  stdlibCapabilities?: Record<string, string>;
  /** Ladder rung 4 index: capability id -> platform evidence. */
  platformCapabilities?: Record<string, string>;
};

const packs = new Map<string, LanguageEmissionPack>();

export function registerLanguagePack(pack: LanguageEmissionPack): LanguageEmissionPack {
  if (typeof pack.language !== 'string' || pack.language.length === 0) {
    throw new Error('Language pack requires a non-empty language id');
  }
  if (pack.adapter.language !== pack.language) {
    throw new Error(`Language pack '${pack.language}' adapter declares mismatched language '${pack.adapter.language}'`);
  }
  if (!/^start:/m.test(pack.grammar)) {
    throw new Error(`Language pack '${pack.language}' grammar must declare a start rule`);
  }
  packs.set(pack.language, pack);
  return pack;
}

export function maybeResolveLanguagePack(language: string): LanguageEmissionPack | undefined {
  return packs.get(language);
}

export function resolveLanguagePack(language: string): LanguageEmissionPack {
  const pack = packs.get(language);
  if (!pack) {
    throw new Error(`No language pack is registered for language '${language}'`);
  }
  return pack;
}

export function listLanguagePacks(): string[] {
  return [...packs.keys()].sort();
}

export function resolveLanguageAdapter(language: string): LanguageAdapter {
  return resolveLanguagePack(language).adapter;
}

export function languageGrammar(language: string): string {
  return resolveLanguagePack(language).grammar;
}
