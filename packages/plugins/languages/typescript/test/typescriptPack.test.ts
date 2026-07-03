import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { deriveMinGrammar, resolveLanguagePack } from '@utk/codegen';
import { TYPESCRIPT_EMIT_LARK, typescriptLanguagePack } from '../src/index.js';

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

  it('ships base and derived grammars as committed .lark files', async () => {
    for (const fileName of ['typescript.emit.lark', 'typescript.emit.min.lark']) {
      const content = await readFile(new URL(`../grammars/${fileName}`, import.meta.url), 'utf8');
      expect(content.length, fileName).toBeGreaterThan(0);
      expect(content.endsWith('\n'), fileName).toBe(true);
    }
    expect(TYPESCRIPT_EMIT_LARK).toBe(await readFile(new URL('../grammars/typescript.emit.lark', import.meta.url), 'utf8'));
  });

  it('keeps the committed derived grammar in sync with deriveMinGrammar (staleness gate)', async () => {
    const committed = await readFile(new URL('../grammars/typescript.emit.min.lark', import.meta.url), 'utf8');
    expect(committed.replace(/\r\n/g, '\n')).toBe(deriveMinGrammar(TYPESCRIPT_EMIT_LARK));
  });
});

describe('typescript language pack', () => {
  it('self-registers on import with adapter, grammar, and capability indexes', () => {
    const pack = resolveLanguagePack('typescript');
    expect(pack).toBe(typescriptLanguagePack);
    expect(pack.adapter.language).toBe('typescript');
    expect(pack.adapter.fileExtension).toBe('.ts');
    expect(pack.grammar).toBe(TYPESCRIPT_EMIT_LARK);
    expect(pack.stdlibCapabilities?.['structuredClone']).toContain('structuredClone');
    expect(pack.platformCapabilities?.['datePicker']).toContain('input type="date"');
  });
});
