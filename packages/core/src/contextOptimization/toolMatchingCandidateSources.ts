import type { UtkConfig } from '../config/config.js';

export function collectToolDefinitions(tools: unknown, config: UtkConfig): Array<[string, Record<string, unknown>]> {
  const byName = new Map<string, Record<string, unknown>>();
  if (Array.isArray(tools)) {
    for (const tool of tools) {
      if (!isObject(tool)) continue;
      const name = toolName(tool);
      if (name) byName.set(name, tool);
    }
  }
  for (const entry of config.tools.registry) {
    if (byName.has(entry.tool) || entry.tool.includes('*')) continue;
    byName.set(entry.tool, registryToolDefinition(entry));
  }

  return [...byName.entries()];
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function registryToolDefinition(entry: UtkConfig['tools']['registry'][number]): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: entry.tool,
      description: entry.description ?? '',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  };
}

function toolName(tool: Record<string, unknown>): string | undefined {
  const fn = isObject(tool.function) ? tool.function : undefined;
  return typeof fn?.name === 'string' && fn.name ? fn.name : undefined;
}
