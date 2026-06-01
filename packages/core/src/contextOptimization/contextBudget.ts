export type ContextBudgetDecision = {
  inputTokens: number;
  reservedOutputTokens: number;
  availableInputTokens: number;
  pressure: number;
  shouldCompactHistory: boolean;
  routeReason: 'history-summary' | 'budget-ok' | 'cheap-model-bypass';
};

export class ContextBudgetManager {
  constructor(private readonly options: {
    maxContextTokens: number;
    reserveOutputTokens: number;
    historyCompactionThreshold: number;
    cheapModelPatterns?: string[];
  }) {}

  evaluate(params: { inputTokens: number; model: string }): ContextBudgetDecision {
    const availableInputTokens = Math.max(0, this.options.maxContextTokens - this.options.reserveOutputTokens);
    const pressureValue = pressure(params.inputTokens, this.options.reserveOutputTokens, this.options.maxContextTokens);
    if ((this.options.cheapModelPatterns ?? []).some((pattern) => matchesPattern(pattern, params.model))) {
      return {
        inputTokens: params.inputTokens,
        reservedOutputTokens: this.options.reserveOutputTokens,
        availableInputTokens,
        pressure: pressureValue,
        shouldCompactHistory: false,
        routeReason: 'cheap-model-bypass'
      };
    }
    const shouldCompactHistory = pressureValue >= this.options.historyCompactionThreshold;
    return {
      inputTokens: params.inputTokens,
      reservedOutputTokens: this.options.reserveOutputTokens,
      availableInputTokens,
      pressure: pressureValue,
      shouldCompactHistory,
      routeReason: shouldCompactHistory ? 'history-summary' : 'budget-ok'
    };
  }
}

function pressure(inputTokens: number, reserveOutputTokens: number, maxContextTokens: number): number {
  return maxContextTokens <= 0 ? 1 : Number(((inputTokens + reserveOutputTokens) / maxContextTokens).toFixed(3));
}

function matchesPattern(pattern: string, value: string): boolean {
  return pattern.endsWith('*') ? value.startsWith(pattern.slice(0, -1)) : pattern === value;
}
