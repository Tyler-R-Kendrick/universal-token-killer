import { describe, expect, it } from 'vitest';
import type { LanguageAdapter } from '../src/languages/adapter.js';
import {
  languageGrammar,
  listLanguagePacks,
  maybeResolveLanguagePack,
  registerLanguagePack,
  resolveLanguageAdapter,
  resolveLanguagePack
} from '../src/languages/registry.js';
import { platformCapabilities, stdlibCapabilities } from '../src/ladder/languageCapabilities.js';
import { expandEmissionSource } from '../src/macros/expandEmission.js';
import { addMinMapEntry, createMinMap } from '../src/minmap/format.js';

/** Minimal third-party pack: whitespace-token language, identity semantics. */
const stubAdapter: LanguageAdapter = {
  language: 'stublang',
  fileExtension: '.stub',
  minify: (source) => source,
  expand: (source, map) => {
    let expanded = source;
    for (const entry of map.entries) {
      if (entry.kind === 'ident') {
        expanded = expanded.replaceAll(entry.minId, entry.pretty);
      }
    }
    return expanded;
  },
  collectIdentifiers: (source) => new Set(source.split(/\s+/).filter((word) => word.length > 0)),
  isParseable: () => true,
  scanTokens: (source) => {
    let offset = 0;
    return source.split(' ').map((word) => {
      const start = offset;
      offset += word.length + 1;
      return { kind: 'identifier' as const, text: word, start, end: start + word.length };
    });
  }
};

const stubPack = {
  language: 'stublang',
  adapter: stubAdapter,
  grammar: 'start: WORD+\nWORD: /[a-z]+/\n%ignore /\\s+/\n',
  stdlibCapabilities: { echoText: 'stub stdlib echo' },
  platformCapabilities: { beepSound: 'stub platform beep' }
};

describe('language pack registry pluggability', () => {
  it('registers a third-party pack and resolves every surface from it', async () => {
    registerLanguagePack(stubPack);

    expect(listLanguagePacks()).toContain('stublang');
    expect(resolveLanguagePack('stublang')).toBe(stubPack);
    expect(resolveLanguageAdapter('stublang').fileExtension).toBe('.stub');
    expect(languageGrammar('stublang')).toBe(stubPack.grammar);
    expect(stdlibCapabilities('stublang')).toEqual({ echoText: 'stub stdlib echo' });
    expect(platformCapabilities('stublang')).toEqual({ beepSound: 'stub platform beep' });

    const map = addMinMapEntry(createMinMap('stublang'), { minId: 'a', pretty: 'alpha', kind: 'ident', provenance: 'new' });
    expect(await expandEmissionSource('a b', map, [], stubAdapter)).toBe('alpha b');
  });

  it('resolves nothing for unregistered languages', () => {
    expect(maybeResolveLanguagePack('fortran')).toBeUndefined();
    expect(() => resolveLanguagePack('fortran')).toThrow(/language 'fortran'/);
    expect(stdlibCapabilities('fortran')).toEqual({});
    expect(platformCapabilities('fortran')).toEqual({});
  });

  it('validates packs at registration time', () => {
    expect(() => registerLanguagePack({ ...stubPack, language: '' })).toThrow(/language/);
    expect(() => registerLanguagePack({ ...stubPack, language: 'otherlang' })).toThrow(/mismatched/);
    expect(() => registerLanguagePack({ ...stubPack, grammar: 'WORD: /[a-z]+/\n' })).toThrow(/start/);
  });
});
