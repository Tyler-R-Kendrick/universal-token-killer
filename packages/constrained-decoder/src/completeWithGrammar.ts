import { Generation, Session, gen, str, type GrammarNode } from 'guidance-ts';

export type CompleteWithGrammarTracer = {
  recordFailure(params: { name: string; runType?: 'tool' | 'parser' | 'chain' | 'llm'; error?: { message: string; name?: string } | Error; extra?: Record<string, unknown> }): void;
};

export type CompleteWithGrammarParams = {
  prompt: string;
  lark: string;
  slotName: string;
  maxTokens?: number;
  sessionConfig?: { url: string };
  runtime?: CompleteWithGrammarRuntime;
  tracer?: CompleteWithGrammarTracer;
};

export type CompleteWithGrammarRuntime = {
  Session: new (url: string) => any;
  Generation: new (session: any, prompt: string, grammar: GrammarNode) => {
    start(): Promise<void>;
    getCapture(name: string): string | undefined;
  };
  str(value: string): { join(grammar: GrammarNode): GrammarNode };
  buildGrammar(lark: string, captureName: string): GrammarNode;
};

const defaultRuntime: CompleteWithGrammarRuntime = {
  Session,
  Generation,
  str,
  /* v8 ignore next -- default grammar builder requires a live Guidance session */
  buildGrammar: (_lark: string, captureName: string) => gen(captureName, /[\s\S]+/)
};

export type CompleteWithGrammarResult = {
  available: boolean;
  completion?: string;
  errors: string[];
};

export async function completeWithGrammar(params: CompleteWithGrammarParams): Promise<CompleteWithGrammarResult> {
  if (!params.sessionConfig) {
    params.tracer?.recordFailure({
      name: 'guidance.unavailable',
      runType: 'llm',
      error: { message: 'guidance session is not configured' },
      extra: { slot: params.slotName }
    });
    return { available: false, errors: ['guidance session is not configured'] };
  }
  /* v8 ignore next -- default runtime falls back to live guidance-ts */
  const runtime = params.runtime ?? defaultRuntime;
  const grammar = runtime.buildGrammar(params.lark, params.slotName);
  const session = new runtime.Session(params.sessionConfig.url);
  const generation = new runtime.Generation(session, params.prompt, runtime.str('').join(grammar));
  await generation.start();
  const completion = generation.getCapture(params.slotName);
  if (!completion) {
    return { available: true, errors: ['guidance generation did not capture slot'] };
  }
  return { available: true, completion, errors: [] };
}
