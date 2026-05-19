declare module 'guidance-ts' {
  export type GrammarNode = {
    serialize(): unknown;
  };

  export function grm(strings: TemplateStringsArray, ...values: unknown[]): GrammarNode;
  export function gen(name: string, pattern: RegExp): GrammarNode;
  export function select(...choices: string[]): GrammarNode;
}
