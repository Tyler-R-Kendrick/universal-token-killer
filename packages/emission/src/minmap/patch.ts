import {
  addMinMapEntry,
  MIN_MAP_ENTRY_KINDS,
  type MinMap,
  type MinMapEntryKind
} from './format.js';
import { MINMAP_PATCH_LINE_PATTERN } from './patchGrammar.js';

export type MinMapPatchOp =
  | { op: 'add'; minId: string; pretty: string; kind: MinMapEntryKind }
  | { op: 'remove'; minId: string }
  | { op: 'rename'; minId: string; pretty: string };

export function parseMinMapPatch(text: string): MinMapPatchOp[] {
  const ops: MinMapPatchOp[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    if (!MINMAP_PATCH_LINE_PATTERN.test(line)) {
      throw new Error(`Malformed min-map patch line '${rawLine}'`);
    }
    const parts = line.split(' ');
    if (parts[0] === '+') {
      const kindToken = parts[3];
      const kind = kindToken === undefined ? 'ident' : kindToken.slice(1);
      if (!MIN_MAP_ENTRY_KINDS.includes(kind as MinMapEntryKind)) {
        throw new Error(`Min-map patch line '${rawLine}' has unsupported kind '${kind}'`);
      }
      ops.push({ op: 'add', minId: parts[1]!, pretty: parts[2]!, kind: kind as MinMapEntryKind });
    } else if (parts[0] === '-') {
      ops.push({ op: 'remove', minId: parts[1]! });
    } else {
      ops.push({ op: 'rename', minId: parts[1]!, pretty: parts[2]! });
    }
  }
  return ops;
}

export function serializeMinMapPatch(ops: MinMapPatchOp[]): string {
  return ops
    .map((op) => {
      if (op.op === 'add') {
        return op.kind === 'ident' ? `+ ${op.minId} ${op.pretty}` : `+ ${op.minId} ${op.pretty} @${op.kind}`;
      }
      if (op.op === 'remove') {
        return `- ${op.minId}`;
      }
      return `~ ${op.minId} ${op.pretty}`;
    })
    .join('\n');
}

export function applyMinMapPatch(map: MinMap, ops: MinMapPatchOp[]): MinMap {
  let next = map;
  for (const op of ops) {
    if (op.op === 'add') {
      next = addMinMapEntry(next, { minId: op.minId, pretty: op.pretty, kind: op.kind, provenance: 'new' });
      continue;
    }
    const existing = next.entries.find((entry) => entry.minId === op.minId);
    if (!existing) {
      throw new Error(`Min-map patch references unknown minId '${op.minId}'`);
    }
    const remaining = next.entries.filter((entry) => entry.minId !== op.minId);
    if (op.op === 'remove') {
      next = { ...next, entries: remaining };
      continue;
    }
    next = addMinMapEntry({ ...next, entries: remaining }, { ...existing, pretty: op.pretty });
  }
  return next;
}

export function invertMinMapPatch(map: MinMap, ops: MinMapPatchOp[]): MinMapPatchOp[] {
  let current = map;
  const inverted: MinMapPatchOp[] = [];
  for (const op of ops) {
    if (op.op === 'add') {
      inverted.unshift({ op: 'remove', minId: op.minId });
    } else {
      const existing = current.entries.find((entry) => entry.minId === op.minId);
      if (!existing) {
        throw new Error(`Min-map patch references unknown minId '${op.minId}'`);
      }
      if (op.op === 'remove') {
        inverted.unshift({ op: 'add', minId: existing.minId, pretty: existing.pretty, kind: existing.kind });
      } else {
        inverted.unshift({ op: 'rename', minId: op.minId, pretty: existing.pretty });
      }
    }
    current = applyMinMapPatch(current, [op]);
  }
  return inverted;
}
