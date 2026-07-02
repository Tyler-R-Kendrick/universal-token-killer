/**
 * Grammar for the compact min-map patch language.
 *
 * The `.lark` source is what llguidance-constrained decoding consumes so a
 * model can only introduce a new symbol by first emitting a well-formed
 * binding patch ("declare-before-use"). `MINMAP_PATCH_LINE_PATTERN` is the
 * deterministic line-level check the local parser applies; tests assert every
 * serialized patch line conforms to it.
 */
export const MINMAP_PATCH_LARK = `start: line (NEWLINE line)*
line: add | remove | rename
add: "+" WS MIN_ID WS PRETTY (WS KIND)?
remove: "-" WS MIN_ID
rename: "~" WS MIN_ID WS PRETTY
KIND: "@ident" | "@macro" | "@keyword"
MIN_ID: /[A-Za-z][A-Za-z0-9]{0,2}/
PRETTY: /[A-Za-z_$][A-Za-z0-9_$]*/
WS: " "
NEWLINE: "\\n"
`;

export const MINMAP_PATCH_LINE_PATTERN =
  /^(\+ [A-Za-z][A-Za-z0-9]{0,2} [A-Za-z_$][A-Za-z0-9_$]*( @[a-z]+)?|- [A-Za-z][A-Za-z0-9]{0,2}|~ [A-Za-z][A-Za-z0-9]{0,2} [A-Za-z_$][A-Za-z0-9_$]*)$/;
