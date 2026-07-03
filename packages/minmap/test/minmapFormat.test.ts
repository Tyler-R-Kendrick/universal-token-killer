import { describe, expect, it } from 'vitest';
import {
  addMinMapEntry,
  createMinMap,
  minIdFor,
  minMapHash,
  parseMinMap,
  prettyFor,
  serializeMinMap
} from '@utk/minmap';

describe('min-map format', () => {
  it('creates an empty versioned map for a language', () => {
    const map = createMinMap('typescript');
    expect(map.version).toBe(1);
    expect(map.language).toBe('typescript');
    expect(map.entries).toEqual([]);
  });

  it('rejects an empty language id', () => {
    expect(() => createMinMap('')).toThrow(/language/);
  });

  it('adds entries immutably and keeps entries sorted by minId', () => {
    const map = createMinMap('typescript');
    const withB = addMinMapEntry(map, { minId: 'b', pretty: 'buildResponse', kind: 'ident', provenance: 'new' });
    const withBoth = addMinMapEntry(withB, { minId: 'a', pretty: 'applyPatch', kind: 'ident', provenance: 'new' });

    expect(map.entries).toEqual([]);
    expect(withB.entries.map((entry) => entry.minId)).toEqual(['b']);
    expect(withBoth.entries.map((entry) => entry.minId)).toEqual(['a', 'b']);
  });

  it('enforces bijection: duplicate minId and duplicate pretty are rejected', () => {
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'applyPatch',
      kind: 'ident',
      provenance: 'new'
    });

    expect(() =>
      addMinMapEntry(map, { minId: 'a', pretty: 'other', kind: 'ident', provenance: 'new' })
    ).toThrow(/minId 'a' already mapped/);
    expect(() =>
      addMinMapEntry(map, { minId: 'b', pretty: 'applyPatch', kind: 'ident', provenance: 'new' })
    ).toThrow(/pretty 'applyPatch' already mapped/);
  });

  it('rejects malformed minIds and empty pretty names', () => {
    const map = createMinMap('typescript');
    expect(() =>
      addMinMapEntry(map, { minId: 'not valid', pretty: 'x', kind: 'ident', provenance: 'new' })
    ).toThrow(/minId/);
    expect(() =>
      addMinMapEntry(map, { minId: 'a', pretty: '', kind: 'ident', provenance: 'new' })
    ).toThrow(/pretty/);
  });

  it('looks up both directions of the bijection', () => {
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'applyPatch',
      kind: 'ident',
      provenance: 'new'
    });

    expect(prettyFor(map, 'a')).toBe('applyPatch');
    expect(minIdFor(map, 'applyPatch')).toBe('a');
    expect(prettyFor(map, 'zz')).toBeUndefined();
    expect(minIdFor(map, 'unknown')).toBeUndefined();
  });

  it('serializes canonically and content-hashes stably regardless of insertion order', () => {
    const first = addMinMapEntry(
      addMinMapEntry(createMinMap('typescript'), { minId: 'b', pretty: 'bravo', kind: 'ident', provenance: 'new' }),
      { minId: 'a', pretty: 'alpha', kind: 'ident', provenance: 'new' }
    );
    const second = addMinMapEntry(
      addMinMapEntry(createMinMap('typescript'), { minId: 'a', pretty: 'alpha', kind: 'ident', provenance: 'new' }),
      { minId: 'b', pretty: 'bravo', kind: 'ident', provenance: 'new' }
    );

    expect(serializeMinMap(first)).toBe(serializeMinMap(second));
    expect(minMapHash(first)).toBe(minMapHash(second));
  });

  it('parses a serialized map back to an equal value', () => {
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'applyPatch',
      kind: 'ident',
      provenance: 'codebase',
      source: 'cg_0123456789abcdef'
    });

    expect(parseMinMap(serializeMinMap(map))).toEqual(map);
  });

  it('rejects serialized maps with wrong versions, shapes, or invalid entries', () => {
    expect(() => parseMinMap('not json')).toThrow(/JSON/);
    expect(() => parseMinMap('null')).toThrow(/object/);
    expect(() => parseMinMap('{"version":2,"language":"typescript","entries":[]}')).toThrow(/version/);
    expect(() => parseMinMap('{"version":1,"language":"typescript","entries":"nope"}')).toThrow(/entries/);
    expect(() => parseMinMap('{"version":1,"language":"typescript","entries":[{"minId":"a"}]}')).toThrow(/entry/);
    expect(() =>
      parseMinMap('{"version":1,"language":"typescript","entries":[{"minId":"a","pretty":"x","kind":"bogus","provenance":"new"}]}')
    ).toThrow(/kind/);
    expect(() =>
      parseMinMap('{"version":1,"language":"typescript","entries":[{"minId":"a","pretty":"x","kind":"ident","provenance":"bogus"}]}')
    ).toThrow(/provenance/);
  });
});
