import { decode } from '@toon-format/toon';

const ALLOWED_RULE_KINDS = new Set([
  'constant',
  'homogeneous-array',
  'optional-field',
  'required-field',
  'enum-candidate',
  'format',
  'range',
  'cardinality',
  'free-text',
  'opaque'
]);

export function assertAllowedRuleKindsOnly(rules: Array<{ kind: string }>): boolean {
  return rules.every((rule) => ALLOWED_RULE_KINDS.has(rule.kind));
}

export function assertRouteGrammarMatch(route: string): boolean {
  try {
    const decoded = decode(route) as { route?: { schema?: unknown; confidence?: unknown; reason?: unknown } };
    return (
      typeof decoded.route?.schema === 'string' &&
      typeof decoded.route.confidence === 'number' &&
      decoded.route.confidence >= 0 &&
      decoded.route.confidence <= 1 &&
      typeof decoded.route.reason === 'string' &&
      ['shape_match', 'input_match', 'tool_match', 'prior_match', 'fallback', 'unknown'].includes(decoded.route.reason)
    );
  } catch {
    return false;
  }
}

export function assertNoForbiddenSpecialCaseStrings(text: string): boolean {
  return !/\b(kubectl|terraform|docker|npm|pip|aws|gcp|azure|command-specific|use-case-specific)\b/i.test(text);
}
