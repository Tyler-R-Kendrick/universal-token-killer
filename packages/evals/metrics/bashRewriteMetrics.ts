import { estimateTokens } from '../assertions/tokenBudgets.js';

export type BashRewriteFixture = {
  name: string;
  request: string;
  expectedCommand: string;
  expectedArgv: string[];
  rtkBaselineTokens: number;
};

export type BashRewriteMeasurementInput = {
  fixture: BashRewriteFixture;
  actualCommand: string;
  actualArgv: string[];
  templateText: string;
};

export type BashRewriteMetrics = {
  name: string;
  exactInvocationMatch: boolean;
  argumentAccuracyScore: number;
  utkTemplateTokens: number;
  rtkBaselineTokens: number;
  utkVsRtkTokenDelta: number;
  utkVsRtkTokenRatio: number;
};

export type BashRewriteAssertion = {
  passed: boolean;
  failures: string[];
  metrics: BashRewriteMetrics;
};

export function measureBashRewrite(input: BashRewriteMeasurementInput): BashRewriteMetrics {
  const utkTemplateTokens = estimateTokens(input.templateText);
  return {
    name: input.fixture.name,
    exactInvocationMatch: input.actualCommand === input.fixture.expectedCommand,
    argumentAccuracyScore: argumentAccuracyScore(input.actualArgv, input.fixture.expectedArgv),
    utkTemplateTokens,
    rtkBaselineTokens: input.fixture.rtkBaselineTokens,
    utkVsRtkTokenDelta: input.fixture.rtkBaselineTokens - utkTemplateTokens,
    utkVsRtkTokenRatio: input.fixture.rtkBaselineTokens === 0 ? 0 : utkTemplateTokens / input.fixture.rtkBaselineTokens
  };
}

export function assertBashRewrite(input: BashRewriteMeasurementInput): BashRewriteAssertion {
  const metrics = measureBashRewrite(input);
  const failures: string[] = [];
  if (!metrics.exactInvocationMatch) {
    failures.push(`${metrics.name}: expected ${input.fixture.expectedCommand}, got ${input.actualCommand}`);
  }
  if (metrics.argumentAccuracyScore !== 1) {
    failures.push(`${metrics.name}: argumentAccuracyScore=${metrics.argumentAccuracyScore}`);
  }
  if (metrics.utkTemplateTokens >= metrics.rtkBaselineTokens) {
    failures.push(`${metrics.name}: utkTemplateTokens=${metrics.utkTemplateTokens} must be strictly less than rtkBaselineTokens=${metrics.rtkBaselineTokens}`);
  }
  return { passed: failures.length === 0, failures, metrics };
}

function argumentAccuracyScore(actual: string[], expected: string[]): number {
  if (expected.length === 0) return actual.length === 0 ? 1 : 0;
  const matches = expected.filter((arg, index) => actual[index] === arg).length;
  return matches / expected.length;
}
