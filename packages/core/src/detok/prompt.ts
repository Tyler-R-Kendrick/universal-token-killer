import { loadUtkConfig } from '@utk/config';
import { compressNaturalLanguageSegment, resolvePromptCompressionModel } from './promptCompressionModels.js';
import { hasNaturalLanguage, estimateTokens } from './promptCompressionUtils.js';
import type { PromptCompressionOptions, PromptCompressionResult, PromptCompressionSegment } from './promptCompressionTypes.js';
import { segmentPrompt } from './promptSegmentation.js';
export { segmentPrompt } from './promptSegmentation.js';
export type { PromptCompressionOptions, PromptCompressionResult, PromptCompressionSegment } from './promptCompressionTypes.js';
export type { PromptCompressionProtectedReason, PromptCompressionRawSegment, PromptCompressionSegmentKind } from './promptSegmentation.js';

export async function compressPromptForLlm(prompt: string, options: PromptCompressionOptions): Promise<PromptCompressionResult> {
  const config = await loadUtkConfig(options.workspaceRoot);
  const rate = options.rate ?? config.detok.prompt.rate;
  const minChars = options.minChars ?? config.detok.prompt.min_chars;
  const model = resolvePromptCompressionModel(options.model ?? config.detok.prompt.model);
  const rawSegments = segmentPrompt(prompt);
  const segments: PromptCompressionSegment[] = [];
  let firstError: string | undefined;

  for (const segment of rawSegments) {
    if (segment.kind === 'protected' || !hasNaturalLanguage(segment.text)) {
      segments.push({ ...segment, compressedText: segment.text, applied: false });
      continue;
    }

    const rewritten = await compressNaturalLanguageSegment(segment.text, model, {
      rate,
      minChars,
      targetToken: options.targetToken,
      forceTokens: options.forceTokens
    });
    if (rewritten.error && !firstError) firstError = rewritten.error;
    segments.push({
      kind: 'natural_language',
      text: segment.text,
      compressedText: rewritten.text,
      applied: rewritten.applied
    });
  }

  const compressedPrompt = segments.map((segment) => segment.compressedText).join('');
  return {
    originalPrompt: prompt,
    compressedPrompt,
    applied: compressedPrompt !== prompt,
    originalTokens: estimateTokens(prompt),
    compressedTokens: estimateTokens(compressedPrompt),
    rate,
    model: model.model,
    segments,
    ...(firstError ? { error: firstError } : {})
  };
}
