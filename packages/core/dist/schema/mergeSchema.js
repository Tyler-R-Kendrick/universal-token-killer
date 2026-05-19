import { schemaIdFor } from '../artifact/manifest.js';
export function mergeSchema(normalizedToolId, current, candidateSchema, rules) {
    if (!current) {
        const version = 1;
        return { action: 'new-version', reason: 'initial', schema: { id: schemaIdFor(normalizedToolId, version, candidateSchema, rules), version, state: 'candidate', schema: candidateSchema, rules } };
    }
    if (isCompatible(current.schema, candidateSchema)) {
        const merged = broadenSchema(current.schema, candidateSchema);
        return { action: 'update-current', reason: 'compatible-broadened', schema: { id: schemaIdFor(normalizedToolId, current.version, merged, rules), version: current.version, state: 'candidate', schema: merged, rules } };
    }
    const version = current.version + 1;
    return { action: 'new-version', reason: 'material-contract-change', schema: { id: schemaIdFor(normalizedToolId, version, candidateSchema, rules), version, state: 'candidate', schema: candidateSchema, rules } };
}
export function isCompatible(left, right) {
    if (left.type !== right.type)
        return false;
    if (left.type === 'object') {
        const leftKeys = Object.keys(left.properties ?? {});
        const rightKeys = Object.keys(right.properties ?? {});
        return leftKeys.every((key) => rightKeys.includes(key)) || rightKeys.every((key) => leftKeys.includes(key));
    }
    if (left.type === 'array' && right.type === 'array')
        return true;
    return true;
}
function broadenSchema(left, right) {
    if (left.type !== 'object' || right.type !== 'object')
        return right;
    const leftProps = left.properties ?? {};
    const rightProps = right.properties ?? {};
    const properties = { ...leftProps, ...rightProps };
    const leftRequired = Array.isArray(left.required) ? left.required : [];
    const rightRequired = Array.isArray(right.required) ? right.required : [];
    const required = leftRequired.filter((key) => rightRequired.includes(key)).sort();
    return { ...right, properties, required, additionalProperties: true };
}
