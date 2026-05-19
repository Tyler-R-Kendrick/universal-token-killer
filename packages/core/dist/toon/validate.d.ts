export type ToonPairValidation = {
    valid: boolean;
    regenerated?: string;
    errors: string[];
};
export declare function validateCanonicalToonPair(schema: Record<string, unknown>, toon: string): ToonPairValidation;
