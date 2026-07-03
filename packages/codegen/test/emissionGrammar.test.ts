import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { deriveMinGrammar } from '@utk/minmap';
import { installLanguageProfile } from '../src/grammars/languageProfile.js';
import { registerLanguagePack } from '../src/languages/registry.js';
import { typescriptLanguagePack } from '../../plugins/languages/typescript/src/index.js';

let SAMPLE_LARK = '';

beforeAll(async () => {
  SAMPLE_LARK = await readFile(new URL('./fixtures/sample.emit.lark', import.meta.url), 'utf8');
});

describe('deriveMinGrammar', () => {
  it('is deterministic', () => {
    expect(deriveMinGrammar(SAMPLE_LARK)).toBe(deriveMinGrammar(SAMPLE_LARK));
  });

  it('constrains identifiers to pool-shaped min ids', () => {
    const derived = deriveMinGrammar(SAMPLE_LARK);
    expect(derived).toContain('IDENT: /[A-Za-z][A-Za-z0-9]{0,2}/');
    expect(derived).not.toContain('IDENT: /[A-Za-z_$][A-Za-z0-9_$]*/');
  });

  it('embeds declare-before-use min-map patch productions ahead of code', () => {
    const derived = deriveMinGrammar(SAMPLE_LARK);
    expect(derived).toContain('"@minmap"');
    expect(derived).toContain('"@end"');
    expect(derived).toContain('PRETTY:');
    expect(derived).toMatch(/^start:/m);
  });

  it('strips comments and blank lines and renames rules to compact ids', () => {
    const derived = deriveMinGrammar(SAMPLE_LARK);
    expect(derived).not.toMatch(/^\/\//m);
    expect(derived.trimEnd().split('\n').every((line) => line.trim().length > 0)).toBe(true);
    expect(derived).not.toContain('greet_decl');
    expect(derived).toMatch(/^r\d+:/m);
  });

  it('keeps quoted keyword literals intact while renaming rules', () => {
    const derived = deriveMinGrammar(SAMPLE_LARK);
    expect(derived).toContain('"greet"');
  });

  it('rejects grammars without a start rule, IDENT terminal, or %ignore directive', () => {
    expect(() => deriveMinGrammar('nothing: "x"\n')).toThrow(/start/);
    expect(() => deriveMinGrammar('start: "x"\n')).toThrow(/IDENT/);
    expect(() => deriveMinGrammar(SAMPLE_LARK.replace('%ignore /\\s+/\n', ''))).toThrow(/%ignore/);
  });

  it('appends macro-call productions when macro ids are supplied', () => {
    const derived = deriveMinGrammar(SAMPLE_LARK, { macroIds: ['m1', 'm2'] });
    expect(derived).toContain('MACRO_ID: "m1" | "m2"');
    expect(derived).toContain('MACRO_ID "("');
  });

  it('rejects macro ids that do not fit the min-id shape', () => {
    expect(() => deriveMinGrammar(SAMPLE_LARK, { macroIds: ['not valid'] })).toThrow(/macro id/);
  });
});

describe('emission core grammar files', () => {
  it('ships every language-agnostic grammar as a committed .lark file', async () => {
    // The declare-before-use min-map patch grammars now ship with @utk/minmap;
    // emission retains only the macro-argument grammar.
    for (const fileName of ['macro-arg.lark']) {
      const content = await readFile(new URL(`../grammars/${fileName}`, import.meta.url), 'utf8');
      expect(content.length, fileName).toBeGreaterThan(0);
      expect(content.endsWith('\n'), fileName).toBe(true);
    }
  });
});

describe('installLanguageProfile', () => {
  it('persists base and derived grammars for a registered language pack', async () => {
    registerLanguagePack(typescriptLanguagePack);
    const root = await mkdtemp(path.join(tmpdir(), 'utk-emission-grammar-'));
    const installed = await installLanguageProfile(root, 'typescript');

    expect(installed.grammarPath).toBe(path.join(root, '.utk', 'lang', 'typescript', 'grammar.lark'));
    expect(installed.minGrammarPath).toBe(path.join(root, '.utk', 'lang', 'typescript', 'grammar.min.lark'));
    expect(await readFile(installed.grammarPath, 'utf8')).toBe(typescriptLanguagePack.grammar);
    expect(await readFile(installed.minGrammarPath, 'utf8')).toBe(deriveMinGrammar(typescriptLanguagePack.grammar));
  });

  it('rejects languages without a registered pack', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'utk-emission-grammar-'));
    await expect(installLanguageProfile(root, 'cobol')).rejects.toThrow(/language 'cobol'/);
  });
});
