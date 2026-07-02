import type ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { addMinMapEntry, applyMinMapPatch, createMinMap } from '@utk/emission';
import { buildSourceMinMap, parseDiagnosticsAreClean, typescriptAdapter } from '../src/adapter.js';

const PRETTY_CORPUS: Record<string, string> = {
  'function-with-refs': [
    'export function applyPatch(currentState: string, incomingDelta: string): string {',
    '  const mergedResult = currentState + incomingDelta;',
    '  return mergedResult;',
    '}',
    ''
  ].join('\n'),
  'class-with-generics': [
    'export class ResponseCache<TValue> {',
    '  private readonly storedValues = new Map<string, TValue>();',
    '  rememberValue(cacheKey: string, cachedValue: TValue): void {',
    '    this.storedValues.set(cacheKey, cachedValue);',
    '  }',
    '}',
    ''
  ].join('\n'),
  'imports-and-templates': [
    "import { readFile } from 'node:fs/promises';",
    'export async function loadManifest(manifestPath: string): Promise<string> {',
    "  const manifestText = await readFile(manifestPath, 'utf8');",
    '  return `manifest:${manifestText}`;',
    '}',
    ''
  ].join('\n'),
  'comments-and-strings': [
    '// applyPatch stays verbatim inside comments',
    'const warningMessage = "call applyPatch before saving";',
    'export function applyPatch(): string {',
    '  return warningMessage;',
    '}',
    ''
  ].join('\n'),
  'template-with-middles-and-nested-braces': [
    'const innerRecord = { innerValue: 1 };',
    'export const renderedLabel = `first:${innerRecord.innerValue} second:${({ nestedValue: 2 }).nestedValue}`;',
    ''
  ].join('\n')
};

function mapFor(source: string) {
  return buildSourceMinMap(source).map;
}

