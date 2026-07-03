/** One human-readable check contributing to a grader's verdict. */
export type GraderAssertion = { text: string; passed: boolean };

/**
 * The AgentV grader result shape (stdin/stdout `type: script` contract):
 * `{ score, assertions: [{ text, passed }], reasoning }`. `metrics` is an
 * optional UTK extension carrying the raw numbers behind the score.
 */
export type GraderResult = {
  score: number;
  assertions: GraderAssertion[];
  reasoning: string;
  metrics?: Record<string, number>;
};

/**
 * What an arm produces for a case. `visibleText` is the model-visible chat
 * surface (what token cost is charged against); `recoverableText` is everything
 * the agent can still reach (chat + any stored/compact artifact) and is where
 * fact retention is checked. For raw and lossy-in-chat competitors the two are
 * equal; UTK keeps `visibleText` tiny while leaving facts recoverable.
 */
export type ArmOutput = {
  visibleText: string;
  recoverableText: string;
};

/** Quality dimensions a judge scores, each in [0, 1]. */
export type JudgeScores = {
  relevance: number;
  accuracy: number;
  groundedness: number;
};

export type JudgeRequest = {
  prompt: string;
  visibleText: string;
  recoverableText: string;
  requiredFacts: string[];
  irrelevantFacts: string[];
};

/**
 * A judge scores the quality of a compaction. The default {@link referenceJudge}
 * is deterministic so committed results are reproducible offline; a real model
 * judge can be injected through the harness `configureModel` hook.
 */
export type Judge = (request: JudgeRequest) => JudgeScores | Promise<JudgeScores>;

/** Deterministic reference judge: derives quality purely from fact bookkeeping. */
export const referenceJudge: Judge = (request) => {
  const accuracy = retentionRatio(request.requiredFacts, request.recoverableText);
  const relevance = request.irrelevantFacts.length === 0
    ? 1
    : exclusionRatio(request.irrelevantFacts, request.visibleText);
  // The reference judge cannot read intent, so it treats verbatim retention of
  // required facts as the proxy for groundedness. A model judge would refine this.
  const groundedness = retentionRatio(request.requiredFacts, request.recoverableText);
  return { relevance, accuracy, groundedness };
};

export function retentionRatio(facts: string[], text: string): number {
  if (facts.length === 0) return 1;
  const kept = facts.filter((fact) => text.includes(fact)).length;
  return kept / facts.length;
}

export function exclusionRatio(facts: string[], text: string): number {
  if (facts.length === 0) return 1;
  const dropped = facts.filter((fact) => !text.includes(fact)).length;
  return dropped / facts.length;
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/* ---- AgentV script-grader CLI bridge ---------------------------------- */

/**
 * The stdin payload AgentV hands a `type: script` grader. UTK packs the case
 * metadata (raw output + required/irrelevant facts) into `expected_output` as
 * JSON and the arm's `{ visible, recoverable }` surface into `output`.
 */
export type AgentVGraderInput = {
  input?: Array<{ role: string; content: string }> | string;
  expected_output?: string;
  output?: string;
};

export type ExpectedPayload = {
  prompt?: string;
  rawOutput?: string;
  requiredFacts?: string[];
  irrelevantFacts?: string[];
};

export type ActualPayload = {
  visible?: string;
  recoverable?: string;
};

export function parseExpected(text: string | undefined): ExpectedPayload {
  return safeParse<ExpectedPayload>(text) ?? {};
}

export function parseActual(text: string | undefined): { visibleText: string; recoverableText: string } {
  const parsed = safeParse<ActualPayload>(text);
  if (parsed && typeof parsed === 'object' && (typeof parsed.visible === 'string' || typeof parsed.recoverable === 'string')) {
    const visible = parsed.visible ?? '';
    return { visibleText: visible, recoverableText: parsed.recoverable ?? visible };
  }
  const raw = text ?? '';
  return { visibleText: raw, recoverableText: raw };
}

export function promptFromInput(input: AgentVGraderInput['input']): string {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) {
    return input
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n');
  }
  return '';
}

function safeParse<T>(text: string | undefined): T | undefined {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** Wire a grader function up to the AgentV stdin/stdout protocol. */
export function runGraderCli(grade: (input: AgentVGraderInput) => GraderResult | Promise<GraderResult>): void {
  let stdin = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    stdin += chunk;
  });
  process.stdin.on('end', () => {
    void (async () => {
      try {
        const input = stdin.trim() ? (JSON.parse(stdin) as AgentVGraderInput) : {};
        const result = await grade(input);
        process.stdout.write(`${JSON.stringify(result)}\n`);
      } catch (error) {
        process.stderr.write(`${(error as Error).message}\n`);
        process.exitCode = 1;
      }
    })();
  });
}
