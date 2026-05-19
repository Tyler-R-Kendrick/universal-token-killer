export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function assertMaxPromptTokens(prompt: string, maxTokens = 700): boolean {
  return estimateTokens(prompt) <= maxTokens;
}

export function assertMaxOutputTokens(output: string, maxTokens = 32): boolean {
  return estimateTokens(output) <= maxTokens;
}

export function assertCompactResponse(response: string, maxChars = 400): boolean {
  return response.length <= maxChars;
}
