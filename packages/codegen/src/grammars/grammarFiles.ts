import { createGrammarReader } from '@utk/grammar';

/**
 * Grammars ship as real `.lark` files under `packages/codegen/grammars/` —
 * never as escaped source strings — so external Lark tooling can verify them
 * directly. The path resolves relative to this module, which sits at the same
 * depth in both `src/` and `dist/`.
 */
export const readPackagedGrammar = createGrammarReader(new URL('../../grammars/', import.meta.url));
