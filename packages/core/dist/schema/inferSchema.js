export function inferSchema(value) {
    if (value === null)
        return { type: 'null' };
    if (typeof value === 'boolean')
        return { type: 'boolean' };
    if (typeof value === 'number')
        return { type: Number.isInteger(value) ? 'integer' : 'number' };
    if (typeof value === 'string')
        return inferStringSchema(value);
    if (Array.isArray(value)) {
        const itemSchemas = value.map((item) => inferSchema(item));
        const unique = dedupe(itemSchemas);
        return {
            type: 'array',
            minItems: value.length,
            maxItems: value.length,
            items: unique.length === 1 ? unique[0] : { anyOf: unique }
        };
    }
    if (isObject(value)) {
        const properties = {};
        const required = [];
        for (const [key, item] of Object.entries(value)) {
            properties[key] = inferSchema(item);
            required.push(key);
        }
        return {
            type: 'object',
            properties,
            required: required.sort(),
            additionalProperties: true
        };
    }
    return { type: 'string' };
}
export function inferTextPseudoSchema(text) {
    const lines = text.split(/\r?\n/);
    const prefix = lines.length > 0 ? longestCommonPrefix(lines.filter(Boolean)) : '';
    const suffix = lines.length > 0 ? longestCommonSuffix(lines.filter(Boolean)) : '';
    return {
        type: 'text-pseudo-schema-envelope',
        lineCount: lines.length,
        stablePrefix: prefix,
        stableSuffix: suffix,
        avgLineLength: lines.length === 0 ? 0 : Math.round(lines.reduce((sum, line) => sum + line.length, 0) / lines.length),
        opaque: lines.length <= 1 && !prefix && !suffix
    };
}
function inferStringSchema(value) {
    if (/^https?:\/\//.test(value))
        return { type: 'string', format: 'uri' };
    if (/^\d{4}-\d{2}-\d{2}$/.test(value))
        return { type: 'string', format: 'date' };
    if (/^\d{4}-\d{2}-\d{2}T/.test(value))
        return { type: 'string', format: 'date-time' };
    if (looksLikeEmail(value))
        return { type: 'string', format: 'email' };
    return { type: 'string', minLength: value.length, maxLength: value.length };
}
function looksLikeEmail(value) {
    if (value.includes(' ') || !value.includes('@')) {
        return false;
    }
    const parts = value.split('@');
    if (parts.length !== 2) {
        return false;
    }
    const [local, domain] = parts;
    if (!local || !domain || domain.startsWith('.') || domain.endsWith('.')) {
        return false;
    }
    return domain.includes('.');
}
function dedupe(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        const key = JSON.stringify(item);
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push(item);
    }
    return result;
}
function isObject(value) {
    return typeof value === 'object' && value !== null;
}
function longestCommonPrefix(values) {
    if (values.length === 0)
        return '';
    let prefix = values[0] ?? '';
    for (const value of values.slice(1)) {
        while (!value.startsWith(prefix) && prefix) {
            prefix = prefix.slice(0, -1);
        }
    }
    return prefix;
}
function longestCommonSuffix(values) {
    if (values.length === 0)
        return '';
    let suffix = values[0] ?? '';
    for (const value of values.slice(1)) {
        while (!value.endsWith(suffix) && suffix) {
            suffix = suffix.slice(1);
        }
    }
    return suffix;
}
