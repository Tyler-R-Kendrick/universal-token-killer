import { Generation, Session, gen, grm, select, str, type GrammarNode } from 'guidance-ts';

export type ValidationResult = { valid: boolean; errors: string[] };

export type RouteReason = 'shape_match' | 'input_match' | 'tool_match' | 'prior_match' | 'fallback' | 'unknown';

export type RouteCandidate = {
  schema: string;
  confidence: number;
  reason: RouteReason;
};

export type GuidanceSessionConfig = {
  url: string;
};

export type GuidanceRuntime = {
  Session: new (url: string) => any;
  Generation: new (session: any, prompt: string, grammar: GrammarNode) => {
    start(): Promise<void>;
    getCapture(name: string): string | undefined;
  };
  str(value: string): { join(grammar: GrammarNode): GrammarNode };
};

export type ConstrainedRouteResult = {
  available: boolean;
  route?: RouteCandidate;
  errors: string[];
};

const defaultRuntime: GuidanceRuntime = { Session, Generation, str };

export function buildRouteGrammar(candidates: RouteCandidate[]): GrammarNode {
  const schemas = candidates.map((candidate) => candidate.schema);
  const reasons = [...new Set(candidates.map((candidate) => candidate.reason))];
  const schemaNode = schemas.length > 0 ? select(...schemas) : gen('schema', /[A-Za-z0-9._-]+/);
  const reasonNode = reasons.length > 0 ? select(...reasons) : select('shape_match', 'input_match', 'tool_match', 'prior_match', 'fallback', 'unknown');
  return grm`route{schema:"${schemaNode}",confidence:${gen('confidence', /(0(\.[0-9]+)?|1(\.0+)?)/)},reason:${reasonNode}}`;
}

export function serializeRouteGrammar(grammar: GrammarNode): unknown {
  return grammar.serialize();
}

export async function generateConstrainedRoute(params: {
  grammar: GrammarNode;
  prompt: string;
  sessionConfig?: GuidanceSessionConfig;
  runtime?: GuidanceRuntime;
}): Promise<ConstrainedRouteResult> {
  if (!params.sessionConfig) {
    return { available: false, route: undefined, errors: ['guidance session is not configured'] };
  }

  /* v8 ignore next -- default runtime requires a live Guidance session */
  const runtime = params.runtime ?? defaultRuntime;
  const session = new runtime.Session(params.sessionConfig.url);
  const generation = new runtime.Generation(session, params.prompt, runtime.str('').join(params.grammar));
  await generation.start();
  const schema = generation.getCapture('schema');
  const confidence = Number(generation.getCapture('confidence'));
  const reason = generation.getCapture('reason') as RouteReason;
  if (!schema || !Number.isFinite(confidence) || !reason) {
    return { available: true, route: undefined, errors: ['guidance generation did not capture a complete route'] };
  }
  return { available: true, route: { schema, confidence, reason }, errors: [] };
}

export async function validateWithGuidance(candidate: string, validate: (candidate: string) => string[] | Promise<string[]>): Promise<ValidationResult> {
  const errors = await validate(candidate);
  return { valid: errors.length === 0, errors };
}

export async function validateAndRetry(
  candidateFactory: () => Promise<string>,
  validate: (candidate: string) => ValidationResult | Promise<ValidationResult>,
  maxRetries = 2
): Promise<ValidationResult> {
  let retries = 0;
  while (retries <= maxRetries) {
    const candidate = await candidateFactory();
    const result = await validate(candidate);
    if (result.valid) {
      return result;
    }
    retries += 1;
  }

  return { valid: false, errors: ['validation failed after retries'] };
}
