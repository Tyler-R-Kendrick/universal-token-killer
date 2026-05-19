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
export function assertAllowedRuleKindsOnly(rules) {
    return rules.every((rule) => ALLOWED_RULE_KINDS.has(rule.kind));
}
export function assertRouteGrammarMatch(route) {
    return /^route\{schema:"[^"]+",confidence:(0(\.\d+)?|1(\.0+)?),reason:(shape_match|input_match|tool_match|prior_match|fallback|unknown)\}$/.test(route.trim());
}
export function assertNoForbiddenSpecialCaseStrings(text) {
    return !/\b(kubectl|terraform|docker|npm|pip|aws|gcp|azure|command-specific|use-case-specific)\b/i.test(text);
}
