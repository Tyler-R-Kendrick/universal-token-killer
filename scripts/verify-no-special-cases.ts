const FORBIDDEN = ['cli-specific', 'use-case-specific', 'hardcoded route'];

export function hasForbiddenSpecialCases(text: string): boolean {
  return FORBIDDEN.some((needle) => text.toLowerCase().includes(needle));
}
