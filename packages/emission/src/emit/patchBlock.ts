import { MIN_ID_PATTERN } from '../minmap/format.js';

export type ExtractedPatchBlock = {
  patchText?: string;
  code: string;
};

const PRETTY_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const KIND_PATTERN = /^@(ident|macro|keyword)$/;

/**
 * Split a leading `@minmap … @end` declaration block from an emitted min
 * source. The min grammar treats whitespace as insignificant, so ops are
 * re-chunked from the token stream into the line-oriented patch format the
 * kernel parser consumes.
 */
export function extractEmissionPatchBlock(minSource: string): ExtractedPatchBlock {
  const trimmed = minSource.trimStart();
  if (!trimmed.startsWith('@minmap')) {
    return { code: minSource };
  }
  const endIndex = trimmed.indexOf('@end');
  if (endIndex === -1) {
    throw new Error('Emission @minmap block is missing its @end marker');
  }
  const blockText = trimmed.slice('@minmap'.length, endIndex);
  const code = trimmed.slice(endIndex + '@end'.length).trimStart();
  const tokens = blockText.split(/\s+/).filter((token) => token.length > 0);
  const lines: string[] = [];
  let index = 0;
  while (index < tokens.length) {
    const op = tokens[index]!;
    if (op === '+') {
      const minId = tokens[index + 1];
      const pretty = tokens[index + 2];
      if (minId === undefined || pretty === undefined || !MIN_ID_PATTERN.test(minId) || !PRETTY_PATTERN.test(pretty)) {
        throw new Error(`Emission @minmap block has a malformed add patch near '${tokens.slice(index).join(' ')}'`);
      }
      const kind = tokens[index + 3];
      if (kind !== undefined && KIND_PATTERN.test(kind)) {
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
      if (minId === undefined || pretty === undefined || !MIN_ID_PATTERN.test(minId) || !PRETTY_PATTERN.test(pretty)) {
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
