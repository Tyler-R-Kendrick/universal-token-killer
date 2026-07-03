export { estimateTokens } from '@utk/foundation';

export function hasNaturalLanguage(text: string): boolean {
  return /[A-Za-z]{2,}/.test(text);
}
