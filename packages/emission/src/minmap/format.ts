import { canonicalJson, contentHash } from '@utk/core';

export const MIN_MAP_VERSION = 1;

export const MIN_MAP_ENTRY_KINDS = ['ident', 'macro', 'keyword'] as const;
export type MinMapEntryKind = (typeof MIN_MAP_ENTRY_KINDS)[number];

export const MIN_MAP_PROVENANCES = ['codebase', 'stdlib', 'new'] as const;
export type MinMapProvenance = (typeof MIN_MAP_PROVENANCES)[number];

export type MinMapEntry = {
  minId: string;
  pretty: string;
  kind: MinMapEntryKind;
  provenance: MinMapProvenance;
  source?: string;
};

export type MinMap = {
  version: typeof MIN_MAP_VERSION;
  language: string;
  entries: MinMapEntry[];
};

export const MIN_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,2}$/;

export function createMinMap(language: string): MinMap {
  if (typeof language !== 'string' || language.length === 0) {
    throw new Error('Min map requires a non-empty language id');
  }
  return { version: MIN_MAP_VERSION, language, entries: [] };
}

export function addMinMapEntry(map: MinMap, entry: MinMapEntry): MinMap {
  validateEntry(entry);
  if (map.entries.some((existing) => existing.minId === entry.minId)) {
    throw new Error(`Min map minId '${entry.minId}' already mapped`);
  }
  if (map.entries.some((existing) => existing.pretty === entry.pretty)) {
    throw new Error(`Min map pretty '${entry.pretty}' already mapped`);
  }
  const entries = [...map.entries, { ...entry }].sort((left, right) => left.minId.localeCompare(right.minId));
  return { ...map, entries };
}

export function prettyFor(map: MinMap, minId: string): string | undefined {
  return map.entries.find((entry) => entry.minId === minId)?.pretty;
}

export function minIdFor(map: MinMap, pretty: string): string | undefined {
  return map.entries.find((entry) => entry.pretty === pretty)?.minId;
}

export function serializeMinMap(map: MinMap): string {
  return canonicalJson(map);
}

export function minMapHash(map: MinMap): string {
  return contentHash(map, 16);
}

export function parseMinMap(text: string): MinMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Min map is not valid JSON: ${(error as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Min map must be a JSON object');
  }
  const candidate = parsed as Partial<MinMap>;
  if (candidate.version !== MIN_MAP_VERSION) {
    throw new Error(`Min map version must be ${MIN_MAP_VERSION}`);
  }
  if (typeof candidate.language !== 'string' || candidate.language.length === 0) {
    throw new Error('Min map requires a non-empty language id');
  }
  if (!Array.isArray(candidate.entries)) {
    throw new Error('Min map entries must be an array');
  }
  let map = createMinMap(candidate.language);
  for (const entry of candidate.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Min map entry must be an object');
    }
    map = addMinMapEntry(map, entry as MinMapEntry);
  }
  return map;
}

function validateEntry(entry: MinMapEntry): void {
  if (typeof entry.minId !== 'string' || !MIN_ID_PATTERN.test(entry.minId)) {
    throw new Error(`Min map entry minId '${String(entry.minId)}' must match ${MIN_ID_PATTERN}`);
  }
  if (typeof entry.pretty !== 'string' || entry.pretty.length === 0) {
    throw new Error(`Min map entry '${entry.minId}' requires a non-empty pretty name`);
  }
  if (!MIN_MAP_ENTRY_KINDS.includes(entry.kind)) {
    throw new Error(`Min map entry '${entry.minId}' has unsupported kind '${String(entry.kind)}'`);
  }
  if (!MIN_MAP_PROVENANCES.includes(entry.provenance)) {
    throw new Error(`Min map entry '${entry.minId}' has unsupported provenance '${String(entry.provenance)}'`);
  }
}
