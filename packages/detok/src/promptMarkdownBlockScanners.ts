import {
  isConfigLine,
  isDefinitionListStart,
  isListStart,
  isMarkdownTableStart
} from './promptBlockPredicates.js';
import { protectedBlock, readWhile, type PromptBlockScan } from './promptBlockScannerTypes.js';

export function scanFrontmatter(lines: string[], index: number): PromptBlockScan | undefined {
  const line = lines[index] ?? '';
  if (line.trim() !== '---') return undefined;
  let block = line;
  let cursor = index + 1;
  let hasYamlField = false;
  while (cursor < lines.length) {
    const current = lines[cursor] ?? '';
    block += current;
    cursor += 1;
    if (/^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(current)) hasYamlField = true;
    if (current.trim() === '---' && hasYamlField) return protectedBlock(block, 'frontmatter', cursor);
  }
  return undefined;
}

export function scanFence(lines: string[], index: number): PromptBlockScan | undefined {
  const line = lines[index] ?? '';
  const fence = line.match(/^\s*(```+|~~~+)/)?.[1];
  if (!fence) return undefined;
  let block = line;
  let cursor = index + 1;
  while (cursor < lines.length) {
    const current = lines[cursor] ?? '';
    block += current;
    cursor += 1;
    if (current.trimStart().startsWith(fence)) break;
  }
  return protectedBlock(block, 'fenced-code', cursor);
}

export function scanBlockquote(lines: string[], index: number): PromptBlockScan | undefined {
  if (!/^\s*>/.test(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, (line) => /^\s*>/.test(line));
  return protectedBlock(block, 'blockquote', nextIndex);
}

export function scanConflict(lines: string[], index: number): PromptBlockScan | undefined {
  if (!/^<<<<<<<\s+/.test(lines[index] ?? '')) return undefined;
  let block = '';
  let cursor = index;
  while (cursor < lines.length) {
    const current = lines[cursor] ?? '';
    block += current;
    cursor += 1;
    if (/^>>>>>>>\s+/.test(current)) break;
  }
  return protectedBlock(block, 'conflict', cursor);
}

export function scanDiff(lines: string[], index: number): PromptBlockScan | undefined {
  if (!/^diff --git\s+/.test(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, (line) => !/^\s*$/.test(line));
  return protectedBlock(block, 'diff', nextIndex);
}

export function scanMathBlock(lines: string[], index: number): PromptBlockScan | undefined {
  const line = lines[index] ?? '';
  if (line.trim() !== '$$') return undefined;
  let block = line;
  let cursor = index + 1;
  while (cursor < lines.length) {
    const current = lines[cursor] ?? '';
    block += current;
    cursor += 1;
    if (current.trim() === '$$') break;
  }
  return protectedBlock(block, 'math', cursor);
}

export function scanAdmonition(lines: string[], index: number): PromptBlockScan | undefined {
  if (!/^\s*!!!\s+/.test(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, (line) => /^\s*!!!\s+/.test(line) || /^(?: {4}|\t)/.test(line));
  return protectedBlock(block, 'admonition', nextIndex);
}

export function scanDefinitionList(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isDefinitionListStart(lines, index)) return undefined;
  let block = '';
  let cursor = index;
  while (cursor < lines.length && ((lines[cursor] ?? '').trim().length > 0)) {
    block += lines[cursor] ?? '';
    cursor += 1;
    if (!/^\s*:/.test(lines[cursor] ?? '') && cursor > 0) break;
  }
  return protectedBlock(block, 'definition-list', cursor);
}

export function scanList(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isListStart(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, (line) => isListStart(line) || /^(?: {2,}|\t)\S/.test(line));
  return protectedBlock(block, 'list', nextIndex);
}

export function scanConfig(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isConfigLine(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, isConfigLine);
  return protectedBlock(block, 'config', nextIndex);
}

export function scanMarkdownTable(lines: string[], index: number): PromptBlockScan | undefined {
  if (!isMarkdownTableStart(lines, index)) return undefined;
  const { block, nextIndex } = readWhile(lines, index, (line) => /\|/.test(line));
  return protectedBlock(block, 'table', nextIndex);
}

export function scanHtml(lines: string[], index: number): PromptBlockScan | undefined {
  if (!/^\s*(?:<!--|<\/?[A-Za-z][^>]*>)/.test(lines[index] ?? '')) return undefined;
  let block = '';
  let cursor = index;
  while (
    cursor < lines.length &&
    (/^\s*(?:<!--|<\/?[A-Za-z][^>]*>)/.test(lines[cursor] ?? '') || (block.includes('<!--') && !block.includes('-->')))
  ) {
    block += lines[cursor] ?? '';
    cursor += 1;
    if (block.includes('-->') || /<\/[A-Za-z][A-Za-z0-9-]*>/.test(block)) break;
  }
  return protectedBlock(block, 'html', cursor);
}

export function scanIndentedCode(lines: string[], index: number): PromptBlockScan | undefined {
  if (!/^(?: {4}|\t)\S/.test(lines[index] ?? '')) return undefined;
  const { block, nextIndex } = readWhile(lines, index, (line) => /^(?: {4}|\t)/.test(line) || /^\s*$/.test(line));
  return protectedBlock(block, 'indented-code', nextIndex);
}
