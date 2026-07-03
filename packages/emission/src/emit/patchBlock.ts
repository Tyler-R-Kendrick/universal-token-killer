import { MIN_ID_PATTERN, MIN_MAP_KIND_TAG_PATTERN, PRETTY_NAME_PATTERN } from '@utk/minmap';

export type ExtractedPatchBlock = {
  patchText?: string;
  code: string;
};

const END_MARKER_PATTERN = /(?:^|\s)@end(?:\s|$)/;

/**
 * Split a leading `@minmap … @end` declaration block from an emitted min
 * source. The min grammar treats whitespace as insignificant, so ops are
 * re-chunked from the token stream into the line-oriented patch format the
 * kernel parser consumes. The `@end` marker only counts at a whitespace
 * token boundary so corrupted embedded markers fail loudly downstream.
 */
export function extractEmissionPatchBlock(minSource: string): ExtractedPatchBlock {
  const trimmed = minSource.trimStart();
  if (!trimmed.startsWith('@minmap')) {
    return { code: minSource };
  }
  const rest = trimmed.slice('@minmap'.length);
  const endMatch = END_MARKER_PATTERN.exec(rest);
  if (!endMatch) {
    throw new Error('Emission @minmap block is missing its @end marker');
  }
  const blockText = rest.slice(0, endMatch.index);
  const code = rest.slice(endMatch.index + endMatch[0].length).trimStart();
  const tokens = blockText.split(/\s+/).filter((token) => token.length > 0);
  const lines: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const op = tokens[index]!;
    if (op === '+') {
      const minId = tokens[index + 1];
      const pretty = tokens[index + 2];
      if (minId === undefined || pretty === undefined || !MIN_ID_PATTERN.test(minId) || !PRETTY_NAME_PATTERN.test(pretty)) {
        throw new Error(`Emission @minmap block has a malformed add patch near '${tokens.slice(index).join(' ')}'`);
      }
      const kind = tokens[index + 3];
      if (kind !== undefined && MIN_MAP_KIND_TAG_PATTERN.test(kind)) {
        lines.push(`+ ${minId} ${pretty} ${kind}`);
        index += 4;
      } else {
        lines.push(`+ ${minId} ${pretty}`);
        index += 3;
      }
    } else if (op === '-') {
      const minId = tokens[index + 1];
      if (minId === undefined || !MIN_ID_PATTERN.test(minId)) {
        throw new Error(`Emission @minmap block has a malformed remove patch near '${tokens.slice(index).join(' ')}'`);
      }
      lines.push(`- ${minId}`);
      index += 2;
    } else if (op === '~') {
      const minId = tokens[index + 1];
      const pretty = tokens[index + 2];
      if (minId === undefined || pretty === undefined || !MIN_ID_PATTERN.test(minId) || !PRETTY_NAME_PATTERN.test(pretty)) {
        throw new Error(`Emission @minmap block has a malformed rename patch near '${tokens.slice(index).join(' ')}'`);
      }
      lines.push(`~ ${minId} ${pretty}`);
      index += 3;
    } else {
      throw new Error(`Emission @minmap block has an unsupported patch op '${op}'`);
    }
  }
  return { patchText: lines.join('\n'), code };
}
