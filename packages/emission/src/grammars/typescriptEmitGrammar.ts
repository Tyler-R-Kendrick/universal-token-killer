/**
 * Base TypeScript emission profile grammar.
 *
 * This is a deliberate subset — an emission profile covering the constructs
 * UTK emits, not full-language parity. It grounds constrained generation;
 * conversion between min and pretty forms is owned by the language adapter.
 */
export const TYPESCRIPT_EMIT_LARK = `// TypeScript emission profile (subset).
start: statement+
statement: import_decl | export_decl | const_decl | function_decl | class_decl | return_stmt | expr_stmt
import_decl: "import" "{" IDENT ("," IDENT)* "}" "from" STRING ";"
export_decl: "export" (const_decl | function_decl | class_decl)
const_decl: ("const" | "let") IDENT type_annotation? "=" expr ";"
function_decl: "async"? "function" IDENT "(" params? ")" type_annotation? block
class_decl: "class" IDENT type_params? "{" class_member* "}"
class_member: field_decl | method_decl
field_decl: modifier* IDENT type_annotation? field_init? ";"
field_init: "=" expr
method_decl: IDENT "(" params? ")" type_annotation? block
modifier: "private" | "readonly" | "static"
params: param ("," param)*
param: IDENT type_annotation?
type_params: "<" IDENT ("," IDENT)* ">"
type_annotation: ":" type_expr
type_expr: "string" | "number" | "boolean" | "void" | IDENT type_args?
type_args: "<" type_expr ("," type_expr)* ">"
block: "{" statement* "}"
return_stmt: "return" expr? ";"
expr_stmt: expr ";"
expr: "await" expr | arrow_fn | call_expr | member_expr | IDENT | STRING | NUMBER | TEMPLATE
call_expr: member_expr "(" args? ")" | IDENT "(" args? ")"
member_expr: IDENT ("." IDENT)+
args: expr ("," expr)*
arrow_fn: "(" params? ")" "=>" expr
IDENT: /[A-Za-z_$][A-Za-z0-9_$]*/
STRING: /'[^']*'|"[^"]*"/
NUMBER: /[0-9]+(\\.[0-9]+)?/
TEMPLATE: /\`[^\`]*\`/
%ignore /\\s+/
`;
