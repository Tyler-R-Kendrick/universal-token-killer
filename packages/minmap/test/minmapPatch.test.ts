import { describe, expect, it } from 'vitest';
import { addMinMapEntry, createMinMap } from '@utk/minmap';
import {
  applyMinMapPatch,
  invertMinMapPatch,
  parseMinMapPatch,
  serializeMinMapPatch
} from '@utk/minmap';
import { MINMAP_PATCH_LARK, MINMAP_PATCH_LINE_PATTERN } from '@utk/minmap';

const baseMap = addMinMapEntry(createMinMap('typescript'), {
  minId: 'a',
  pretty: 'applyPatch',
  kind: 'ident',
  provenance: 'new'
});

describe('min-map patch parsing', () => {
  it('parses add, remove, and rename ops from compact patch text', () => {
    const ops = parseMinMapPatch('+ b buildResponse\n- a\n~ b buildReply');
    expect(ops).toEqual([
      { op: 'add', minId: 'b', pretty: 'buildResponse', kind: 'ident' },
      { op: 'remove', minId: 'a' },
      { op: 'rename', minId: 'b', pretty: 'buildReply' }
    ]);
  });

  it('parses macro-kind adds via the @kind suffix and skips blank lines', () => {
    const ops = parseMinMapPatch('\n+ m1 httpGetJson @macro\n\n');
    expect(ops).toEqual([{ op: 'add', minId: 'm1', pretty: 'httpGetJson', kind: 'macro' }]);
  });

  it('rejects malformed patch lines with the offending line in the error', () => {
    expect(() => parseMinMapPatch('* a nope')).toThrow(/patch line '\* a nope'/);
    expect(() => parseMinMapPatch('+ a')).toThrow(/patch line/);
    expect(() => parseMinMapPatch('- a extra')).toThrow(/patch line/);
    expect(() => parseMinMapPatch('+ a x @bogus')).toThrow(/kind/);
  });

  it('round-trips ops through serialize and parse', () => {
    const text = '+ b buildResponse\n+ m1 httpGetJson @macro\n- a\n~ b buildReply';
    expect(serializeMinMapPatch(parseMinMapPatch(text))).toBe(text);
  });

  it('every serialized line conforms to the committed patch grammar line pattern', () => {
    const text = serializeMinMapPatch(parseMinMapPatch('+ b buildResponse\n- a\n~ b buildReply\n+ m1 macroName @macro'));
    for (const line of text.split('\n')) {
      expect(line).toMatch(MINMAP_PATCH_LINE_PATTERN);
    }
  });

  it('ships a lark grammar for constrained patch emission', () => {
    expect(MINMAP_PATCH_LARK).toContain('start:');
    expect(MINMAP_PATCH_LARK).toContain('MIN_ID');
    expect(MINMAP_PATCH_LARK).toContain('PRETTY');
  });
});

describe('min-map patch application', () => {
  it('applies adds, removes, and renames', () => {
    const patched = applyMinMapPatch(baseMap, parseMinMapPatch('+ b buildResponse'));
    expect(patched.entries.map((entry) => entry.minId)).toEqual(['a', 'b']);

    const renamed = applyMinMapPatch(patched, parseMinMapPatch('~ b buildReply'));
    expect(renamed.entries.find((entry) => entry.minId === 'b')?.pretty).toBe('buildReply');

    const removed = applyMinMapPatch(renamed, parseMinMapPatch('- a'));
    expect(removed.entries.map((entry) => entry.minId)).toEqual(['b']);
  });

  it('marks patch-added entries as new provenance', () => {
    const patched = applyMinMapPatch(baseMap, parseMinMapPatch('+ b buildResponse'));
    expect(patched.entries.find((entry) => entry.minId === 'b')?.provenance).toBe('new');
  });

  it('rejects conflicting or dangling ops', () => {
    expect(() => applyMinMapPatch(baseMap, parseMinMapPatch('+ a duplicate'))).toThrow(/already mapped/);
    expect(() => applyMinMapPatch(baseMap, parseMinMapPatch('- zz'))).toThrow(/unknown minId 'zz'/);
    expect(() => applyMinMapPatch(baseMap, parseMinMapPatch('~ zz name'))).toThrow(/unknown minId 'zz'/);
  });

  it('inverts a patch so apply(invert) restores the original map', () => {
    const patch = parseMinMapPatch('+ b buildResponse\n~ a applyDelta');
    const patched = applyMinMapPatch(baseMap, patch);
    const inverse = invertMinMapPatch(baseMap, patch);
    expect(applyMinMapPatch(patched, inverse)).toEqual(baseMap);
  });

  it('inverts removals back to adds with the original pretty name and kind', () => {
    const macroMap = addMinMapEntry(baseMap, { minId: 'm1', pretty: 'httpGetJson', kind: 'macro', provenance: 'new' });
    const patch = parseMinMapPatch('- m1');
    const inverse = invertMinMapPatch(macroMap, patch);
    expect(applyMinMapPatch(applyMinMapPatch(macroMap, patch), inverse).entries).toEqual(macroMap.entries);
  });

  it('refuses to invert ops that do not apply to the given map', () => {
    expect(() => invertMinMapPatch(baseMap, parseMinMapPatch('- zz'))).toThrow(/unknown minId/);
    expect(() => invertMinMapPatch(baseMap, parseMinMapPatch('~ zz name'))).toThrow(/unknown minId/);
  });
});
