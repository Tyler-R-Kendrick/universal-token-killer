import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defineTemplate,
  extractSlotReferences,
  grammarSlot,
  inlineGrammarSlot,
  type TemplateDescriptor
} from '../src/templates/defineTemplate.js';
import {
  cacheTemplateDescriptor,
  loadTemplateDescriptor,
  readTemplateDescriptorCache,
  renderTemplate,
  templateCachePath
} from '../src/templates/templateRuntime.js';

describe('defineTemplate', () => {
  it('validates a complete template', () => {
    const template = defineTemplate({
      id: 'git.checkout',
      tool: 'git',
      prompt: 'git checkout {{ref}}',
      slots: {
        ref: grammarSlot({ tool: 'git', field: 'ref', description: 'branch', maxTokens: 50 })
      },
      metadata: { source: 'test' }
    });
    expect(template.slots.ref?.grammar.kind).toBe('pack');
    expect(template.slots.ref?.description).toBe('branch');
    expect(template.slots.ref?.maxTokens).toBe(50);
  });

  it('supports inline lark grammar slots without optional fields', () => {
    const slot = inlineGrammarSlot({ lark: 'start: TOK\nTOK: /\\w+/' });
    expect(slot.grammar.kind).toBe('inline');
    expect(slot.description).toBeUndefined();
    expect(slot.maxTokens).toBeUndefined();
  });

  it('supports inline lark grammar slots with optional fields', () => {
    const slot = inlineGrammarSlot({ lark: 'start: TOK\nTOK: /\\w+/', description: 'inline', maxTokens: 10 });
    expect(slot.description).toBe('inline');
    expect(slot.maxTokens).toBe(10);
  });

  it('supports a grammar slot without optional fields', () => {
    const slot = grammarSlot({ tool: 'git', field: 'ref' });
    expect(slot.description).toBeUndefined();
    expect(slot.maxTokens).toBeUndefined();
  });

  it('accepts json-schema grammar refs', () => {
    const template = defineTemplate({
      id: 't',
      prompt: 'hi {{a}}',
      slots: { a: { grammar: { kind: 'json-schema', schema: { type: 'string' } } } }
    });
    expect(template.slots.a?.grammar.kind).toBe('json-schema');
  });

  it('extracts slot references from a prompt', () => {
    expect(extractSlotReferences('a {{ x }} b {{ y }} c {{ x }}').sort()).toEqual(['x', 'y']);
    expect(extractSlotReferences('no placeholders here')).toEqual([]);
  });

  it('rejects templates missing required fields', () => {
    expect(() => defineTemplate({} as TemplateDescriptor)).toThrow(/id is required/);
    expect(() => defineTemplate({ id: 'x', prompt: undefined as unknown as string, slots: {} })).toThrow(/string prompt/);
    expect(() => defineTemplate({ id: 'x', prompt: '', slots: undefined as unknown as Record<string, never> })).toThrow(/define slots/);
  });

  it('rejects references to undefined slots and invalid grammar shapes', () => {
    expect(() => defineTemplate({ id: 'x', prompt: '{{a}}', slots: {} })).toThrow(/undefined slot/);
    expect(() =>
      defineTemplate({ id: 'x', prompt: '{{a}}', slots: { a: { grammar: undefined as unknown as { kind: 'inline'; lark: string } } } })
    ).toThrow(/missing a grammar/);
    expect(() =>
      defineTemplate({ id: 'x', prompt: '{{a}}', slots: { a: { grammar: { kind: 'pack', tool: '', field: '' } } } })
    ).toThrow(/pack grammar/);
    expect(() =>
      defineTemplate({ id: 'x', prompt: '{{a}}', slots: { a: { grammar: { kind: 'inline', lark: '' } } } })
    ).toThrow(/inline grammar/);
    expect(() =>
      defineTemplate({
        id: 'x',
        prompt: '{{a}}',
        slots: { a: { grammar: { kind: 'json-schema', schema: undefined as unknown as Record<string, unknown> } } }
      })
    ).toThrow(/json-schema/);
    expect(() =>
      defineTemplate({
        id: 'x',
        prompt: '{{a}}',
        slots: { a: { grammar: { kind: 'unknown' as unknown as 'inline', lark: '' } } }
      })
    ).toThrow(/grammar kind/);
  });
});

