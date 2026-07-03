import type { PromptCompressionProtectedReason, PromptCompressionRawSegment } from './promptSegmentTypes.js';

export type PromptBlockScan = {
  segment: PromptCompressionRawSegment;
  nextIndex: number;
};

export type PromptBlockScanner = (lines: string[], index: number) => PromptBlockScan | undefined;

export function splitPromptLines(text: string): string[] {
  return text.match(/[^\n]*(?:\n|$)/g)?.filter((line) => line.length > 0) ?? [];
}

export function protectedBlock(text: string, reason: PromptCompressionProtectedReason, nextIndex: number): PromptBlockScan {
  return { segment: { kind: 'protected', text, reason }, nextIndex };
}

export function readWhile(
  lines: string[],
  index: number,
  predicate: (line: string, cursor: number) => boolean
): { block: string; nextIndex: number } {
  let block = '';
  let cursor = index;
  while (cursor < lines.length && predicate(lines[cursor] ?? '', cursor)) {
    block += lines[cursor] ?? '';
    cursor += 1;
  }
  return { block, nextIndex: cursor };
}
