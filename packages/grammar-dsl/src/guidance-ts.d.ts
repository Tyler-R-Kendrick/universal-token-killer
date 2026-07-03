declare module 'guidance-ts' {
  export type GrammarNode = {
    serialize(): unknown;
  };

  export function grm(strings: TemplateStringsArray, ...values: unknown[]): GrammarNode;
  export function gen(name: string, pattern: RegExp): GrammarNode;
  export function select(...choices: string[]): GrammarNode;
  export function str(value: string): { join(grammar: GrammarNode): GrammarNode };

  export class Session {
    constructor(url: string);
  }

  export class Generation {
    constructor(session: Session, prompt: string, grammar: GrammarNode);
    start(): Promise<void>;
    getCapture(name: string): string | undefined;
  }
}
