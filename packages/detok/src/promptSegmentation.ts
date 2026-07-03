import {
  findProtectedBlock,
  isNaturalBlockBoundary,
  splitPromptLines
} from './promptBlockScanning.js';
import { splitInlineProtectedSegments } from './promptInlineSegmentation.js';
import { mergeAdjacentSegments } from './promptSegmentUtils.js';
import type { PromptCompressionRawSegment } from './promptSegmentTypes.js';

export type {
  PromptCompressionProtectedReason,
  PromptCompressionRawSegment,
  PromptCompressionSegmentKind
} from './promptSegmentTypes.js';

export function segmentPrompt(prompt: string): PromptCompressionRawSegment[] {
  const blockSegments = splitMarkdownBlocks(prompt);
  return blockSegments.flatMap((segment) => (segment.kind === 'natural_language' ? splitInlineProtectedSegments(segment.text) : [segment]));
}

function splitMarkdownBlocks(text: string): PromptCompressionRawSegment[] {
  const segments: PromptCompressionRawSegment[] = [];
  const lines = splitPromptLines(text);
  let index = 0;

  while (index < lines.length) {
    const protectedBlock = findProtectedBlock(lines, index);
    if (protectedBlock) {
      segments.push(protectedBlock.segment);
      index = protectedBlock.nextIndex;
      continue;
    }

    let natural = '';
    while (index < lines.length && !isNaturalBlockBoundary(lines, index)) {
      const current = lines[index] ?? '';
      natural += current;
      index += 1;
    }
    if (natural.length === 0) {
      natural = lines[index] ?? '';
      index += 1;
    }
    segments.push({ kind: 'natural_language', text: natural });
  }

  return mergeAdjacentSegments(segments);
}

