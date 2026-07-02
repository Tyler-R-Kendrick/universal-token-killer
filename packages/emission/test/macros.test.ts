import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addMinMapEntry, createMinMap } from '../src/minmap/format.js';
import { defineMacro, expandMacro, registerMacro } from '../src/macros/defineMacro.js';
import { expandEmissionSource, expandMacroCallsInSource } from '../src/macros/expandEmission.js';
import {
  appendEmissionLedgerEntry,
  emissionLedgerPath,
  readEmissionLedger
} from '../src/macros/ledger.js';

const HTTP_GET_JSON = defineMacro({
  name: 'httpGetJson',
  description: 'fetch a URL and parse the JSON body',
  params: ['targetUrl'],
  expansion: 'await fetch({{targetUrl}}).then((response) => response.json())'
});

const GUARD_REQUIRED = defineMacro({
  name: 'guardRequired',
  params: ['checkedValue', 'errorText'],
  expansion: 'if ({{checkedValue}} === undefined) { throw new Error({{errorText}}); }'
});

async function workspace(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), 'utk-emission-macros-'));
}

describe('defineMacro', () => {
  it('returns the validated descriptor', () => {
    expect(HTTP_GET_JSON.name).toBe('httpGetJson');
    expect(HTTP_GET_JSON.params).toEqual(['targetUrl']);
  });

  it('rejects invalid names, params, and expansions', () => {
    expect(() => defineMacro({ name: '', params: [], expansion: 'x' })).toThrow(/name/);
    expect(() => defineMacro({ name: 'not valid', params: [], expansion: 'x' })).toThrow(/name/);
    expect(() => defineMacro({ name: 'ok', params: ['1bad'], expansion: '{{1bad}}' })).toThrow(/param/);
    expect(() => defineMacro({ name: 'ok', params: ['dup', 'dup'], expansion: '{{dup}}' })).toThrow(/duplicate/);
    expect(() => defineMacro({ name: 'ok', params: [], expansion: '' })).toThrow(/expansion/);
    expect(() => defineMacro({ name: 'ok', params: [], expansion: 'uses {{ghost}}' })).toThrow(/undeclared/);
    expect(() => defineMacro({ name: 'ok', params: ['unused'], expansion: 'nothing' })).toThrow(/unused/);
  });
});

describe('registerMacro', () => {
  it('allocates a macro-kind min-map entry and is stable across re-registration', () => {
    const first = registerMacro(createMinMap('typescript'), HTTP_GET_JSON);
    expect(first.entry.kind).toBe('macro');
    expect(first.entry.pretty).toBe('httpGetJson');

    const again = registerMacro(first.map, HTTP_GET_JSON);
    expect(again.entry).toEqual(first.entry);
    expect(again.map).toBe(first.map);
  });
});

describe('expandMacro', () => {
  it('expands deterministically with positional arguments', async () => {
    const expansion = await expandMacro(HTTP_GET_JSON, ["'https://example.test/data'"]);
    expect(expansion).toBe("await fetch('https://example.test/data').then((response) => response.json())");
    expect(await expandMacro(HTTP_GET_JSON, ["'https://example.test/data'"])).toBe(expansion);
  });

  it('rejects argument-count mismatches', async () => {
    await expect(expandMacro(GUARD_REQUIRED, ['onlyOne'])).rejects.toThrow(/expects 2 arguments/);
  });
});

