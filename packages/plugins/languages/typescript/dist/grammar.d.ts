/**
 * Base TypeScript emission profile grammar, loaded from the committed
 * `grammars/typescript.emit.lark`. This is a deliberate subset — an emission
 * profile covering the constructs UTK emits, not full-language parity. It
 * grounds constrained generation; conversion between min and pretty forms is
 * owned by the language adapter.
 */
export declare const TYPESCRIPT_EMIT_LARK: string;
export declare function readPackGrammar(fileName: string): string;
