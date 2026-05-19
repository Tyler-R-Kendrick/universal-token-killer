export type SchemaState = 'current' | 'candidate' | 'historical' | 'validated' | 'quarantined';
export type VersionedSchema = {
    id: string;
    version: number;
    state: SchemaState;
    schema: Record<string, unknown>;
    rules: unknown[];
};
export type MergeDecision = {
    action: 'update-current' | 'new-version';
    schema: VersionedSchema;
    reason: 'compatible-broadened' | 'material-contract-change' | 'initial';
};
export declare function mergeSchema(normalizedToolId: string, current: VersionedSchema | undefined, candidateSchema: Record<string, unknown>, rules: unknown[]): MergeDecision;
export declare function isCompatible(left: Record<string, unknown>, right: Record<string, unknown>): boolean;