describe('expandMacroCallsInSource', () => {
  const map = registerMacro(
    registerMacro(createMinMap('typescript'), HTTP_GET_JSON).map,
    GUARD_REQUIRED
  ).map;
  const macros = [HTTP_GET_JSON, GUARD_REQUIRED];
  const macroId = (pretty: string) => map.entries.find((entry) => entry.pretty === pretty)!.minId;

  it('replaces macro call sites with their expansions', async () => {
    const source = `const payload = ${macroId('httpGetJson')}('https://example.test/data');\n`;
    const expanded = await expandMacroCallsInSource(source, map, macros);
    expect(expanded).toBe(
      "const payload = await fetch('https://example.test/data').then((response) => response.json());\n"
    );
  });

  it('expands multiple call sites and multi-argument macros', async () => {
    const source = [
      `${macroId('guardRequired')}(loadedConfig, 'missing config');`,
      `const body = ${macroId('httpGetJson')}(requestUrl);`,
      ''
    ].join('\n');
    const expanded = await expandMacroCallsInSource(source, map, macros);
    expect(expanded).toContain("if (loadedConfig === undefined) { throw new Error('missing config'); }");
    expect(expanded).toContain('const body = await fetch(requestUrl).then((response) => response.json());');
  });

  it('handles nested parentheses inside a single argument', async () => {
    const source = `const body = ${macroId('httpGetJson')}(buildUrl(baseUrl, requestPath));\n`;
    const expanded = await expandMacroCallsInSource(source, map, macros);
    expect(expanded).toContain('await fetch(buildUrl(baseUrl, requestPath))');
  });

  it('does not split arguments on commas inside object or array literals', async () => {
    const source = `${macroId('guardRequired')}({ first: 1, second: 2 }.first, 'missing');\n`;
    const expanded = await expandMacroCallsInSource(source, map, macros);
    expect(expanded).toContain("if ({ first: 1, second: 2 }.first === undefined) { throw new Error('missing'); }");
  });

  it('leaves bare macro ids and string contents untouched', async () => {
    const bare = `const alias = ${macroId('httpGetJson')};\n`;
    expect(await expandMacroCallsInSource(bare, map, macros)).toBe(bare);

    const quoted = `const note = "${macroId('httpGetJson')}(ignored)";\n`;
    expect(await expandMacroCallsInSource(quoted, map, macros)).toBe(quoted);
  });

  it('rejects nested macro calls', async () => {
    const source = `${macroId('httpGetJson')}(${macroId('httpGetJson')}(innerUrl));\n`;
    await expect(expandMacroCallsInSource(source, map, macros)).rejects.toThrow(/nested macro/);
  });

  it('rejects unterminated macro call sites', async () => {
    const source = `${macroId('httpGetJson')}(unclosed;\n`;
    await expect(expandMacroCallsInSource(source, map, macros)).rejects.toThrow(/unterminated/);
  });

  it('rejects macro ids in the map without a registered descriptor', async () => {
    const orphanMap = addMinMapEntry(createMinMap('typescript'), {
      minId: 'q9',
      pretty: 'orphanMacro',
      kind: 'macro',
      provenance: 'new'
    });
    await expect(expandMacroCallsInSource('q9(value);\n', orphanMap, [])).rejects.toThrow(/descriptor/);
  });
});

describe('expandEmissionSource', () => {
  it('expands identifiers first, then macro call sites, producing pretty output', async () => {
    let map = createMinMap('typescript');
    map = addMinMapEntry(map, { minId: 'a', pretty: 'requestUrl', kind: 'ident', provenance: 'new' });
    map = addMinMapEntry(map, { minId: 'b', pretty: 'responsePayload', kind: 'ident', provenance: 'new' });
    const registered = registerMacro(map, HTTP_GET_JSON);
    const minSource = `const b = ${registered.entry.minId}(a);\n`;

    const pretty = await expandEmissionSource(minSource, registered.map, [HTTP_GET_JSON]);
    expect(pretty).toBe(
      'const responsePayload = await fetch(requestUrl).then((response) => response.json());\n'
    );
  });
});

describe('emission ledger', () => {
  it('appends entries with increasing sequence numbers and reads them back', async () => {
    const root = await workspace();
    const first = await appendEmissionLedgerEntry(root, {
      type: 'macro-expansion',
      data: { macro: 'httpGetJson', args: ['requestUrl'] }
    });
    const second = await appendEmissionLedgerEntry(root, {
      type: 'minmap-patch',
      data: { patch: '+ a requestUrl' }
    });

    expect(first.seq).toBe(1);
    expect(second.seq).toBe(2);
    expect(await readEmissionLedger(root)).toEqual([first, second]);
  });

  it('reads an empty ledger as an empty list', async () => {
    const root = await workspace();
    expect(await readEmissionLedger(root)).toEqual([]);
  });

  it('rethrows non-ENOENT filesystem errors', async () => {
    const root = await workspace();
    await mkdir(emissionLedgerPath(root), { recursive: true });
    await expect(readEmissionLedger(root)).rejects.toThrow(/EISDIR|directory/);
  });

  it('rejects corrupted ledger lines', async () => {
    const root = await workspace();
    const ledgerPath = emissionLedgerPath(root);
    await mkdir(path.dirname(ledgerPath), { recursive: true });
    await writeFile(ledgerPath, 'not-json\n', 'utf8');
    await expect(readEmissionLedger(root)).rejects.toThrow(/ledger/);

    await writeFile(ledgerPath, '{"seq":1}\n', 'utf8');
    await expect(readEmissionLedger(root)).rejects.toThrow(/ledger/);
  });

  it('preserves ledger contents on disk as JSONL', async () => {
    const root = await workspace();
    await appendEmissionLedgerEntry(root, { type: 'macro-expansion', data: {} });
    const text = await readFile(emissionLedgerPath(root), 'utf8');
    expect(text.trim().split('\n')).toHaveLength(1);
  });
});
