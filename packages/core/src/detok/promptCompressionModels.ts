import { compressTextWithLlmlingua2 } from './llmlingua2.js';
import { compressTextWithKompressSmall } from './promptKompressSmall.js';

type CompressionModel =
  | { kind: 'llmlingua2'; model: 'default/LLMLingua2' }
  | { kind: 'kompress-small'; model: 'Hugging-Face/Kompress-small' };

export function resolvePromptCompressionModel(model: string): CompressionModel {
  const normalized = model.toLowerCase();
  if (normalized === 'default/llmlingua2') return { kind: 'llmlingua2', model: 'default/LLMLingua2' };
  if (normalized === 'hugging-face/kompress-small' || normalized === 'huggingface/kompress-small') {
    return { kind: 'kompress-small', model: 'Hugging-Face/Kompress-small' };
  }
  throw new Error(`Unsupported prompt compression model: ${model}. Supported models: default/LLMLingua2, Hugging-Face/Kompress-small`);
}

export async function compressNaturalLanguageSegment(
  text: string,
  model: CompressionModel,
  options: { rate: number; minChars: number; targetToken?: number; forceTokens?: string[] }
): Promise<{ text: string; applied: boolean; error?: string }> {
  const leading = text.match(/^\s*/)?.[0] ?? '';
  const trailing = text.match(/\s*$/)?.[0] ?? '';
  const core = text.slice(leading.length, text.length - trailing.length);
  if (!core) return { text, applied: false };
  if (core.length < options.minChars) return { text, applied: false };

  const result =
    model.kind === 'llmlingua2'
      ? await compressTextWithLlmlingua2(core, { force: true, minChars: 0, rate: options.rate, targetToken: options.targetToken, forceTokens: options.forceTokens })
      : await compressTextWithKompressSmall(core, options);

  return {
    text: `${leading}${result.compressedText}${trailing}`,
    applied: result.applied,
    ...(result.error ? { error: result.error } : {})
  };
}
