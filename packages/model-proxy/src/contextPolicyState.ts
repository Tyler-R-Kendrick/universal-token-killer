import type { ContextArtifact } from './recovery.js';
import type { ToolOutputCompactionResult } from './toolOutputCompaction.js';

export type PolicyState = {
  artifacts: ContextArtifact[];
  artifactContents: string[];
  routeReasons: Set<string>;
  rawTokens: number;
  compactTokens: number;
  promptTokensBefore: number;
  promptTokensAfter: number;
  toolSchemaTokensBefore: number;
  toolSchemaTokensAfter: number;
  toolDiscoveryTokensBefore: number;
  toolDiscoveryTokensAfter: number;
  cacheVolatilityFindings: number;
  promptArtifacts: Array<{ id: string; path: string; surface: string }>;
};

export type PromptSurfacePolicyResult = {
  before: number;
  after: number;
  applied: number;
  cacheVolatilityFindings: number;
  artifacts: Array<{ id: string; path: string; surface: string }>;
};

export type TokenDelta = {
  beforeTokens: number;
  afterTokens: number;
};

export type ToolDiscoveryPolicyResult = TokenDelta & {
  routeReason?: string;
};

export type PolicyStateMetrics = {
  rawTokens: number;
  compactTokens: number;
  promptTokensBefore: number;
  promptTokensAfter: number;
  routeReasons: string[];
  toolSchemaTokensBefore: number;
  toolSchemaTokensAfter: number;
  customToolOverheadTokens: number;
  builtinVsCustomTokenRatio: number;
  toolDiscoveryTokensBefore: number;
  toolDiscoveryTokensAfter: number;
  cacheVolatilityFindings: number;
};

export function createPolicyState(): PolicyState {
  return {
    artifacts: [],
    artifactContents: [],
    routeReasons: new Set<string>(),
    rawTokens: 0,
    compactTokens: 0,
    promptTokensBefore: 0,
    promptTokensAfter: 0,
    toolSchemaTokensBefore: 0,
    toolSchemaTokensAfter: 0,
    toolDiscoveryTokensBefore: 0,
    toolDiscoveryTokensAfter: 0,
    cacheVolatilityFindings: 0,
    promptArtifacts: []
  };
}

export function mergePromptSurfacePolicy(state: PolicyState, result: PromptSurfacePolicyResult): void {
  state.promptTokensBefore += result.before;
  state.promptTokensAfter += result.after;
  state.cacheVolatilityFindings += result.cacheVolatilityFindings;
  state.promptArtifacts.push(...result.artifacts);
  if (result.applied > 0) state.routeReasons.add('prompt-compression-model');
}

export function mergeToolCompaction(state: PolicyState, result: ToolOutputCompactionResult): void {
  state.artifacts.push(...result.artifacts);
  state.artifactContents.push(...result.rawContents);
  state.rawTokens += result.rawTokens;
  state.compactTokens += result.compactTokens;
  result.routeReasons.forEach((reason) => state.routeReasons.add(reason));
}

export function mergeToolDiscovery(state: PolicyState, result: ToolDiscoveryPolicyResult): void {
  state.toolDiscoveryTokensBefore = result.beforeTokens;
  state.toolDiscoveryTokensAfter = result.afterTokens;
  if (result.routeReason) state.routeReasons.add(result.routeReason);
}

export function mergeToolSchemaMetrics(state: PolicyState, result: TokenDelta): void {
  state.toolSchemaTokensBefore = result.beforeTokens;
  state.toolSchemaTokensAfter = result.afterTokens;
}

export function shouldRecordSurfaceMetrics(state: PolicyState): boolean {
  return state.promptTokensBefore > state.promptTokensAfter ||
    state.toolDiscoveryTokensBefore > state.toolDiscoveryTokensAfter ||
    state.cacheVolatilityFindings > 0 ||
    state.routeReasons.has('history-summary');
}

export function surfaceMetricsRouteReason(state: PolicyState): string {
  if (state.routeReasons.has('tool-discovery')) return 'tool-discovery';
  if (state.routeReasons.has('history-summary')) return 'history-summary';
  return 'prompt-surface';
}

export function policyStateMetrics(state: PolicyState): PolicyStateMetrics {
  return {
    rawTokens: state.rawTokens,
    compactTokens: state.compactTokens,
    promptTokensBefore: state.promptTokensBefore,
    promptTokensAfter: state.promptTokensAfter,
    routeReasons: [...state.routeReasons],
    toolSchemaTokensBefore: state.toolSchemaTokensBefore,
    toolSchemaTokensAfter: state.toolSchemaTokensAfter,
    customToolOverheadTokens: Math.max(0, state.toolSchemaTokensAfter - state.toolSchemaTokensBefore),
    builtinVsCustomTokenRatio: state.toolSchemaTokensBefore === 0 ? 1 : Number((state.toolSchemaTokensAfter / state.toolSchemaTokensBefore).toFixed(3)),
    toolDiscoveryTokensBefore: state.toolDiscoveryTokensBefore,
    toolDiscoveryTokensAfter: state.toolDiscoveryTokensAfter,
    cacheVolatilityFindings: state.cacheVolatilityFindings
  };
}
