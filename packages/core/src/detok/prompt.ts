import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUtkConfig } from '../config/config.js';
import { compressTextWithLlmlingua2, type DetokResult } from './llmlingua2.js';

export type PromptCompressionSegmentKind = 'natural_language' | 'protected';
export type PromptCompressionProtectedReason =
  | 'fenced-code'
  | 'frontmatter'
  | 'blockquote'
  | 'table'
  | 'html'
  | 'diff'
  | 'stack-trace'
  | 'list'
  | 'math'
  | 'data-literal'
  | 'config'
  | 'resource-id'
  | 'admonition'
  | 'definition-list'
  | 'conflict'
  | 'http'
  | 'sql'
  | 'graphql'
  | 'cron'
  | 'delimited-data'
  | 'yaml'
  | 'dockerfile'
  | 'log'
  | 'secret-format'
  | 'network-id'
  | 'selector'
  | 'regex'
  | 'version'
  | 'expansion'
  | 'keyboard'
  | 'terminal'
  | 'vcs-ref'
  | 'indented-code'
  | 'inline-code'
  | 'quoted-string'
  | 'template'
  | 'markdown-link'
  | 'reference-link'
  | 'url'
  | 'filepath'
  | 'reference'
  | 'command'
  | 'package-name'
  | 'model-id'
  | 'hash'
  | 'api-name'
  | 'schema-reference';

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

type CompressionModel =
  | { kind: 'llmlingua2'; model: 'default/LLMLingua2' }
  | { kind: 'kompress-small'; model: 'Hugging-Face/Kompress-small' };

const DEFAULT_KOMPRESS_TIMEOUT_MS = 30_000;

export type PromptCompressionRawSegment = {
  kind: PromptCompressionSegmentKind;
  text: string;
  reason?: PromptCompressionProtectedReason;
};

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

export function segmentPrompt(prompt: string): PromptCompressionRawSegment[] {
  const blockSegments = splitMarkdownBlocks(prompt);
  return blockSegments.flatMap((segment) => (segment.kind === 'natural_language' ? splitInlineProtectedSegments(segment.text) : [segment]));
}

