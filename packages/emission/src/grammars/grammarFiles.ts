import { readFileSync } from 'node:fs';

/**
 * Grammars ship as real `.lark` files under `packages/emission/grammars/` —
 * never as escaped source strings — so external Lark tooling can verify them
 * directly. The path resolves relative to this module, which sits at the
 * same depth in both `src/` and `dist/`.
 */
export function readPackagedGrammar(fileName: string): string {
  return readFileSync(new URL(`../../grammars/${fileName}`, import.meta.url), 'utf8');
}