describe('typescript adapter minify/expand', () => {
  it('renames mapped identifiers at declarations and references', () => {
    const source = PRETTY_CORPUS['function-with-refs']!;
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'applyPatch',
      kind: 'ident',
      provenance: 'new'
    });

    const minified = typescriptAdapter.minify(source, map);
    expect(minified).toContain('export function a(');
    expect(minified).not.toContain('applyPatch');
  });

  it('leaves string literals and comments byte-identical', () => {
    const source = PRETTY_CORPUS['comments-and-strings']!;
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'applyPatch',
      kind: 'ident',
      provenance: 'new'
    });

    const minified = typescriptAdapter.minify(source, map);
    expect(minified).toContain('// applyPatch stays verbatim inside comments');
    expect(minified).toContain('"call applyPatch before saving"');
    expect(minified).toContain('export function a()');
  });

  it('never applies macro or keyword kind entries in the identifier renamer', () => {
    const source = 'const httpGetJson = 1;\n';
    let map = createMinMap('typescript');
    map = addMinMapEntry(map, { minId: 'm1', pretty: 'httpGetJson', kind: 'macro', provenance: 'new' });
    map = addMinMapEntry(map, { minId: 'k1', pretty: 'export', kind: 'keyword', provenance: 'stdlib' });

    expect(typescriptAdapter.minify(source, map)).toBe(source);
  });

  it.each(Object.entries(PRETTY_CORPUS))('expand(minify(x)) === x exactly for %s', (_name, source) => {
    const map = mapFor(source);
    const minified = typescriptAdapter.minify(source, map);
    expect(typescriptAdapter.expand(minified, map)).toBe(source);
  });

  it('minify(expand(min)) === min for minified sources', () => {
    const source = PRETTY_CORPUS['class-with-generics']!;
    const map = mapFor(source);
    const minified = typescriptAdapter.minify(source, map);
    expect(typescriptAdapter.minify(typescriptAdapter.expand(minified, map), map)).toBe(minified);
  });

  it('produces strictly shorter minified sources for realistic pretty code', () => {
    for (const source of Object.values(PRETTY_CORPUS)) {
      const map = mapFor(source);
      expect(typescriptAdapter.minify(source, map).length).toBeLessThan(source.length);
    }
  });

  it('passes unmapped identifiers through unchanged', () => {
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'somethingElse',
      kind: 'ident',
      provenance: 'new'
    });
    const source = 'const untouched = 1;\n';
    expect(typescriptAdapter.minify(source, map)).toBe(source);
  });

  it('guards the bijection: minify rejects sources that shadow an unmapped minId', () => {
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'applyPatch',
      kind: 'ident',
      provenance: 'new'
    });
    expect(() => typescriptAdapter.minify('const a = 1;\n', map)).toThrow(/collides with min-map id 'a'/);
  });

  it('guards the bijection: expand rejects minified sources that contain pretty names', () => {
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'applyPatch',
      kind: 'ident',
      provenance: 'new'
    });
    expect(() => typescriptAdapter.expand('const applyPatch = a;\n', map)).toThrow(
      /contains pretty name 'applyPatch'/
    );
  });

  it('leaves private identifiers untouched', () => {
    const source = 'class Box { #hiddenValue = 1; readValue() { return this.#hiddenValue; } }\n';
    const { map } = buildSourceMinMap(source);
    const minified = typescriptAdapter.minify(source, map);
    expect(minified).toContain('#hiddenValue');
    expect(typescriptAdapter.expand(minified, map)).toBe(source);
  });

  it('collects identifier occurrences for reservation', () => {
    const identifiers = typescriptAdapter.collectIdentifiers('const a = firstValue + b2;\n');
    expect(identifiers.has('a')).toBe(true);
    expect(identifiers.has('firstValue')).toBe(true);
    expect(identifiers.has('b2')).toBe(true);
    expect(identifiers.has('const')).toBe(false);
  });

  it('reports parse validity for minified and garbage sources', () => {
    const source = PRETTY_CORPUS['function-with-refs']!;
    const map = mapFor(source);
    expect(typescriptAdapter.isParseable(source)).toBe(true);
    expect(typescriptAdapter.isParseable(typescriptAdapter.minify(source, map))).toBe(true);
    expect(typescriptAdapter.isParseable('export function ((( {')).toBe(false);
  });

  it('fails open when a future typescript release drops the internal parseDiagnostics field', () => {
    expect(parseDiagnosticsAreClean({} as ts.SourceFile)).toBe(true);
    expect(parseDiagnosticsAreClean({ parseDiagnostics: [] } as unknown as ts.SourceFile)).toBe(true);
    expect(parseDiagnosticsAreClean({ parseDiagnostics: ['broken'] } as unknown as ts.SourceFile)).toBe(false);
  });
});

describe('buildSourceMinMap', () => {
  it('allocates entries for identifiers of length >= 3 in first-occurrence order', () => {
    const source = PRETTY_CORPUS['function-with-refs']!;
    const { map } = buildSourceMinMap(source);
    const pretties = map.entries.map((entry) => entry.pretty);
    expect(pretties).toContain('applyPatch');
    expect(pretties).toContain('currentState');
    expect(pretties).toContain('incomingDelta');
    expect(pretties).toContain('mergedResult');
  });

  it('skips identifiers that are already short', () => {
    const { map } = buildSourceMinMap('const ab = 1;\nconst longName = ab;\n');
    expect(map.entries.map((entry) => entry.pretty)).toEqual(['longName']);
  });

  it('reserves short identifiers already present in the source', () => {
    const { map } = buildSourceMinMap('const a = 1;\nconst longName = a;\n');
    expect(map.entries).toHaveLength(1);
    expect(map.entries[0]!.minId).not.toBe('a');
  });

  it('is stable: rebuilding from the same source and base map allocates nothing new', () => {
    const source = PRETTY_CORPUS['class-with-generics']!;
    const first = buildSourceMinMap(source);
    const second = buildSourceMinMap(source, { baseMap: first.map });
    expect(second.map).toEqual(first.map);
    expect(second.patchOps).toEqual([]);
  });

  it('returns patch ops that reproduce the map from the base map', () => {
    const source = PRETTY_CORPUS['imports-and-templates']!;
    const base = createMinMap('typescript');
    const { map, patchOps } = buildSourceMinMap(source, { baseMap: base });
    expect(applyMinMapPatch(base, patchOps)).toEqual(map);
  });
});