function splitMarkdownBlocks(text: string): PromptCompressionRawSegment[] {
  const segments: PromptCompressionRawSegment[] = [];
  const lines = text.match(/[^\n]*(?:\n|$)/g)?.filter((line) => line.length > 0) ?? [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (line.trim() === '---') {
      let block = line;
      let cursor = index + 1;
      let hasYamlField = false;
      let consumedFrontmatter = false;
      while (cursor < lines.length) {
        const current = lines[cursor] ?? '';
        block += current;
        cursor += 1;
        if (/^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(current)) hasYamlField = true;
        if (current.trim() === '---' && hasYamlField) {
          index = cursor;
          segments.push({ kind: 'protected', text: block, reason: 'frontmatter' });
          consumedFrontmatter = true;
          break;
        }
      }
      if (consumedFrontmatter) continue;
    }

    const fence = line.match(/^\s*(```+|~~~+)/)?.[1];
    if (fence) {
      let block = line;
      index += 1;
      while (index < lines.length) {
        const current = lines[index] ?? '';
        block += current;
        index += 1;
        if (current.trimStart().startsWith(fence)) break;
      }
      segments.push({ kind: 'protected', text: block, reason: 'fenced-code' });
      continue;
    }

    if (/^\s*>/.test(line)) {
      let block = '';
      while (index < lines.length && /^\s*>/.test(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'blockquote' });
      continue;
    }

    if (/^<<<<<<<\s+/.test(line)) {
      let block = '';
      while (index < lines.length) {
        const current = lines[index] ?? '';
        block += current;
        index += 1;
        if (/^>>>>>>>\s+/.test(current)) break;
      }
      segments.push({ kind: 'protected', text: block, reason: 'conflict' });
      continue;
    }

    if (/^diff --git\s+/.test(line)) {
      let block = '';
      while (index < lines.length && !/^\s*$/.test(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'diff' });
      continue;
    }

    if (isHttpStart(line)) {
      let block = '';
      while (index < lines.length && ((lines[index] ?? '').trim().length > 0)) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'http' });
      continue;
    }

    if (isSqlStart(line)) {
      let block = '';
      while (index < lines.length && isSqlLine(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'sql' });
      continue;
    }

    if (isGraphqlStart(line)) {
      let block = '';
      let depth = 0;
      while (index < lines.length) {
        const current = lines[index] ?? '';
        block += current;
        depth += (current.match(/\{/g) ?? []).length - (current.match(/\}/g) ?? []).length;
        index += 1;
        if (depth <= 0 && block.includes('{')) break;
      }
      segments.push({ kind: 'protected', text: block, reason: 'graphql' });
      continue;
    }

    if (isStackTraceStart(line)) {
      let block = '';
      while (index < lines.length && isStackTraceLine(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'stack-trace' });
      continue;
    }

    if (isCronLine(line)) {
      let block = '';
      while (index < lines.length && isCronLine(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'cron' });
      continue;
    }

    if (isDelimitedDataStart(lines, index)) {
      let block = '';
      const delimiter = line.includes('\t') ? '\t' : ',';
      while (index < lines.length && (lines[index] ?? '').includes(delimiter)) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'delimited-data' });
      continue;
    }

    if (isYamlStart(lines, index)) {
      let block = '';
      while (index < lines.length && isYamlLine(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'yaml' });
      continue;
    }

    if (isDockerfileStart(line)) {
      let block = '';
      while (index < lines.length && isDockerfileLine(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'dockerfile' });
      continue;
    }

    if (isLogLine(line)) {
      let block = '';
      while (index < lines.length && isLogLine(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'log' });
      continue;
    }

    if (isSecretFormatStart(line)) {
      let block = '';
      while (index < lines.length && isSecretFormatLine(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'secret-format' });
      continue;
    }

    const lineReason = classifyProtectedLine(line);
    if (lineReason) {
      let block = '';
      while (index < lines.length && classifyProtectedLine(lines[index] ?? '') === lineReason) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: lineReason });
      continue;
    }

    if (line.trim() === '$$') {
      let block = line;
      index += 1;
      while (index < lines.length) {
        const current = lines[index] ?? '';
        block += current;
        index += 1;
        if (current.trim() === '$$') break;
      }
      segments.push({ kind: 'protected', text: block, reason: 'math' });
      continue;
    }

    if (/^\s*!!!\s+/.test(line)) {
      let block = '';
      while (index < lines.length && (/^\s*!!!\s+/.test(lines[index] ?? '') || /^(?: {4}|\t)/.test(lines[index] ?? ''))) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'admonition' });
      continue;
    }

    if (isDefinitionListStart(lines, index)) {
      let block = '';
      while (index < lines.length && ((lines[index] ?? '').trim().length > 0)) {
        block += lines[index] ?? '';
        index += 1;
        if (!/^\s*:/.test(lines[index] ?? '') && index > 0) break;
      }
      segments.push({ kind: 'protected', text: block, reason: 'definition-list' });
      continue;
    }

    if (isListStart(line)) {
      let block = '';
      while (index < lines.length && (isListStart(lines[index] ?? '') || /^(?: {2,}|\t)\S/.test(lines[index] ?? ''))) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'list' });
      continue;
    }

    if (isConfigLine(line)) {
      let block = '';
      while (index < lines.length && isConfigLine(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'config' });
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      let block = '';
      while (index < lines.length && /\|/.test(lines[index] ?? '')) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'table' });
      continue;
    }

    if (/^\s*(?:<!--|<\/?[A-Za-z][^>]*>)/.test(line)) {
      let block = '';
      while (index < lines.length && (/^\s*(?:<!--|<\/?[A-Za-z][^>]*>)/.test(lines[index] ?? '') || (block.includes('<!--') && !block.includes('-->')))) {
        block += lines[index] ?? '';
        index += 1;
        if (block.includes('-->') || /<\/[A-Za-z][A-Za-z0-9-]*>/.test(block)) break;
      }
      segments.push({ kind: 'protected', text: block, reason: 'html' });
      continue;
    }

    if (/^(?: {4}|\t)\S/.test(line)) {
      let block = '';
      while (index < lines.length && (/^(?: {4}|\t)/.test(lines[index] ?? '') || /^\s*$/.test(lines[index] ?? ''))) {
        block += lines[index] ?? '';
        index += 1;
      }
      segments.push({ kind: 'protected', text: block, reason: 'indented-code' });
      continue;
    }

    let natural = '';
    while (index < lines.length) {
      const current = lines[index] ?? '';
      if (
        current.trim() === '---' ||
        isMarkdownTableStart(lines, index) ||
        /^<<<<<<<\s+/.test(current) ||
        /^diff --git\s+/.test(current) ||
        isHttpStart(current) ||
        isSqlStart(current) ||
        isGraphqlStart(current) ||
        isStackTraceStart(current) ||
        isCronLine(current) ||
        isDelimitedDataStart(lines, index) ||
        isYamlStart(lines, index) ||
        isDockerfileStart(current) ||
        isLogLine(current) ||
        isSecretFormatStart(current) ||
        classifyProtectedLine(current) !== undefined ||
        current.trim() === '$$' ||
        /^\s*!!!\s+/.test(current) ||
        isDefinitionListStart(lines, index) ||
        isListStart(current) ||
        isConfigLine(current) ||
        /^\s*(?:<!--|<\/?[A-Za-z][^>]*>)/.test(current) ||
        /^\s*(```+|~~~+)/.test(current) ||
        /^\s*>/.test(current) ||
        /^(?: {4}|\t)\S/.test(current)
      )
        break;
      natural += current;
      index += 1;
    }
    segments.push({ kind: 'natural_language', text: natural });
  }

  return mergeAdjacentSegments(segments);
}

