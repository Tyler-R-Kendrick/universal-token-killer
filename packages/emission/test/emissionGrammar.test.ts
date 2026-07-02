import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TYPESCRIPT_EMIT_LARK } from '../src/grammars/typescriptEmitGrammar.js';
import { deriveMinGrammar } from '../src/grammars/deriveMinGrammar.js';
import { installLanguageProfile } from '../src/grammars/languageProfile.js';

describe('typescript emission grammar profile', () => {
  it('declares a start rule and the identifier terminal lint requires', () => {
    expect(TYPESCRIPT_EMIT_LARK).toMatch(/^start:/m);
    expect(TYPESCRIPT_EMIT_LARK).toMatch(/^IDENT:/m);
    expect(TYPESCRIPT_EMIT_LARK).toContain('%ignore');
  });

  it('covers the emission profile constructs the plan commits to', () => {
    for (const construct of ['import_decl', 'const_decl', 'function_decl', 'class_decl', 'return_stmt', 'arrow_fn']) {
      expect(TYPESCRIPT_EMIT_LARK).toContain(construct);
    }
  });
});

describe('deriveMinGrammar', () => {
  it('is deterministic', () => {
    expect(deriveMinGrammar(TYPESCRIPT_EMIT_LARK)).toBe(deriveMinGrammar(TYPESCRIPT_EMIT_LARK));
  });

  it('constrains identifiers to pool-shaped min ids', () => {
    const derived = deriveMinGrammar(TYPESCRIPT_EMIT_LARK);
    expect(derived).toContain('IDENT: /[A-Za-z][A-Za-z0-9]{0,2}/');
    expect(derived).not.toContain('IDENT: /[A-Za-z_$][A-Za-z0-9_$]*/');
  });

  it('embeds declare-before-use min-map patch productions ahead of code', () => {
    const derived = deriveMinGrammar(TYPESCRIPT_EMIT_LARK);
    expect(derived).toContain('"@minmap"');
    expect(derived).toContain('"@end"');
    expect(derived).toContain('PRETTY:');
    expect(derived).toMatch(/^start:/m);
  });

  it('strips comments and blank lines and renames rules to compact ids', () => {
    const derived = deriveMinGrammar(TYPESCRIPT_EMIT_LARK);
    expect(derived).not.toMatch(/^\/\//m);
    expect(derived.trimEnd().split('\n').every((line) => line.trim().length > 0)).toBe(true);
    expect(derived).not.toContain('function_decl');
    expect(derived).toMatch(/^r\d+:/m);
    expect(derived.length).toBeLessThan(TYPESCRIPT_EMIT_LARK.length + 400);
  });

  it('keeps quoted keyword literals intact while renaming rules', () => {
    const derived = deriveMinGrammar(TYPESCRIPT_EMIT_LARK);
    expect(derived).toContain('"import"');
    expect(derived).toContain('"function"');
    expect(derived).toContain('"class"');
  });

  it('rejects grammars without a start rule or IDENT terminal', () => {
    expect(() => deriveMinGrammar('nothing: "x"\n')).toThrow(/start/);
    expect(() => deriveMinGrammar('start: "x"\n')).toThrow(/IDENT/);
  });

  it('appends macro-call productions when macro ids are supplied', () => {
    const derived = deriveMinGrammar(TYPESCRIPT_EMIT_LARK, { macroIds: ['m1', 'm2'] });
    expect(derived).toContain('MACRO_ID: "m1" | "m2"');
    expect(derived).toContain('MACRO_ID "("');
  });

  it('rejects macro ids that do not fit the min-id shape', () => {
    expect(() => deriveMinGrammar(TYPESCRIPT_EMIT_LARK, { macroIds: ['not valid'] })).toThrow(/macro id/);
  });
});

describe('committed derived grammar staleness gate', () => {
  it('grammars/typescript.emit.min.lark byte-equals deriveMinGrammar(TYPESCRIPT_EMIT_LARK)', async () => {
    const committed = await readFile(new URL('../grammars/typescript.emit.min.lark', import.meta.url), 'utf8');
    expect(committed.replace(/\r\n/g, '\n')).toBe(deriveMinGrammar(TYPESCRIPT_EMIT_LARK));
  });
});

describe('installLanguageProfile', () => {
  it('persists base and derived grammars under .utk/lang/<language>/', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'utk-emission-grammar-'));
    const installed = await installLanguageProfile(root, 'typescript');

    expect(installed.grammarPath).toBe(path.join(root, '.utk', 'lang', 'typescript', 'grammar.lark'));
    expect(installed.minGrammarPath).toBe(path.join(root, '.utk', 'lang', 'typescript', 'grammar.min.lark'));
    expect(await readFile(installed.grammarPath, 'utf8')).toBe(TYPESCRIPT_EMIT_LARK);
    expect(await readFile(installed.minGrammarPath, 'utf8')).toBe(deriveMinGrammar(TYPESCRIPT_EMIT_LARK));
  });

  it('rejects languages without a registered grammar profile', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'utk-emission-grammar-'));
    await expect(installLanguageProfile(root, 'cobol')).rejects.toThrow(/language 'cobol'/);
  });
});
