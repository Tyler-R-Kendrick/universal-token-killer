export type EvalSetTextPart = { text: string };
export type EvalSetContent = { role: 'user' | 'model'; parts: EvalSetTextPart[] };
export type EvalSetToolUse = { name: string; id: string; args: unknown };
export type EvalSetToolResponse = { name: string; id: string; response: string };
export type Invocation = {
  invocation_id: string;
  user_content: EvalSetContent;
  final_response: EvalSetContent;
  intermediate_data: {
    tool_uses: EvalSetToolUse[];
    tool_responses: EvalSetToolResponse[];
  };
};
export type EvalCase = { eval_id: string; conversation: Invocation[] };
export type EvalSet = { eval_set_id: string; name: string; eval_cases: EvalCase[] };

export type EvaluatorInput = {
  protocol_version: '1.0';
  metric_name: string;
  threshold: number;
  config: Record<string, unknown>;
  invocations: Invocation[];
};

export type EvaluatorOutput = {
  score: number;
  status: 'PASSED' | 'FAILED';
  per_invocation_scores: number[];
  details: { reason: string } & Record<string, unknown>;
};

export type Evaluator = {
  metricName: string;
  description: string;
  rubric: string[];
  evaluate(input: EvaluatorInput): Promise<EvaluatorOutput>;
};

export type Scorecard = {
  eval_set_id: string;
  results: Array<{
    eval_id: string;
    overall_score: number;
    metrics: Record<string, number>;
    status: 'PASSED' | 'FAILED';
  }>;
};
