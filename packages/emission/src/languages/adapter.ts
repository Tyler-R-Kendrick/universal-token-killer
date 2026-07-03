import type { MinMap } from '@utk/minmap';

export type ScannedTokenKind =
  | 'identifier'
  | 'open-paren'
  | 'close-paren'
  | 'open-brace'
  | 'close-brace'
  | 'open-bracket'
  | 'close-bracket'
  | 'comma'
  | 'other';

export type ScannedToken = {
  kind: ScannedTokenKind;
  text: string;
  start: number;
  end: number;
};

/**
 * Deterministic per-language conversion between pretty and minified source.
 *
 * Grammars ground *generation* (llguidance-side); adapters ground
 * *conversion*. Both directions must be exact inverses over the same min
 * map: `expand(minify(x)) === x` and `minify(expand(m)) === m`.
 *
 * Adapters ship in language packs (see `registerLanguagePack`) — the
 * emission core carries no language-specific code.
 */
export type LanguageAdapter = {
  language: string;
  /** Source file extension including the dot, e.g. '.ts'. */
  fileExtension: string;
  minify(source: string, map: MinMap): string;
  expand(source: string, map: MinMap): string;
  collectIdentifiers(source: string): Set<string>;
  isParseable(source: string): boolean;
  /** Token-level walk used by macro call-site expansion. */
  scanTokens(source: string): ScannedToken[];
};
