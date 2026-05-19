export async function validateWithLlguidance(grammar, candidate) {
    try {
        const moduleName = 'llguidance.ts';
        const llguidance = await import(moduleName);
        const result = await llguidance.validate?.(grammar, candidate);
        if (!result) {
            return { valid: false, errors: ['llguidance.ts returned no result'] };
        }
        return {
            valid: Boolean(result.valid),
            errors: Array.isArray(result.errors) ? result.errors.map(String) : []
        };
    }
    catch {
        return fallbackValidate(grammar, candidate);
    }
}
export async function validateAndRetry(grammar, candidateFactory, maxRetries = 2) {
    let retries = 0;
    while (retries <= maxRetries) {
        const candidate = await candidateFactory();
        const result = await validateWithLlguidance(grammar, candidate);
        if (result.valid) {
            return result;
        }
        retries += 1;
    }
    return { valid: false, errors: ['validation failed after retries'] };
}
function fallbackValidate(grammar, candidate) {
    if (!grammar.trim()) {
        return { valid: false, errors: ['empty grammar'] };
    }
    return { valid: candidate.trim().length > 0, errors: candidate.trim().length > 0 ? [] : ['empty candidate'] };
}
