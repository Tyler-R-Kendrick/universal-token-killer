export type RouteReason = 'shape_match' | 'input_match' | 'tool_match' | 'prior_match' | 'fallback' | 'unknown';
export type RouteDecision = {
    schema: string;
    confidence: number;
    reason: RouteReason;
};
export type RouteCandidate = {
    schema: string;
    toolId: string;
    inputFingerprint?: string;
    shapeFingerprint?: string;
    fieldFingerprint?: string;
    priorCount?: number;
};
export type RoutePrompt = {
    prompt: string;
    promptTokens: number;
    candidates: RouteCandidate[];
};
export declare function deterministicRoute(schemaIds: string[], inputHash: string): RouteDecision;
export declare function routeFromCandidates(toolId: string, input: unknown, shape: unknown, candidates: RouteCandidate[]): RouteDecision;
export declare function buildRouterPrompt(toolId: string, inputKeys: string[], shapeFingerprint: string, fieldFingerprint: string, candidates: RouteCandidate[], maxCandidates?: number): RoutePrompt;
export declare function estimateTokens(text: string): number;
