import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadUtkConfig } from '../config/config.js';
import { compressTextWithLlmlingua2, type DetokResult } from './llmlingua2.js';

export type PromptCompressionSegmentKind = 'natural_language' | 'protected';
export type PromptCompressionProtectedReason = 'fenced-code' | 'blockquote' | 'indented-code' | 'inline-code' | 'quoted-string';

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
      if (/^\s*(```+|~~~+)/.test(current) || /^\s*>/.test(current) || /^(?: {4}|\t)\S/.test(current)) break;
      natural += current;
      index += 1;
    }
    segments.push({ kind: 'natural_language', text: natural });
  }

  return mergeAdjacentSegments(segments);
}

function splitInlineProtectedSegments(text: string): PromptCompressionRawSegment[] {
  const segments: PromptCompressionRawSegment[] = [];
  const inlinePattern = /(`+[^`\n]*`+|"[^"\n]*(?:\\.[^"\n]*)*"|'[^'\n]*(?:\\.[^'\n]*)*')/g;
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
      reason: token.startsWith('`') ? 'inline-code' : 'quoted-string'
    });
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'natural_language', text: text.slice(lastIndex) });
  }
  return mergeAdjacentSegments(segments);
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
  const output = await runProcess(process.env.UTK_DETOK_PYTHON ?? 'python', [scriptPath], JSON.stringify({ text, rate: options.rate }));
  const parsed = JSON.parse(output) as Partial<DetokResult> & { error?: string };
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

/* c8 ignore start */
function runProcess(command: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.on('error', (error) => resolve(JSON.stringify({ error: error.message })));
    child.on('close', (code) => {
      const stdout = Buffer.concat(chunks).toString('utf8');
      if (code === 0 && stdout.trim()) {
        resolve(stdout);
        return;
      }
      resolve(JSON.stringify({ error: Buffer.concat(errors).toString('utf8') || `kompress-small exited with code ${code}` }));
    });
    child.stdin.end(stdin);
  });
}
/* c8 ignore stop */
