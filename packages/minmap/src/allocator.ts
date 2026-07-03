import { addMinMapEntry, minIdFor, type MinMap, type MinMapEntry, type MinMapEntryKind, type MinMapProvenance } from './format.js';
import { SINGLE_TOKEN_POOL } from './singleTokenPool.js';

export type AllocateOptions = {
  /** Identifiers that must not be allocated, e.g. short names already present in the source. */
  reserved?: ReadonlySet<string>;
};

export type AllocateEntryParams = {
  pretty: string;
  kind: MinMapEntryKind;
  provenance: MinMapProvenance;
  source?: string;
} & AllocateOptions;

export type AllocatedEntry = {
  map: MinMap;
  entry: MinMapEntry;
};

export function allocateMinId(map: MinMap, options: AllocateOptions = {}): string {
  const reserved = options.reserved ?? new Set<string>();
  const used = new Set<string>();
  for (const entry of map.entries) {
    used.add(entry.minId);
    used.add(entry.pretty);
  }
  for (const candidate of SINGLE_TOKEN_POOL) {
    if (!used.has(candidate) && !reserved.has(candidate)) {
      return candidate;
    }
  }
  throw new Error(`Min-id pool exhausted for language '${map.language}'`);
}

export function allocateEntry(map: MinMap, params: AllocateEntryParams): AllocatedEntry {
  const existingMinId = minIdFor(map, params.pretty);
  if (existingMinId !== undefined) {
    const entry = map.entries.find((candidate) => candidate.minId === existingMinId)!;
    return { map, entry };
  }
  const minId = allocateMinId(map, params.reserved !== undefined ? { reserved: params.reserved } : {});
  const entry: MinMapEntry = {
    minId,
    pretty: params.pretty,
    kind: params.kind,
    provenance: params.provenance,
    ...(params.source !== undefined ? { source: params.source } : {})
  };
  return { map: addMinMapEntry(map, entry), entry };
}