function isStackTraceStart(line: string): boolean {
  return /^(?:[A-Za-z]*Error|TypeError|ReferenceError|SyntaxError|RangeError|Caused by:)/.test(line);
}

function isStackTraceLine(line: string): boolean {
  return isStackTraceStart(line) || /^\s+at\s+/.test(line) || /^\s*\.\.\. \d+ more/.test(line);
}

function isHttpStart(line: string): boolean {
  return /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+\s+HTTP\/\d(?:\.\d)?$/.test(line) || /^HTTP\/\d(?:\.\d)?\s+\d{3}\b/.test(line);
}

function isSqlStart(line: string): boolean {
  return /^(?:SELECT|INSERT|UPDATE|DELETE|WITH|EXPLAIN|CREATE|ALTER|DROP)\b/i.test(line);
}

function isSqlLine(line: string): boolean {
  return isSqlStart(line) || /^\s+(?:AND|OR|FROM|WHERE|JOIN|GROUP|ORDER|LIMIT)\b/i.test(line);
}

function isGraphqlStart(line: string): boolean {
  return /^(?:query|mutation|subscription)\b/.test(line);
}

function isCronLine(line: string): boolean {
  const cronField = String.raw`(?:\*|\d+|\d+-\d+|\d+\/\d+|\*\/\d+|[\d,]+)`;
  return new RegExp(String.raw`^(?:[A-Z_][A-Z0-9_]*=\S+\s+)?(?:@\w+\s+\S+|${cronField}\s+${cronField}\s+${cronField}\s+${cronField}\s+${cronField}\s+\S+)`).test(line);
}

function isDelimitedDataStart(lines: string[], index: number): boolean {
  const current = lines[index] ?? '';
  const next = lines[index + 1] ?? '';
  return (current.includes(',') && next.includes(',')) || (current.includes('\t') && next.includes('\t'));
}

function isYamlStart(lines: string[], index: number): boolean {
  const current = lines[index] ?? '';
  const next = lines[index + 1] ?? '';
  return /^[A-Za-z][A-Za-z0-9_-]*:\s+\S/.test(current) && (/^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(next) || /^(?: {2,}|\t)\S/.test(next));
}

function isYamlLine(line: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(line) || /^(?: {2,}|\t)\S/.test(line);
}

function isDockerfileStart(line: string): boolean {
  return /^FROM\s+\S+/i.test(line);
}

function isDockerfileLine(line: string): boolean {
  return /^(?:FROM|WORKDIR|COPY|ADD|RUN|CMD|ENTRYPOINT|ENV|ARG|EXPOSE|LABEL|USER|VOLUME|SHELL|HEALTHCHECK)\b/i.test(line);
}

