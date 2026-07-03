import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addMinMapEntry, createMinMap, prettyFor } from '@utk/minmap';
import { loadMinMap } from '@utk/minmap';
import { defineMacro, registerMacro } from '../src/macros/defineMacro.js';
import { readEmissionLedger } from '../src/macros/ledger.js';
import { extractEmissionPatchBlock } from '../src/emit/patchBlock.js';
import { emitConstrained } from '../src/emit/emitConstrained.js';
import { registerLanguagePack } from '../src/languages/registry.js';
import { typescriptLanguagePack } from '../../plugins/languages/typescript/src/index.js';

registerLanguagePack(typescriptLanguagePack);

const HTTP_GET_JSON = defineMacro({
  name: 'httpGetJson',
  params: ['targetUrl'],
  expansion: 'await fetch({{targetUrl}}).then((response) => response.json())'
});

async function workspace(files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'utk-emission-emit-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
  }
  return root;
}

describe('extractEmissionPatchBlock', () => {
  it('splits a leading @minmap block from the emitted code', () => {
    const { patchText, code } = extractEmissionPatchBlock('@minmap + e newHelper @end const x = e();\n');
    expect(patchText).toBe('+ e newHelper');
    expect(code.trim()).toBe('const x = e();');
  });

  it('chunks multi-op blocks including kinds, removes, and renames', () => {
    const { patchText } = extractEmissionPatchBlock('@minmap + e newHelper @macro - f ~ g renamedName @end code();');
    expect(patchText).toBe('+ e newHelper @macro\n- f\n~ g renamedName');
  });

  it('returns the source untouched when no block is present', () => {
    const { patchText, code } = extractEmissionPatchBlock('const x = 1;\n');
    expect(patchText).toBeUndefined();
    expect(code).toBe('const x = 1;\n');
  });

  it('rejects unterminated and malformed blocks', () => {
    expect(() => extractEmissionPatchBlock('@minmap + e newHelper')).toThrow(/@end/);
    expect(() => extractEmissionPatchBlock('@minmap * bad @end code();')).toThrow(/patch/);
    expect(() => extractEmissionPatchBlock('@minmap + e @end code();')).toThrow(/patch/);
    expect(() => extractEmissionPatchBlock('@minmap - toolong99 @end code();')).toThrow(/patch/);
    expect(() => extractEmissionPatchBlock('@minmap ~ e @end code();')).toThrow(/patch/);
  });

  it('only terminates on @end at a token boundary, so embedded markers fail loudly', () => {
    expect(() => extractEmissionPatchBlock('@minmap + e corrupt@endName @end code();')).toThrow(/patch/);
    const { patchText } = extractEmissionPatchBlock('@minmap + e cleanName @end code();');
    expect(patchText).toBe('+ e cleanName');
  });
});

describe('resolveLanguageAdapter', () => {
  it('resolves typescript from the registered pack and rejects unregistered languages', async () => {
    const { resolveLanguageAdapter } = await import('../src/languages/registry.js');
    expect(resolveLanguageAdapter('typescript').language).toBe('typescript');
    expect(resolveLanguageAdapter('typescript').fileExtension).toBe('.ts');
    expect(() => resolveLanguageAdapter('rust')).toThrow(/language 'rust'/);
  });
});

