const ALLOWED_KINDS = new Set([
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
const FORBIDDEN_PATTERN = /(npm|pip|docker|kubectl|terraform|aws|gcp|azure|cli|command)/i;
export function extractRules(schema, path = '$') {
    const rules = [];
    const type = schema.type;
    if (type === 'object') {
        const required = Array.isArray(schema.required) ? schema.required.filter((item) => typeof item === 'string') : [];
        for (const key of required) {
            rules.push({ path: `${path}.${key}`, kind: 'required-field', confidence: 1, evidenceCount: 1 });
        }
        const properties = schema.properties;
        if (properties && typeof properties === 'object') {
            for (const [key, nested] of Object.entries(properties)) {
                rules.push(...extractRules(nested, `${path}.${key}`));
            }
        }
    }
    if (type === 'array') {
        rules.push({ path, kind: 'cardinality', confidence: 1, evidenceCount: 1, details: { minItems: schema.minItems, maxItems: schema.maxItems } });
    }
    if (type === 'string' && schema.format) {
        rules.push({ path, kind: 'format', confidence: 1, evidenceCount: 1, details: { format: schema.format } });
    }
    return validateRules(rules);
}
export function validateRules(rules) {
    return rules.filter((rule) => ALLOWED_KINDS.has(rule.kind) && !FORBIDDEN_PATTERN.test(JSON.stringify(rule.details ?? {})));
}
