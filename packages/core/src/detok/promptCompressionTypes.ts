import type { PromptCompressionProtectedReason, PromptCompressionSegmentKind } from './promptSegmentation.js';

export type PromptCompressionSegment = {
  kind: PromptCompressionSegmentKind;
  text: string;
  compressedText: string;
  reason?: PromptCompressionProtectedReason;
  applied: boolean;
};

export type PromptCompressionOptions = {
  workspaceRoot: string;
  model?: string;
  rate?: number;
  minChars?: number;
  targetToken?: number;
  forceTokens?: string[];
};

export type PromptCompressionResult = {
  originalPrompt: string;
  compressedPrompt: string;
  applied: boolean;
  originalTokens: number;
  compressedTokens: number;
  rate: number;
  model: string;
  segments: PromptCompressionSegment[];
  error?: string;
};
