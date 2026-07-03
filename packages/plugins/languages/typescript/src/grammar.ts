import { createGrammarReader } from '@utk/grammar';

const readGrammar = createGrammarReader(new URL('../grammars/', import.meta.url));

/**
 * Base TypeScript emission profile grammar, loaded from the committed
 * `grammars/typescript.emit.lark`. This is a deliberate subset — an emission
 * profile covering the constructs UTK emits, not full-language parity. It
 * grounds constrained generation; conversion between min and pretty forms is
 * owned by the language adapter.
 */
export const TYPESCRIPT_EMIT_LARK = readGrammar('typescript.emit.lark');
