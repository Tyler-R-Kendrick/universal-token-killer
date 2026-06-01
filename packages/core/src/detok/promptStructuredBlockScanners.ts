import {
  classifyProtectedLine,
  isCronLine,
  isDelimitedDataStart,
  isDockerfileLine,
  isDockerfileStart,
  isGraphqlStart,
  isHttpStart,
  isLogLine,
  isSecretFormatLine,
  isSecretFormatStart,
  isSqlLine,
  isSqlStart,
  isStackTraceLine,
  isStackTraceStart,
  isYamlLine,
  isYamlStart
} from './promptBlockPredicates.js';
import { protectedBlock, readWhile, type PromptBlockScan } from './promptBlockScannerTypes.js';

export function scanHttp(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isHttpStart(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, (line) => line.trim().length > 0);
  return protectedBlock(block, 'http', nextIndex);
}

export function scanSql(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isSqlStart(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, isSqlLine);
  return protectedBlock(block, 'sql', nextIndex);
}

export function scanGraphql(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isGraphqlStart(lines[index] ?? '')) return undefined;
  let block = '';
  let depth = 0;
  let cursor = index;
  while (cursor < lines.length) {
    const current = lines[cursor] ?? '';
    block += current;
    depth += (current.match(/\{/g) ?? []).length - (current.match(/\}/g) ?? []).length;
    cursor += 1;
    if (depth <= 0 && block.includes('{')) break;
  }
  return protectedBlock(block, 'graphql', cursor);
}

export function scanStackTrace(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isStackTraceStart(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, isStackTraceLine);
  return protectedBlock(block, 'stack-trace', nextIndex);
}

export function scanCron(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isCronLine(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, isCronLine);
  return protectedBlock(block, 'cron', nextIndex);
}

export function scanDelimitedData(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isDelimitedDataStart(lines, index)) return undefined;
  const delimiter = (lines[index] ?? '').includes('\t') ? '\t' : ',';
  const { block, nextIndex } = readWhile(lines, index, (line) => line.includes(delimiter));
  return protectedBlock(block, 'delimited-data', nextIndex);
}

export function scanYaml(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isYamlStart(lines, index)) return undefined;
  const { block, nextIndex } = readWhile(lines, index, isYamlLine);
  return protectedBlock(block, 'yaml', nextIndex);
}

export function scanDockerfile(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isDockerfileStart(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, isDockerfileLine);
  return protectedBlock(block, 'dockerfile', nextIndex);
}

export function scanLog(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isLogLine(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, isLogLine);
  return protectedBlock(block, 'log', nextIndex);
}

export function scanSecretFormat(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isSecretFormatStart(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, isSecretFormatLine);
  return protectedBlock(block, 'secret-format', nextIndex);
}

export function scanClassifiedLine(lines: string[], index: number): PromptBlockScan | undefined {
  const lineReason = classifyProtectedLine(lines[index] ?? '');
  if (!lineReason) return undefined;
  const { block, nextIndex } = readWhile(lines, index, (line) => classifyProtectedLine(line) === lineReason);
  return protectedBlock(block, lineReason, nextIndex);
}
