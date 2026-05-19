import { createHash } from 'node:crypto';
export function stableStringify(value) {
    return JSON.stringify(sortValue(value), null, 2);
}
export function canonicalJson(value) {
    return `${stableStringify(value)}\n`;
}
export function contentHash(value, length = 10) {
    return createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : stableStringify(value)).digest('hex').slice(0, length);
}
export function sortValue(value) {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }
    if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
        const sorted = {};
        for (const key of Object.keys(value).sort()) {
            sorted[key] = sortValue(value[key]);
        }
        return sorted;
    }
    return value;
}
