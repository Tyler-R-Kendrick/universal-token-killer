import { describe, expect, it } from 'vitest';
import { SINGLE_TOKEN_POOL } from '../src/minmap/singleTokenPool.js';
import { allocateEntry, allocateMinId } from '../src/minmap/allocator.js';
import { addMinMapEntry, createMinMap } from '../src/minmap/format.js';

describe('single-token pool', () => {
  it('contains only short, unique, identifier-safe ids', () => {
    expect(SINGLE_TOKEN_POOL.length).toBeGreaterThanOrEqual(200);
    expect(new Set(SINGLE_TOKEN_POOL).size).toBe(SINGLE_TOKEN_POOL.length);
    for (const id of SINGLE_TOKEN_POOL) {
      expect(id).toMatch(/^[a-z][a-z0-9]?$/);
    }
  });
});

describe('min-id allocator', () => {
  it('allocates the first free pool id deterministically', () => {
    const map = createMinMap('typescript');
    expect(allocateMinId(map)).toBe(SINGLE_TOKEN_POOL[0]);
    expect(allocateMinId(map)).toBe(SINGLE_TOKEN_POOL[0]);
  });

  it('skips ids already used as minId or as pretty name', () => {
    const asMin = addMinMapEntry(createMinMap('typescript'), {
      minId: SINGLE_TOKEN_POOL[0]!,
      pretty: 'alpha',
      kind: 'ident',
      provenance: 'new'
    });
    expect(allocateMinId(asMin)).toBe(SINGLE_TOKEN_POOL[1]);

    const asPretty = addMinMapEntry(createMinMap('typescript'), {
      minId: 'zz9',
      pretty: SINGLE_TOKEN_POOL[0]!,
      kind: 'ident',
      provenance: 'new'
    });
    expect(allocateMinId(asPretty)).toBe(SINGLE_TOKEN_POOL[1]);
  });

  it('skips reserved ids (identifiers already present in the source)', () => {
    const map = createMinMap('typescript');
    const reserved = new Set([SINGLE_TOKEN_POOL[0]!, SINGLE_TOKEN_POOL[1]!]);
    expect(allocateMinId(map, { reserved })).toBe(SINGLE_TOKEN_POOL[2]);
  });

  it('throws when the pool is exhausted', () => {
    const map = createMinMap('typescript');
    const reserved = new Set(SINGLE_TOKEN_POOL);
    expect(() => allocateMinId(map, { reserved })).toThrow(/pool exhausted/);
  });

  it('allocates a full entry and is stable for already-mapped pretty names', () => {
    const map = createMinMap('typescript');
    const first = allocateEntry(map, { pretty: 'applyPatch', kind: 'ident', provenance: 'new' });
    expect(first.entry.minId).toBe(SINGLE_TOKEN_POOL[0]);
    expect(first.map.entries).toHaveLength(1);

    const again = allocateEntry(first.map, { pretty: 'applyPatch', kind: 'ident', provenance: 'new' });
    expect(again.entry).toEqual(first.entry);
    expect(again.map).toBe(first.map);
  });

  it('records codebase provenance sources on allocated entries', () => {
    const { entry } = allocateEntry(createMinMap('typescript'), {
      pretty: 'mediateToolExecution',
      kind: 'ident',
      provenance: 'codebase',
      source: 'cg_0123456789abcdef'
    });
    expect(entry.source).toBe('cg_0123456789abcdef');
  });
});