describe('emitConstrained', () => {
  it('emits through an injected guidance runtime, applies patches, and returns pretty output', async () => {
    const root = await workspace();
    let capturedLark = '';
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'requestUrl',
      kind: 'ident',
      provenance: 'new'
    });

    const result = await emitConstrained({
      workspaceRoot: root,
      language: 'typescript',
      request: 'load widget data',
      capability: 'loadWidgetData',
      mode: 'ultra',
      map,
      completeWithGrammar: async ({ lark }) => {
        capturedLark = lark;
        return '@minmap + b loadWidgetData @end const b = (a) => fetch(a);';
      }
    });

    expect(result.guidance).toEqual({ used: true, available: true });
    expect(result.plan.strategy).toBe('minified');
    expect(result.minSource).toContain('const b = (a) => fetch(a);');
    expect(result.prettySource).toBe('const loadWidgetData = (requestUrl) => fetch(requestUrl);');
    expect(capturedLark).toContain('"@minmap"');

    const persistedMap = await loadMinMap(root, 'typescript');
    expect(prettyFor(persistedMap, 'b')).toBe('loadWidgetData');
    expect(prettyFor(persistedMap, 'a')).toBe('requestUrl');

    await access(result.artifacts!.minPath);
    await access(result.artifacts!.prettyPath);

    const ledger = await readEmissionLedger(root);
    expect(ledger.map((entry) => entry.type)).toEqual(['emission-plan', 'minmap-patch', 'constrained-emission']);
  });

  it('falls back deterministically when no guidance runtime is configured', async () => {
    const root = await workspace();
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'requestUrl',
      kind: 'ident',
      provenance: 'new'
    });

    const result = await emitConstrained({
      workspaceRoot: root,
      language: 'typescript',
      request: 'load widget data',
      capability: 'loadWidgetData',
      mode: 'ultra',
      map,
      fallbackMinSource: '@minmap + b loadWidgetData @end const b = (a) => fetch(a);'
    });

    expect(result.guidance.used).toBe(true);
    expect(result.guidance.available).toBe(false);
    expect(result.guidance.reason).toContain('guidance');
    expect(result.prettySource).toBe('const loadWidgetData = (requestUrl) => fetch(requestUrl);');
  });

  it('reports unavailable guidance without fabricating an emission', async () => {
    const root = await workspace();
    const result = await emitConstrained({
      workspaceRoot: root,
      language: 'typescript',
      request: 'load widget data',
      capability: 'loadWidgetData',
      mode: 'ultra',
      map: createMinMap('typescript')
    });

    expect(result.guidance).toEqual({ used: true, available: false, reason: 'no guidance runtime configured' });
    expect(result.minSource).toBeUndefined();
    expect(result.prettySource).toBeUndefined();
    expect(result.artifacts).toBeUndefined();
  });

  it('expands macro calls emitted through the min grammar', async () => {
    const root = await workspace();
    const registered = registerMacro(createMinMap('typescript'), HTTP_GET_JSON);

    const result = await emitConstrained({
      workspaceRoot: root,
      language: 'typescript',
      request: 'fetch json helper',
      capability: 'httpGetJson',
      mode: 'ultra',
      map: registered.map,
      macros: [HTTP_GET_JSON],
      completeWithGrammar: async () => `@minmap + u apiUrl + d widgetData @end const d = ${registered.entry.minId}(u);`
    });

    expect(result.plan.strategy).toBe('macro');
    expect(result.prettySource).toBe('const widgetData = await fetch(apiUrl).then((response) => response.json());');
  });

  it('rejects emissions that reference undeclared min ids', async () => {
    const root = await workspace();
    await expect(
      emitConstrained({
        workspaceRoot: root,
        language: 'typescript',
        request: 'load widget data',
        capability: 'loadWidgetData',
        mode: 'ultra',
        map: createMinMap('typescript'),
        completeWithGrammar: async () => 'const zz = 1;'
      })
    ).rejects.toThrow(/undeclared min id 'zz'/);
  });

  it('does not emit for plans satisfied below rung 6', async () => {
    const root = await workspace({
      'src/http.ts': 'export function httpGetJson(url: string) { return fetch(url); }\n'
    });
    const result = await emitConstrained({
      workspaceRoot: root,
      language: 'typescript',
      request: 'fetch json helper',
      capability: 'httpGetJson',
      mode: 'ultra',
      map: createMinMap('typescript'),
      completeWithGrammar: async () => 'const x = 1;'
    });

    expect(result.plan.strategy).toBe('reuse');
    expect(result.guidance.used).toBe(false);
    expect(result.minSource).toBeUndefined();
  });

  it('does not run the min pipeline for plain-mode emissions', async () => {
    const root = await workspace();
    const result = await emitConstrained({
      workspaceRoot: root,
      language: 'typescript',
      request: 'brand new thing',
      capability: 'frobnicateWidgets',
      mode: 'full',
      map: createMinMap('typescript')
    });

    expect(result.plan.strategy).toBe('plain');
    expect(result.guidance.used).toBe(false);
  });

  it('defaults to full mode and forwards carve-outs and dependency capabilities to the planner', async () => {
    const root = await workspace({
      'package.json': '{"name":"fixture","dependencies":{"zod":"^3.0.0"}}\n'
    });
    const result = await emitConstrained({
      workspaceRoot: root,
      language: 'typescript',
      request: 'validate schema',
      capability: 'schemaValidation',
      map: createMinMap('typescript'),
      carve_outs: ['licensing'],
      dependencyCapabilities: { zod: ['schemaValidation'] }
    });

    expect(result.plan.mode).toBe('full');
    expect(result.plan.strategy).toBe('dependency');
    expect(result.guidance.used).toBe(false);
  });

  it('rejects emissions that do not parse', async () => {
    const root = await workspace();
    await expect(
      emitConstrained({
        workspaceRoot: root,
        language: 'typescript',
        request: 'load widget data',
        capability: 'loadWidgetData',
        mode: 'ultra',
        map: createMinMap('typescript'),
        completeWithGrammar: async () => 'const ((( {'
      })
    ).rejects.toThrow(/parse/);
  });

  it('rejects languages without a registered adapter', async () => {
    const root = await workspace();
    await expect(
      emitConstrained({
        workspaceRoot: root,
        language: 'python',
        request: 'load widget data',
        capability: 'loadWidgetData',
        mode: 'ultra',
        map: createMinMap('python'),
        fallbackMinSource: 'x = 1'
      })
    ).rejects.toThrow(/language 'python'/);
  });
});
