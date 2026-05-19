const FORBIDDEN = [
  'hardcoded schema',
  'hardcoded route',
  'command-specific optimization',
  'use-case-specific optimization',
  'cli-specific optimization'
];

export function hasForbiddenSpecialCases(text: string): boolean {
  const normalized = text.toLowerCase();
  return FORBIDDEN.some((needle) => normalized.includes(needle));
}

export function assertNoForbiddenSpecialCases(text: string): void {
  if (hasForbiddenSpecialCases(text)) {
    throw new Error('Forbidden special-case optimization detected');
  }
}
