import {
  DEFAULT_PROMPT_SURFACES,
  OBSERVE_ONLY,
  PIPE_INDEX_ONLY
} from './defaults.js';
import type { UtkConfig } from './configTypes.js';
import {
  readBoolean,
  readFiniteNumber,
  readNamedOptionalObject,
  readNumber,
  readString,
  readStringArray,
  readStringEnum
} from './configReaders.js';

export function normalizePromptOptimization(value: Record<string, unknown>): UtkConfig['prompt_optimization'] {
  return {
    enabled: readBoolean(value.enabled, true),
    surfaces: readStringArray(value.surfaces, DEFAULT_PROMPT_SURFACES, 'prompt_optimization.surfaces'),
    min_tokens: readNumber(value.min_tokens, 256),
    target_ratio: readNumber(value.target_ratio, 0.5),
    persist_originals: readBoolean(value.persist_originals, true),
    cache_volatility: readStringEnum(value.cache_volatility, 'observe', OBSERVE_ONLY, 'prompt_optimization cache_volatility'),
    asset_style: readStringEnum(value.asset_style, 'pipe-index', PIPE_INDEX_ONLY, 'prompt_optimization asset_style')
  };
}

export function normalizeCodeGraph(value: Record<string, unknown>): UtkConfig['code_graph'] {
  return {
    enabled_languages: readCodeGraphLanguages(value.enabled_languages),
    ignored_globs: readStringArray(value.ignored_globs, [], 'code_graph.ignored_globs'),
    max_context_tokens: Math.max(1, Math.floor(readFiniteNumber(value.max_context_tokens, 1200, 'code_graph.max_context_tokens'))),
    storage_root: readString(value.storage_root, '.utk/code-graph'),
    engine_path: readString(value.engine_path, '')
  };
}

function readCodeGraphLanguages(value: unknown): UtkConfig['code_graph']['enabled_languages'] {
  const languages = readStringArray(value, ['typescript', 'javascript'], 'code_graph.enabled_languages');
  const invalid = languages.find((language) => language !== 'typescript' && language !== 'javascript');
  if (invalid) throw new Error(`Unsupported code_graph enabled language: ${invalid}`);
  return languages as UtkConfig['code_graph']['enabled_languages'];
}

export function normalizeTracing(value: unknown): UtkConfig['tracing'] {
  const tracing = readNamedOptionalObject(value, 'tracing');
  return {
    enabled: readBoolean(tracing.enabled, false),
    capture_inputs: readBoolean(tracing.capture_inputs, true),
    capture_outputs: readBoolean(tracing.capture_outputs, true),
    emit_eval_set: readBoolean(tracing.emit_eval_set, true),
    storage_root: readString(tracing.storage_root, '.utk/events'),
    process_id: readString(tracing.process_id, 'utk')
  };
}
