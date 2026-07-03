import { readFileSync } from 'node:fs';

/**
 * Build a `.lark` grammar-file reader bound to a package's grammars directory.
 *
 * Grammars ship as real `.lark` files — never escaped source strings — so
 * external Lark tooling can verify them directly. The reader is parameterized by
 * `baseDir` because `import.meta.url` inside this module resolves to the reader's
 * own location, not the caller's `grammars/` directory. This is exactly why the
 * two prior copies (emission's `readPackagedGrammar`, the TypeScript pack's
 * `readPackGrammar`) had to differ only in their relative base path; callers now
 * supply that base once.
 */
export function createGrammarReader(baseDir: URL): (fileName: string) => string {
  return (fileName: string): string => readFileSync(new URL(fileName, baseDir), 'utf8');
}
