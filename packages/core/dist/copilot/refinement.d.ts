export type StructuralModelProvider = {
    completeStructural(prompt: StructuralPrompt): Promise<string>;
};
export type StructuralPrompt = {
    task: 'schema-refinement' | 'rule-generalization' | 'schema-routing';
    artifacts: Record<string, unknown>;
    maxOutputTokens: number;
};
export declare function refineSchemaWithCopilot(provider: StructuralModelProvider, candidateSchema: Record<string, unknown>, rules: unknown[]): Promise<Record<string, unknown>>;
export declare function routeWithCopilot(provider: StructuralModelProvider, routeMetadata: Record<string, unknown>): Promise<string>;
