import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defineMacro } from '../src/macros/defineMacro.js';
import { readEmissionLedger } from '../src/macros/ledger.js';
import {
  EMISSION_MODES,
  EMISSION_SAFETY_CARVE_OUTS,
  resolveEmissionPolicy
} from '../src/ladder/policy.js';
import { planEmission } from '../src/ladder/planEmission.js';
import { registerLanguagePack } from '../src/languages/registry.js';
import { typescriptLanguagePack } from '../../plugins/languages/typescript/src/index.js';

registerLanguagePack(typescriptLanguagePack);

const HTTP_GET_JSON = defineMacro({
  name: 'httpGetJson',
  params: ['targetUrl'],
  expansion: 'await fetch({{targetUrl}}).then((response) => response.json())'
});

async function workspace(files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'utk-emission-ladder-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf8');
  }
  return root;
}

describe('emission policy', () => {
  it('declares the ponytail-style intensity modes', () => {
    expect(EMISSION_MODES).toEqual(['lite', 'full', 'ultra', 'off']);
  });

  it('defaults to full mode with every safety carve-out', () => {
    const policy = resolveEmissionPolicy();
    expect(policy.mode).toBe('full');
    expect(policy.carveOuts).toEqual(EMISSION_SAFETY_CARVE_OUTS);
  });

  it('never lets any mode or config drop the built-in carve-outs', () => {
    for (const mode of EMISSION_MODES) {
      const policy = resolveEmissionPolicy({ mode, carve_outs: [] });
      for (const carveOut of EMISSION_SAFETY_CARVE_OUTS) {
        expect(policy.carveOuts).toContain(carveOut);
      }
    }
  });

  it('keeps additional workspace carve-outs without duplicating built-ins', () => {
    const policy = resolveEmissionPolicy({ carve_outs: ['licensing', 'security'] });
    expect(policy.carveOuts).toContain('licensing');
    expect(policy.carveOuts.length).toBe(EMISSION_SAFETY_CARVE_OUTS.length + 1);
  });

  it('rejects unknown modes', () => {
    expect(() => resolveEmissionPolicy({ mode: 'turbo' })).toThrow(/mode/);
  });
});

