import type { MinMap } from '../minmap/format.js';

/**
 * Deterministic per-language conversion between pretty and minified source.
 *
 * Grammars ground *generation* (llguidance-side); adapters ground
 * *conversion*. Both directions must be exact inverses over the same min
 * map: `expand(minify(x)) === x` and `minify(expand(m)) === m`.
 */
export type LanguageAdapter = {
  language: string;
  minify(source: string, map: MinMap): string;
  expand(source: string, map: MinMap): string;
  collectIdentifiers(source: string): Set<string>;
  isParseable(source: string): boolean;
};