function isLogLine(line: string): boolean {
  return /^(?:\d{4}-\d{2}-\d{2}T|\[\d{4}-\d{2}-\d{2}\s)/.test(line);
}

function isSecretFormatStart(line: string): boolean {
  const trimmed = line.trim();
  return /^-----BEGIN [A-Z ]+-----$/.test(trimmed) || /^(?:JWT|B64)=/.test(trimmed);
}

function isSecretFormatLine(line: string): boolean {
  const trimmed = line.trim();
  return /^-----BEGIN [A-Z ]+-----$/.test(trimmed) || /^-----END [A-Z ]+-----$/.test(trimmed) || /^[A-Za-z0-9+/=._-]{24,}$/.test(trimmed) || /^(?:JWT|B64)=/.test(trimmed);
}

function classifyProtectedLine(line: string): PromptCompressionProtectedReason | undefined {
  if (/(?:s3|gs|vscode|file):\/\/?|urn:|@sha256:|sha256:/.test(line)) return 'resource-id';
  if (/(?:[A-Za-z0-9_.\/-]+\.\.[A-Za-z0-9_.\/-]+|HEAD~\d+|refs\/[A-Za-z0-9_./-]+|[A-Fa-f0-9]{7,}\^!)/.test(line)) return 'vcs-ref';
  if (/(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2}|:\d+)?|\[[0-9A-Fa-f:]+\]:\d+|(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/.test(line)) return 'network-id';
  if (/\b(?:css|xpath)=/.test(line)) return 'selector';
  if (/\$\([^)\n]+\)|\$\{[^}\n]+\}|%[A-Za-z_][A-Za-z0-9_]*%|\$env:[A-Za-z_][A-Za-z0-9_]*/.test(line)) return 'expansion';
  if (/(?:Ctrl|Alt|Shift|Cmd)(?:\+[A-Za-z0-9]+)+(?:\s+Cmd\+[A-Za-z0-9]+)?|[A-Za-z]+(?:\s*>\s*[A-Za-z]+){2,}/.test(line)) return 'keyboard';
  if (/\u001b\[[0-9;]*m|^PS\s+[A-Za-z]:\\/.test(line)) return 'terminal';
  if ((/\b(?:regex|pattern)\b/i.test(line) || /^\s*Use\s+\//.test(line)) && (/(?:^|\s)\/\^?[^\s\n]+\/[gimsuy]*(?:\s|$)/.test(line) || /\(\?[a-z]+\)[^\s,]+/.test(line))) return 'regex';
  if (!/@[A-Za-z0-9_.-]+\//.test(line) && /(?:>=\d+(?:\.\d+)*(?:\s+<\d+(?:\.\d+)*)?|\^\d+\.\d+\.\d+|~\d+\.\d+\.\d+|\b\d+\.\d+\.\d+(?:[-+][A-Za-z0-9_.-]+)?)/.test(line)) return 'version';
  return undefined;
}

function isListStart(line: string): boolean {
  return /^\s*(?:[-*+] \[[ xX]\]|(?:\d+\.|[-*+])\s+)/.test(line);
}

function isConfigLine(line: string): boolean {
  return /^[A-Z_][A-Z0-9_]*=.+/.test(line);
}

function isDefinitionListStart(lines: string[], index: number): boolean {
  return Boolean((lines[index] ?? '').trim()) && /^\s*:\s+/.test(lines[index + 1] ?? '');
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  const current = lines[index] ?? '';
  const next = lines[index + 1] ?? '';
  return /\|/.test(current) && /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next);
}

function splitInlineProtectedSegments(text: string): PromptCompressionRawSegment[] {
  const segments: PromptCompressionRawSegment[] = [];
  const inlinePattern =
    /(`+[^`\n]*`+|"[^"\n]*(?:\\.[^"\n]*)*"|'[^'\n]*(?:\\.[^'\n]*)*'|\$\.[A-Za-z0-9_[\].-]+|\$\{\{[^}\n]+\}\}|\{\{[^}\n]+\}\}|<%[\s\S]*?%>|\$\$?[^$\n]+\$\$?|\{[^\n]+\}|\[[^\]\n]+(?:,[^\]\n]+)+\]|\[[A-Za-z0-9_.-]+\][^\n.]+|(?:s3|gs|vscode|file):\/\/?[^\s,]+|urn:[^\s,]+|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:-]+@sha256:[A-Fa-f0-9]{32,64}|sha256:[A-Fa-f0-9]{32,64}|!?\[[^\]\n]+\]\((?:[^()\n]|\([^()\n]*\))+\)|\[[^\]\n]+\]\[[^\]\n]+\]|^\[\^[^\]\n]+\]:[^\n]+|^\[[^\]\n]+\]:[^\n]+|\[\^[^\]\n]+\]|<https?:\/\/[^>\n]+>|<[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}>|https?:\/\/[^\s)>,]+|(?:node|npm|npx|pnpm|yarn|git|gh|pwsh|powershell|python|uv|npm.cmd)\b(?:\s+(?!(?:before|after|then|while|when|because|and|or)\b)(?:"[^"\n]*(?:\\.[^"\n]*)*"|'[^'\n]*(?:\\.[^'\n]*)*'|[^\s,;:]+))+|(?:[A-Z_][A-Z0-9_]*=[^\s]+\s+)+(?:node|npm|npx|pnpm|yarn|git|gh|pwsh|powershell|python|uv|npm.cmd)\b[^\n.]*|@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:@[0-9A-Za-z_.-]+)?|[A-Fa-f0-9]{40}|[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}|(?:[A-Za-z][A-Za-z0-9_.-]*\/[A-Za-z][A-Za-z0-9_.-]+)|(?:[A-Za-z]:\\)(?:(?!\s+(?:and|or|before|after|then|while|when|because|to|from)\b)[^,;\n])+|(?:\.?\.?\\)[^\s,;:]+(?:\\[^\s,;:]+)+|(?:\.{1,2}\/|\/|[A-Za-z0-9_.-]+\/)(?:[A-Za-z0-9_. -]+\/)*[A-Za-z0-9_. -]+\.[A-Za-z0-9]{1,8}|(?:#[0-9]+|gh-[0-9]+|@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)|\$[.[\]A-Za-z0-9_-]+|[A-Za-z_$][A-Za-z0-9_$]*(?:\(\)|\.[A-Za-z0-9_$-]+)|[a-z]+[A-Z][A-Za-z0-9_$]*|[A-Z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*|[A-Z][A-Z0-9_]{2,})/gm;
  let lastIndex = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ kind: 'natural_language', text: text.slice(lastIndex, index) });
    }
    const token = match[0];
    segments.push({
      kind: 'protected',
      text: token,
      reason: classifyInlineProtectedReason(token)
    });
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'natural_language', text: text.slice(lastIndex) });
  }
  return mergeAdjacentSegments(segments);
}

function classifyInlineProtectedReason(token: string): PromptCompressionProtectedReason {
  if (token.startsWith('`')) return 'inline-code';
  if (token.startsWith('"') || token.startsWith("'")) return 'quoted-string';
  if (/^\$[.[\]A-Za-z0-9_-]+$/.test(token)) return 'schema-reference';
  if (/^\$\$?/.test(token)) return 'math';
  if (/^(?:\{|\[[^\]\n]+(?:,[^\]\n]+)+\]|\[[A-Za-z0-9_.-]+\])/.test(token)) return 'data-literal';
  if (/^(?:\$\{\{|\{\{|<%)/.test(token)) return 'template';
  if (/^(?:(?:s3|gs|vscode|file|urn):\/\/?|[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.:-]+@sha256:|sha256:)/.test(token)) return 'resource-id';
  if (/^!?\[[^\]\n]+\]\((?:[^()\n]|\([^()\n]*\))+\)$/.test(token)) return 'markdown-link';
  if (/^\[[^\]\n]+\]\[[^\]\n]+\]$/.test(token)) return 'reference-link';
  if (/^(?:\[\^[^\]\n]+\]|\[\^[^\]\n]+\]:|\[[^\]\n]+\]:)/.test(token)) return 'reference';
  if (/^(?:<?https?:\/\/|<[A-Za-z0-9._%+-]+@)/.test(token)) return 'url';
  if (/^@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:@[0-9A-Za-z_.-]+)?$/.test(token)) return 'package-name';
  if (/^[A-Fa-f0-9]{40}$|^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/.test(token)) return 'hash';
  if (/^[A-Za-z][A-Za-z0-9_.-]*\/[A-Za-z][A-Za-z0-9_.-]+$/.test(token)) return 'model-id';
  if (/^(?:[A-Za-z]:\\|\.?\.?\\|\.{1,2}\/|\/|(?:[A-Za-z0-9_-]+\/)+)/.test(token)) return 'filepath';
  if (/^(?:(?:[A-Z_][A-Z0-9_]*=[^\s]+\s+)+)?(?:node|npm|npx|pnpm|yarn|git|gh|pwsh|powershell|python|uv|npm.cmd)\b/.test(token)) return 'command';
  if (/^(?:#[0-9]+|gh-[0-9]+|@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/.test(token)) return 'reference';
  return 'api-name';
}

function mergeAdjacentSegments(segments: PromptCompressionRawSegment[]): PromptCompressionRawSegment[] {
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

async function compressNaturalLanguageSegment(
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

function resolvePromptCompressionModel(model: string): CompressionModel {
  const normalized = model.toLowerCase();
  if (normalized === 'default/llmlingua2') return { kind: 'llmlingua2', model: 'default/LLMLingua2' };
  if (normalized === 'hugging-face/kompress-small' || normalized === 'huggingface/kompress-small') {
    return { kind: 'kompress-small', model: 'Hugging-Face/Kompress-small' };
  }
  throw new Error(`Unsupported prompt compression model: ${model}. Supported models: default/LLMLingua2, Hugging-Face/Kompress-small`);
}

async function compressTextWithKompressSmall(text: string, options: { rate: number }): Promise<DetokResult> {
  if (process.env.UTK_DETOK_FAKE === '1') {
    const words = text.split(/\s+/).filter(Boolean);
    const keep = Math.max(1, Math.floor(words.length * options.rate));
    const compressedText = words.slice(0, keep).join(' ');
    return {
      originalText: text,
      compressedText,
      applied: compressedText !== text,
      originTokens: estimateTokens(text),
      compressedTokens: estimateTokens(compressedText),
      rate: options.rate,
      model: 'Hugging-Face/Kompress-small',
      usedLlmlingua2: false
    };
  }

  const scriptPath = path.join(repoRoot(), 'scripts', 'kompress_small_compress.py');
  const timeoutMs = readPositiveInteger(process.env.UTK_KOMPRESS_TIMEOUT_MS, DEFAULT_KOMPRESS_TIMEOUT_MS);
  const output = await runProcess(process.env.UTK_DETOK_PYTHON ?? 'python', [scriptPath], JSON.stringify({ text, rate: options.rate }), timeoutMs);
  const parsed = parseKompressOutput(output);
  if (parsed.error) {
    return {
      originalText: text,
      compressedText: text,
      applied: false,
      originTokens: estimateTokens(text),
      compressedTokens: estimateTokens(text),
      rate: options.rate,
      model: 'Hugging-Face/Kompress-small',
      usedLlmlingua2: false,
      error: parsed.error
    };
  }
  const compressedText = parsed.compressedText ?? text;
  return {
    originalText: text,
    compressedText,
    applied: compressedText !== text,
    originTokens: parsed.originTokens ?? estimateTokens(text),
    compressedTokens: parsed.compressedTokens ?? estimateTokens(compressedText),
    rate: parsed.rate ?? options.rate,
    model: parsed.model ?? 'Hugging-Face/Kompress-small',
    usedLlmlingua2: false
  };
}

function hasNaturalLanguage(text: string): boolean {
  return /[A-Za-z]{2,}/.test(text);
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
}

function parseKompressOutput(output: string): Partial<DetokResult> & { error?: string } {
  try {
    return JSON.parse(output) as Partial<DetokResult> & { error?: string };
  } catch (error) {
    return {
      error: `kompress-small emitted invalid JSON: ${(error as Error).message}; raw output: ${output}`
    };
  }
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/* c8 ignore start */
function runProcess(command: string, args: string[], stdin: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (output: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(output);
    };
    timer = setTimeout(() => {
      child.kill();
      finish(JSON.stringify({ error: `kompress-small timed out after ${timeoutMs}ms` }));
    }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.on('error', (error) => finish(JSON.stringify({ error: error.message })));
    child.on('close', (code) => {
      const stdout = Buffer.concat(chunks).toString('utf8');
      if (stdout.trim()) {
        finish(stdout);
        return;
      }
      if (code !== 0 && stdout.trim()) {
        finish(stdout);
        return;
      }
      finish(JSON.stringify({ error: Buffer.concat(errors).toString('utf8') || `kompress-small exited with code ${code}` }));
    });
    child.stdin.end(stdin);
  });
}
/* c8 ignore stop */
