import { readPackagedGrammar } from './grammarFiles.js';

/**
 * Grammar for the compact min-map patch language, loaded from the committed
 * `grammars/minmap-patch.lark`. The `.lark` source is what
 * llguidance-constrained decoding consumes so a model can only introduce a
 * new symbol by first emitting a well-formed binding patch
 * ("declare-before-use"). `MINMAP_PATCH_LINE_PATTERN` is the deterministic
 * line-level check the local parser applies; tests assert every serialized
 * patch line conforms to it.
 */
export const MINMAP_PATCH_LARK = readPackagedGrammar('minmap-patch.lark');

export const MINMAP_PATCH_LINE_PATTERN =
  /^(\+ [A-Za-z][A-Za-z0-9]{0,2} [A-Za-z_$][A-Za-z0-9_$]*( @[a-z]+)?|- [A-Za-z][A-Za-z0-9]{0,2}|~ [A-Za-z][A-Za-z0-9]{0,2} [A-Za-z_$][A-Za-z0-9_$]*)$/;
