import { schemaIdFor } from '../artifact/manifest.js';

export type SchemaState = 'current' | 'candidate' | 'historical' | 'validated' | 'quarantined';

export type VersionedSchema = {
  id: string;
  version: number;
  state: SchemaState;
  schema: Record<string, unknown>;
  rules: unknown[];
};

export type MergeDecision = {
  action: 'update-current' | 'new-version';
  schema: VersionedSchema;
  reason: 'compatible-broadened' | 'material-contract-change' | 'initial';
};

export function mergeSchema(normalizedToolId: string, current: VersionedSchema | undefined, candidateSchema: Record<string, unknown>, rules: unknown[]): MergeDecision {
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

export function isCompatible(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  if (left.type !== right.type) return false;
  if (left.type === 'object') {
    const leftKeys = Object.keys((left.properties as Record<string, unknown> | undefined) ?? {});
    const rightKeys = Object.keys((right.properties as Record<string, unknown> | undefined) ?? {});
    return leftKeys.every((key) => rightKeys.includes(key)) || rightKeys.every((key) => leftKeys.includes(key));
  }
  if (left.type === 'array' && right.type === 'array') return true;
  return true;
}

function broadenSchema(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  if (left.type !== 'object' || right.type !== 'object') return right;
  const leftProps = (left.properties as Record<string, unknown> | undefined) ?? {};
  const rightProps = (right.properties as Record<string, unknown> | undefined) ?? {};
  const properties = { ...leftProps, ...rightProps };
  const leftRequired = Array.isArray(left.required) ? left.required : [];
  const rightRequired = Array.isArray(right.required) ? right.required : [];
  const required = leftRequired.filter((key) => rightRequired.includes(key)).sort();
  return { ...right, properties, required, additionalProperties: true };
}
