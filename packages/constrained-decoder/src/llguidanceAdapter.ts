import * as llguidance from 'transformers-llguidance';

export type ValidationResult = { valid: boolean; errors: string[] };

export async function validateWithLlguidance(grammar: string, candidate: string): Promise<ValidationResult> {
  const validate = (llguidance as { validate?: (grammar: string, candidate: string) => ValidationResult | Promise<ValidationResult> }).validate ?? fallbackValidate;
  const result = await validate(grammar, candidate);
  return normalizeValidationResult(result);
}

export async function validateAndRetry(grammar: string, candidateFactory: () => Promise<string>, maxRetries = 2): Promise<ValidationResult> {
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

function fallbackValidate(grammar: string, candidate: string): ValidationResult {
  if (!grammar.trim()) {
    return { valid: false, errors: ['empty grammar'] };
  }

  return { valid: candidate.trim().length > 0, errors: candidate.trim().length > 0 ? [] : ['empty candidate'] };
}

function normalizeValidationResult(result: ValidationResult): ValidationResult {
  return {
    valid: Boolean(result.valid),
    errors: result.errors.map(String)
  };
}
