export function hasNaturalLanguage(text: string): boolean {
  return /[A-Za-z]{2,}/.test(text);
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
