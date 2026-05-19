export type ValidationResult = {
    valid: boolean;
    errors: string[];
};
export declare function validateWithLlguidance(grammar: string, candidate: string): Promise<ValidationResult>;
export declare function validateAndRetry(grammar: string, candidateFactory: () => Promise<string>, maxRetries?: number): Promise<ValidationResult>;
