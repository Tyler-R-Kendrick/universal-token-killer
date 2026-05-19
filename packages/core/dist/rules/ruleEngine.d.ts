export type RuleKind = 'constant' | 'homogeneous-array' | 'optional-field' | 'required-field' | 'enum-candidate' | 'format' | 'range' | 'cardinality' | 'free-text' | 'opaque';
export type Rule = {
    path: string;
    kind: RuleKind;
    confidence: number;
    evidenceCount: number;
    details?: Record<string, unknown>;
};
export declare function extractRules(schema: Record<string, unknown>, path?: string): Rule[];
export declare function validateRules(rules: Rule[]): Rule[];