describe('renderTemplate', () => {
  it('returns prompts unchanged when there are no slot references', async () => {
    const template = defineTemplate({ id: 't', prompt: 'no slots here', slots: {} });
    const rendered = await renderTemplate(template);
    expect(rendered).toBe('no slots here');
  });

  it('substitutes inputs for slot placeholders', async () => {
    const template = defineTemplate({
      id: 't',
      prompt: 'hi {{name}}',
      slots: { name: inlineGrammarSlot({ lark: 'start: x' }) }
    });
    const rendered = await renderTemplate(template, { inputs: { name: 'alice' } });
    expect(rendered).toBe('hi alice');
  });

  it('invokes completeWithGrammar for missing inputs and resolves pack grammars', async () => {
    const template = defineTemplate({
      id: 't',
      prompt: 'do {{action}} on {{ref}}',
      slots: {
        action: inlineGrammarSlot({ lark: 'start: A\nA: "run"', maxTokens: 5 }),
        ref: grammarSlot({ tool: 'git', field: 'ref' })
      }
    });
    const completions: Array<{ slot: string; lark: string }> = [];
    const rendered = await renderTemplate(template, {
      resolveGrammar: async (ref) => {
        if (ref.kind !== 'pack') throw new Error('expected pack ref');
        return `start: REF\nREF: "main"\n`;
      },
      completeWithGrammar: async ({ slotName, lark, maxTokens }) => {
        completions.push({ slot: slotName, lark });
        return slotName === 'action' ? `run` : `main(${maxTokens ?? 'none'})`;
      }
    });
    expect(rendered).toBe('do run on main(none)');
    expect(completions[0]?.slot).toBe('action');
    expect(completions[1]?.lark).toContain('REF');
  });

  it('errors when neither inputs nor completer are provided', async () => {
    const template = defineTemplate({
      id: 't',
      prompt: 'a {{x}}',
      slots: { x: inlineGrammarSlot({ lark: 'start: x' }) }
    });
    await expect(renderTemplate(template)).rejects.toThrow(/requires a completion function/);
  });

  it('throws when a hand-built descriptor references an undefined slot', async () => {
    const descriptor: TemplateDescriptor = {
      id: 't',
      prompt: 'a {{missing}}',
      slots: {}
    };
    await expect(renderTemplate(descriptor)).rejects.toThrow(/undefined slot/);
  });

  it('throws when pack grammars are referenced without a resolver', async () => {
    const template = defineTemplate({
      id: 't',
      prompt: 'a {{x}}',
      slots: { x: grammarSlot({ tool: 'git', field: 'ref' }) }
    });
    await expect(
      renderTemplate(template, { completeWithGrammar: async () => 'main' })
    ).rejects.toThrow(/resolveGrammar/);
  });

  it('throws when json-schema grammars are referenced without a resolver', async () => {
    const template = defineTemplate({
      id: 't',
      prompt: 'a {{x}}',
      slots: { x: { grammar: { kind: 'json-schema', schema: { type: 'string' } } } }
    });
    await expect(
      renderTemplate(template, { completeWithGrammar: async () => 'value' })
    ).rejects.toThrow(/json-schema/);
  });
});

describe('template descriptor cache and loader', () => {
  it('writes and reads cached descriptors', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-template-cache-'));
    const template = defineTemplate({
      id: 't',
      prompt: 'x {{a}}',
      slots: { a: inlineGrammarSlot({ lark: 'start: a' }) }
    });
    const cachePath = await cacheTemplateDescriptor(workspace, template);
    const cached = await readTemplateDescriptorCache(cachePath);
    expect(cached?.id).toBe('t');
    expect(await readTemplateDescriptorCache(path.join(workspace, 'missing.json'))).toBeUndefined();
    expect(templateCachePath(workspace, template)).toBe(cachePath);
  });

  it('loads template descriptors from .js modules', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-template-load-'));
    const file = path.join(workspace, 'template.js');
    await writeFile(
      file,
      `export default { id: 't', prompt: 'x {{a}}', slots: { a: { grammar: { kind: 'inline', lark: 'start: a' } } } };`,
      'utf8'
    );
    const descriptor = await loadTemplateDescriptor(file);
    expect(descriptor.id).toBe('t');
  });

  it('rejects modules without a default export or with the wrong shape', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-template-bad-'));
    const noDefault = path.join(workspace, 'no-default.js');
    await writeFile(noDefault, `export const x = 1;`, 'utf8');
    await expect(loadTemplateDescriptor(noDefault)).rejects.toThrow(/default export/);

    const wrongShape = path.join(workspace, 'wrong-shape.js');
    await writeFile(wrongShape, `export default { id: 1 };`, 'utf8');
    await expect(loadTemplateDescriptor(wrongShape)).rejects.toThrow(/TemplateDescriptor/);
  });
});

describe('cacheTemplateDescriptor (existing workspace)', () => {
  it('writes into a nested cache directory', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-template-nested-'));
    await mkdir(path.join(workspace, '.utk'), { recursive: true });
    const template = defineTemplate({
      id: 't',
      prompt: 'x {{a}}',
      slots: { a: inlineGrammarSlot({ lark: 'start: a' }) }
    });
    const cachePath = await cacheTemplateDescriptor(workspace, template);
    const text = await readFile(cachePath, 'utf8');
    expect(text).toContain('"id": "t"');
  });
});
