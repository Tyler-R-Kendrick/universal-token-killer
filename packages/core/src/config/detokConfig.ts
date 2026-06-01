import {
  DEFAULT_DENY_TOOLS,
  DEFAULT_PROTECTED_FIELDS,
  DEFAULT_REWRITE_FIELDS
} from './defaults.js';
import type { UtkConfig } from './configTypes.js';
import {
  clampNumber,
  readBoolean,
  readFiniteNumber,
  readNamedOptionalObject,
  readObject,
  readString,
  readStringArray
} from './configReaders.js';

export function normalizeDetokPrompt(value: unknown): UtkConfig['detok']['prompt'] {
  const prompt = readNamedOptionalObject(value, 'detok.prompt');
  const rate = readFiniteNumber(prompt.rate, 0.33, 'detok.prompt.rate');
  const minChars = readFiniteNumber(prompt.min_chars, 0, 'detok.prompt.min_chars');
  return {
    model: readString(prompt.model, 'default/LLMLingua2'),
    rate: clampNumber(rate, 0.05, 1),
    min_chars: Math.max(0, Math.floor(minChars))
  };
}

export function normalizeCopilotPreToolUse(value: unknown): UtkConfig['detok']['copilot_pre_tool_use'] {
  const hook = readNamedOptionalObject(value, 'detok.copilot_pre_tool_use');
  const rate = readFiniteNumber(hook.rate, 0.33, 'detok.copilot_pre_tool_use.rate');
  const minChars = readFiniteNumber(hook.min_chars, 8000, 'detok.copilot_pre_tool_use.min_chars');

  return {
    enabled: readBoolean(hook.enabled, true),
    rate,
    min_chars: minChars,
    deny_tools: readStringArray(hook.deny_tools, DEFAULT_DENY_TOOLS, 'detok.copilot_pre_tool_use.deny_tools'),
    rewrite_fields: readStringArray(hook.rewrite_fields, DEFAULT_REWRITE_FIELDS, 'detok.copilot_pre_tool_use.rewrite_fields'),
    protected_fields: readStringArray(hook.protected_fields, DEFAULT_PROTECTED_FIELDS, 'detok.copilot_pre_tool_use.protected_fields'),
    overrides: normalizeDetokOverrides(hook.overrides)
  };
}

function normalizeDetokOverrides(value: unknown): UtkConfig['detok']['copilot_pre_tool_use']['overrides'] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('detok.copilot_pre_tool_use.overrides must be an array');
  }
  return value.map((item) => {
    const object = readObject(item, 'detok.copilot_pre_tool_use.overrides[]');
    const override: UtkConfig['detok']['copilot_pre_tool_use']['overrides'][number] = {
      tool: readString(object.tool, '')
    };
    if (object.enabled !== undefined) override.enabled = readBoolean(object.enabled, true);
    if (object.rewrite_fields !== undefined) {
      override.rewrite_fields = readStringArray(object.rewrite_fields, [], 'detok.copilot_pre_tool_use.overrides[].rewrite_fields');
    }
    if (object.protected_fields !== undefined) {
      override.protected_fields = readStringArray(object.protected_fields, [], 'detok.copilot_pre_tool_use.overrides[].protected_fields');
    }
    return override;
  });
}
