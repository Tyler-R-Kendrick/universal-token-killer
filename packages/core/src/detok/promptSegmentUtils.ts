import type { PromptCompressionRawSegment } from './promptSegmentTypes.js';

export function mergeAdjacentSegments(segments: PromptCompressionRawSegment[]): PromptCompressionRawSegment[] {
  const merged: PromptCompressionRawSegment[] = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (previous && previous.kind === segment.kind && previous.reason === segment.reason) {
      previous.text += segment.text;
      continue;
    }
    merged.push({ ...segment });
  }
  return merged;
}
