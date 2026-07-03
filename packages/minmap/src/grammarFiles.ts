import { createGrammarReader } from '@utk/grammar';

/**
 * Reads `@utk/minmap`'s own packaged `.lark` grammars — the declare-before-use
 * min-map patch grammars (`minmap-patch.lark`, `minmap-patch-block.lark`). Kept
 * internal to the package (not re-exported from the barrel) so it never collides
 * with the emission-scoped reader.
 */
export const readPackagedGrammar = createGrammarReader(new URL('../grammars/', import.meta.url));