describe('planEmission ladder', () => {
  it('stops at rung 2 when the capability already exists in the codebase', async () => {
    const root = await workspace({
      'src/http.ts': 'export function httpGetJson(url: string) { return fetch(url); }\n'
    });
    const plan = await planEmission({ workspaceRoot: root, language: 'typescript', request: 'fetch json', capability: 'httpGetJson' });

    expect(plan.selectedRung).toBe(2);
    expect(plan.strategy).toBe('reuse');
    expect(plan.decisions.find((decision) => decision.rung === 2)?.evidence).toContain('src/http.ts');
    expect(plan.decisions.find((decision) => decision.rung === 1)?.outcome).toBe('resolved');
  });

  it('stops at rung 3 for stdlib-covered capabilities', async () => {
    const root = await workspace();
    const plan = await planEmission({ workspaceRoot: root, language: 'typescript', request: 'deep clone', capability: 'structuredClone' });
    expect(plan.selectedRung).toBe(3);
    expect(plan.strategy).toBe('stdlib');
  });

  it('stops at rung 4 for platform capabilities', async () => {
    const root = await workspace();
    const plan = await planEmission({ workspaceRoot: root, language: 'typescript', request: 'http get', capability: 'fetch' });
    expect(plan.selectedRung).toBe(4);
    expect(plan.strategy).toBe('platform');
  });

  it('stops at rung 5 when an installed dependency covers the capability', async () => {
    const root = await workspace({
      'package.json': '{"name":"fixture","dependencies":{"zod":"^3.0.0"}}\n'
    });
    const plan = await planEmission({
      workspaceRoot: root,
      language: 'typescript',
      request: 'validate schema',
      capability: 'schemaValidation',
      dependencyCapabilities: { zod: ['schemaValidation'] }
    });
    expect(plan.selectedRung).toBe(5);
    expect(plan.strategy).toBe('dependency');
    expect(plan.decisions.find((decision) => decision.rung === 5)?.evidence).toContain('zod');
  });

  it('treats malformed package manifests as unresolved rather than crashing', async () => {
    const root = await workspace({ 'package.json': 'not json' });
    const plan = await planEmission({
      workspaceRoot: root,
      language: 'typescript',
      request: 'validate schema',
      capability: 'schemaValidation',
      dependencyCapabilities: { zod: ['schemaValidation'] }
    });
    expect(plan.selectedRung).toBe(7);
  });

  it('selects a macro at rung 6 in full mode and plain emission in lite mode', async () => {
    const root = await workspace();
    const full = await planEmission({
      workspaceRoot: root,
      language: 'typescript',
      request: 'fetch json',
      capability: 'httpGetJson',
      macros: [HTTP_GET_JSON],
      mode: 'full'
    });
    expect(full.selectedRung).toBe(6);
    expect(full.strategy).toBe('macro');

    const lite = await planEmission({
      workspaceRoot: root,
      language: 'typescript',
      request: 'fetch json',
      capability: 'httpGetJson',
      macros: [HTTP_GET_JSON],
      mode: 'lite'
    });
    expect(lite.selectedRung).toBe(7);
    expect(lite.strategy).toBe('plain');
  });

  it('reaches rung 7 minified in ultra mode and plain in full mode for new capabilities', async () => {
    const root = await workspace();
    const ultra = await planEmission({ workspaceRoot: root, language: 'typescript', request: 'brand new', capability: 'frobnicateWidgets', mode: 'ultra' });
    expect(ultra.selectedRung).toBe(7);
    expect(ultra.strategy).toBe('minified');

    const full = await planEmission({ workspaceRoot: root, language: 'typescript', request: 'brand new', capability: 'frobnicateWidgets' });
    expect(full.selectedRung).toBe(7);
    expect(full.strategy).toBe('plain');
  });

  it('skips the ladder entirely in off mode', async () => {
    const root = await workspace();
    const plan = await planEmission({ workspaceRoot: root, language: 'typescript', request: 'anything', capability: 'anythingAtAll', mode: 'off' });
    expect(plan.selectedRung).toBeUndefined();
    expect(plan.strategy).toBe('none');
    expect(plan.decisions).toEqual([]);
  });

  it('persists a canonical plan artifact with carve-outs and a ledger entry', async () => {
    const root = await workspace();
    const plan = await planEmission({ workspaceRoot: root, language: 'typescript', request: 'deep clone', capability: 'structuredClone' });

    expect(plan.planPath).toContain(path.join('.utk', 'emission', 'plans'));
    const persisted = JSON.parse(await readFile(plan.planPath, 'utf8')) as { planHash: string; carveOuts: string[] };
    expect(persisted.planHash).toBe(plan.planHash);
    expect(persisted.carveOuts).toEqual([...EMISSION_SAFETY_CARVE_OUTS]);
    expect(plan.carveOuts).toEqual([...EMISSION_SAFETY_CARVE_OUTS]);

    const ledger = await readEmissionLedger(root);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.type).toBe('emission-plan');
    expect(ledger[0]!.data['planHash']).toBe(plan.planHash);
  });

  it('falls through to rung 7 for languages without capability indexes', async () => {
    const root = await workspace({
      'package.json': '{"name":"fixture","devDependencies":{"pytest":"^8.0.0"}}\n'
    });
    const plan = await planEmission({
      workspaceRoot: root,
      language: 'python',
      request: 'deep clone',
      capability: 'structuredClone',
      carve_outs: ['licensing'],
      dependencyCapabilities: { pytest: ['testRunner'] }
    });
    expect(plan.selectedRung).toBe(7);
    expect(plan.strategy).toBe('plain');
  });

  it('produces identical plan hashes for identical inputs', async () => {
    const rootA = await workspace();
    const rootB = await workspace();
    const first = await planEmission({ workspaceRoot: rootA, language: 'typescript', request: 'deep clone', capability: 'structuredClone' });
    const second = await planEmission({ workspaceRoot: rootB, language: 'typescript', request: 'deep clone', capability: 'structuredClone' });
    expect(first.planHash).toBe(second.planHash);
  });
});
