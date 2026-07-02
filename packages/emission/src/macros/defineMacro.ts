import { defineTemplate, extractSlotReferences, inlineGrammarSlot, renderTemplate } from '@utk/core';
import { readPackagedGrammar } from '../grammars/grammarFiles.js';
import { allocateEntry } from '../minmap/allocator.js';
import { PRETTY_NAME_PATTERN, type MinMap, type MinMapEntry } from '../minmap/format.js';

export type MacroDescriptor = {
  name: string;
  description?: string;
  /** Ordered parameter names, referenced as {{param}} slots in the expansion. */
  params: string[];
  /** Pretty-source template the macro call expands to. */
  expansion: string;
};

export type RegisteredMacro = {
  map: MinMap;
  entry: MinMapEntry;
};

const MACRO_ARG_LARK = readPackagedGrammar('macro-arg.lark');

export function defineMacro(descriptor: MacroDescriptor): MacroDescriptor {
  if (typeof descriptor.name !== 'string' || !PRETTY_NAME_PATTERN.test(descriptor.name)) {
    throw new Error(`Macro name '${String(descriptor.name)}' must be a valid identifier`);
  }
  for (const param of descriptor.params) {
    if (!PRETTY_NAME_PATTERN.test(param)) {
      throw new Error(`Macro '${descriptor.name}' param '${param}' must be a valid identifier`);
    }
  }
  if (new Set(descriptor.params).size !== descriptor.params.length) {
    throw new Error(`Macro '${descriptor.name}' declares duplicate params`);
  }
  if (typeof descriptor.expansion !== 'string' || descriptor.expansion.length === 0) {
    throw new Error(`Macro '${descriptor.name}' requires a non-empty expansion`);
  }
  const referenced = extractSlotReferences(descriptor.expansion);
  for (const reference of referenced) {
    if (!descriptor.params.includes(reference)) {
      throw new Error(`Macro '${descriptor.name}' expansion references undeclared param {{${reference}}}`);
    }
  }
  for (const param of descriptor.params) {
    if (!referenced.includes(param)) {
      throw new Error(`Macro '${descriptor.name}' declares unused param '${param}'`);
    }
  }
  return descriptor;
}

export function registerMacro(map: MinMap, macro: MacroDescriptor): RegisteredMacro {
  return allocateEntry(map, { pretty: macro.name, kind: 'macro', provenance: 'new' });
}

export async function expandMacro(macro: MacroDescriptor, args: string[]): Promise<string> {
  if (args.length !== macro.params.length) {
    throw new Error(`Macro '${macro.name}' expects ${macro.params.length} arguments, got ${args.length}`);
  }
  const descriptor = defineTemplate({
    id: `macro:${macro.name}`,
    prompt: macro.expansion,
    slots: Object.fromEntries(macro.params.map((param) => [param, inlineGrammarSlot({ lark: MACRO_ARG_LARK })]))
  });
  return await renderTemplate(descriptor, {
    inputs: Object.fromEntries(macro.params.map((param, index) => [param, args[index]!]))
  });
}
