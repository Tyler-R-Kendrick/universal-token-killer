import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalJson, contentHash } from '../artifact/canonical.js';
import { safeJoin } from '../security/pathSafety.js';
import { recordFailure, type RunContext } from '../tracing/index.js';
import { defineTemplate, extractSlotReferences, type GrammarRef, type Slot, type TemplateDescriptor } from './defineTemplate.js';

export type GrammarCompletion = (params: { prompt: string; lark: string; slotName: string; maxTokens?: number }) => Promise<string>;

export type TemplateRenderOptions = {
  inputs?: Partial<Record<string, string>>;
  resolveGrammar?: (ref: GrammarRef) => Promise<string>;
  completeWithGrammar?: GrammarCompletion;
};

export async function renderTemplate(descriptor: TemplateDescriptor, options: TemplateRenderOptions = {}): Promise<string> {
  const inputs = options.inputs ?? {};
  const referenced = extractSlotReferences(descriptor.prompt);
  const parts: string[] = [];
  let cursor = 0;
  const pattern = /\{\{\s*([A-Za-z_][\w-]*)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(descriptor.prompt)) !== null) {
    parts.push(descriptor.prompt.slice(cursor, match.index));
    const slotName = match[1]!;
    const provided = inputs[slotName];
    if (provided !== undefined) {
      parts.push(provided);
    } else {
      const slot = descriptor.slots[slotName];
      if (!slot) {
        throw new Error(`Template ${descriptor.id} references undefined slot {{${slotName}}}`);
      }
      parts.push(await completeSlot(descriptor, slotName, slot, parts.join(''), options));
    }
    cursor = match.index + match[0].length;
  }
  parts.push(descriptor.prompt.slice(cursor));
  if (referenced.length === 0) {
    return descriptor.prompt;
  }
  return parts.join('');
}

async function completeSlot(
  descriptor: TemplateDescriptor,
  slotName: string,
  slot: Slot,
  promptSoFar: string,
  options: TemplateRenderOptions
): Promise<string> {
  if (!options.completeWithGrammar) {
    throw new Error(`Template ${descriptor.id} slot '${slotName}' requires a completion function or pre-filled input`);
  }
  const lark = await resolveLark(slot.grammar, options);
  const completion = options.completeWithGrammar({
    prompt: promptSoFar,
    lark,
    slotName,
    ...(slot.maxTokens !== undefined ? { maxTokens: slot.maxTokens } : {})
  });
  return await completion;
}

async function resolveLark(ref: GrammarRef, options: TemplateRenderOptions): Promise<string> {
  if (ref.kind === 'inline') return ref.lark;
  if (options.resolveGrammar) return await options.resolveGrammar(ref);
  const descriptor = ref.kind === 'pack' ? `${ref.tool}/${ref.field}` : 'json-schema';
  throw new Error(`Template references ${ref.kind} grammar ${descriptor} but no resolveGrammar was provided`);
}

export async function loadTemplateDescriptor(filePath: string): Promise<TemplateDescriptor> {
  const moduleUrl = pathToFileURL(filePath).href;
  const imported = (await import(moduleUrl)) as { default?: unknown };
  const descriptor = imported.default;
  if (!descriptor || typeof descriptor !== 'object') {
    throw new Error(`Template module ${filePath} must have a default export`);
  }
  const candidate = descriptor as Partial<TemplateDescriptor>;
  if (typeof candidate.id !== 'string' || typeof candidate.prompt !== 'string' || !candidate.slots) {
    throw new Error(`Template module ${filePath} did not default-export a valid TemplateDescriptor`);
  }
  return defineTemplate(candidate as TemplateDescriptor);
}

export function templateCachePath(workspaceRoot: string, descriptor: TemplateDescriptor): string {
  const hash = contentHash(descriptor, 16);
  return safeJoin(workspaceRoot, '.utk', 'cache', 'templates', `${hash}.json`);
}

export async function cacheTemplateDescriptor(workspaceRoot: string, descriptor: TemplateDescriptor): Promise<string> {
  const cachePath = templateCachePath(workspaceRoot, descriptor);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, canonicalJson(descriptor), 'utf8');
  return cachePath;
}

export async function readTemplateDescriptorCache(cachePath: string, options: { tracer?: RunContext } = {}): Promise<TemplateDescriptor | undefined> {
  try {
    const text = await readFile(cachePath, 'utf8');
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Template cache ${cachePath} does not contain an object descriptor`);
    }
    // Run the same guardrails as `loadTemplateDescriptor` — a corrupted cache
    // entry should not silently surface as a runtime error in a downstream
    // template render.
    return defineTemplate(parsed as TemplateDescriptor);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      recordFailure(options.tracer, {
        name: 'template.load',
        runType: 'parser',
        error: error as Error,
        extra: { cachePath }
      });
    }
    return undefined;
  }
}
