import type { UtkConfig } from './configTypes.js';
import {
  readBoolean,
  readObject,
  readOptionalObject,
  readString,
  readStringArray
} from './configReaders.js';

export function normalizeRegisteredTools(value: unknown): UtkConfig['tools']['registry'] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('tools.registry must be an array');
  }
  return value.map((item) => {
    const object = readObject(item, 'tools.registry[]');
    return {
      tool: readString(object.tool, ''),
      description: object.description === undefined ? undefined : readString(object.description, ''),
      output_cache: readBoolean(object.output_cache, false),
      bypass_on_cache: readBoolean(object.bypass_on_cache, false),
      curry_fields: readStringArray(object.curry_fields, [], 'tools.registry[].curry_fields'),
      lexical_aliases: readStringArray(object.lexical_aliases, [], 'tools.registry[].lexical_aliases'),
      lexical_regexes: readStringArray(object.lexical_regexes, [], 'tools.registry[].lexical_regexes'),
      bypass_on_match: readBoolean(object.bypass_on_match, false),
      default_args: readOptionalObject(object.default_args),
      structured_fields: normalizeStructuredFields(object.structured_fields)
    };
  });
}

export function resolveRegisteredTool(config: UtkConfig, toolId: string): UtkConfig['tools']['registry'][number] | undefined {
  const exact = config.tools.registry.find((item) => item.tool === toolId);
  if (exact) return exact;
  return config.tools.registry.find((item) => item.tool.endsWith('*') && toolMatches(item.tool, toolId));
}

export function toolMatches(pattern: string, toolId: string): boolean {
  if (pattern.endsWith('*')) return toolId.startsWith(pattern.slice(0, -1));
  return false;
}

function normalizeStructuredFields(value: unknown): UtkConfig['tools']['registry'][number]['structured_fields'] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('tools.registry[].structured_fields must be an array');
  }
  return value.map((item) => {
    const object = readObject(item, 'tools.registry[].structured_fields[]');
    return {
      name: readString(object.name, ''),
      completions: readStringArray(object.completions, [], 'tools.registry[].structured_fields[].completions'),
      required: object.required === undefined ? undefined : readBoolean(object.required, false),
      description: object.description === undefined ? undefined : readString(object.description, '')
    };
  });
}
