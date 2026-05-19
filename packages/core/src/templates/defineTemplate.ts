export type GrammarRef =
  | { kind: 'pack'; tool: string; field: string }
  | { kind: 'inline'; lark: string }
  | { kind: 'json-schema'; schema: Record<string, unknown> };

export type Slot = {
  grammar: GrammarRef;
  description?: string;
  maxTokens?: number;
};

export type TemplateDescriptor = {
  id: string;
  tool?: string;
  prompt: string;
  slots: Record<string, Slot>;
  metadata?: Record<string, unknown>;
};

export function defineTemplate(descriptor: TemplateDescriptor): TemplateDescriptor {
  if (!descriptor.id || typeof descriptor.id !== 'string') {
    throw new Error('Template id is required');
  }
  if (typeof descriptor.prompt !== 'string') {
    throw new Error(`Template ${descriptor.id} must have a string prompt`);
  }
  if (!descriptor.slots || typeof descriptor.slots !== 'object') {
    throw new Error(`Template ${descriptor.id} must define slots`);
  }
  const referenced = extractSlotReferences(descriptor.prompt);
  for (const slotName of referenced) {
    if (!Object.prototype.hasOwnProperty.call(descriptor.slots, slotName)) {
      throw new Error(`Template ${descriptor.id} references undefined slot {{${slotName}}}`);
    }
  }
  for (const [slotName, slot] of Object.entries(descriptor.slots)) {
    if (!slot || !slot.grammar) {
      throw new Error(`Template ${descriptor.id} slot '${slotName}' is missing a grammar`);
    }
    validateGrammarRef(descriptor.id, slotName, slot.grammar);
  }
  return descriptor;
}

export function grammarSlot(params: { tool: string; field: string; description?: string; maxTokens?: number }): Slot {
  const slot: Slot = {
    grammar: { kind: 'pack', tool: params.tool, field: params.field }
  };
  if (params.description !== undefined) slot.description = params.description;
  if (params.maxTokens !== undefined) slot.maxTokens = params.maxTokens;
  return slot;
}

export function inlineGrammarSlot(params: { lark: string; description?: string; maxTokens?: number }): Slot {
  const slot: Slot = { grammar: { kind: 'inline', lark: params.lark } };
  if (params.description !== undefined) slot.description = params.description;
  if (params.maxTokens !== undefined) slot.maxTokens = params.maxTokens;
  return slot;
}

export function extractSlotReferences(prompt: string): string[] {
  const seen = new Set<string>();
  const pattern = /\{\{\s*([A-Za-z_][\w-]*)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(prompt)) !== null) {
    seen.add(match[1]!);
  }
  return [...seen];
}

function validateGrammarRef(templateId: string, slotName: string, ref: GrammarRef): void {
  if (ref.kind === 'pack') {
    if (!ref.tool || !ref.field) {
      throw new Error(`Template ${templateId} slot '${slotName}' pack grammar must reference tool and field`);
    }
    return;
  }
  if (ref.kind === 'inline') {
    if (!ref.lark || typeof ref.lark !== 'string') {
      throw new Error(`Template ${templateId} slot '${slotName}' inline grammar must include lark source`);
    }
    return;
  }
  if (ref.kind === 'json-schema') {
    if (!ref.schema || typeof ref.schema !== 'object') {
      throw new Error(`Template ${templateId} slot '${slotName}' json-schema grammar must include a schema`);
    }
    return;
  }
  throw new Error(`Template ${templateId} slot '${slotName}' has unsupported grammar kind`);
}
