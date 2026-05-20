import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordFailure, type JaegerSpan, type RunContext } from '../tracing/index.js';

export type DetokOptions = {
  rate?: number;
  targetToken?: number;
  force?: boolean;
  minChars?: number;
  forceTokens?: string[];
  modelName?: string;
  tracer?: RunContext;
  parentSpan?: JaegerSpan;
};

export type DetokResult = {
  originalText: string;
  compressedText: string;
  applied: boolean;
  originTokens: number;
  compressedTokens: number;
  rate: number;
  model: string;
  usedLlmlingua2: boolean;
  error?: string;
};

export async function compressTextWithLlmlingua2(text: string, options: DetokOptions = {}): Promise<DetokResult> {
  const rate = options.rate ?? 0.33;
  const minChars = options.minChars ?? 8000;
  const originalTokens = estimateTokens(text);
  if (!options.force && text.length < minChars) {
    return skipped(text, rate, originalTokens);
  }

  return runLlmlingua2(text, { ...options, rate }, originalTokens);
}

export async function rewriteInputForLlm(value: unknown, options: DetokOptions = {}): Promise<{ value: unknown; applied: boolean; results: DetokResult[] }> {
  const results: DetokResult[] = [];
  const rewritten = await rewriteValue(value, options, results);
  return { value: rewritten, applied: results.some((result) => result.applied), results };
}

export async function readOutputFileForLlm(filePath: string, options: DetokOptions = {}): Promise<DetokResult> {
  const contents = await readFile(filePath, 'utf8');
  return compressTextWithLlmlingua2(contents, { minChars: 0, ...options, force: true });
}

function skipped(text: string, rate: number, tokens: number): DetokResult {
  return {
    originalText: text,
    compressedText: text,
    applied: false,
    originTokens: tokens,
    compressedTokens: tokens,
    rate,
    model: 'not-run',
    usedLlmlingua2: false
  };
}

async function rewriteValue(value: unknown, options: DetokOptions, results: DetokResult[]): Promise<unknown> {
  if (typeof value === 'string') {
    const result = await compressTextWithLlmlingua2(value, options);
    results.push(result);
    return result.compressedText;
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => rewriteValue(item, options, results)));
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await rewriteValue(item, options, results)] as const));
    return Object.fromEntries(entries);
  }

  return value;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

async function runLlmlingua2(text: string, options: DetokOptions & { rate: number }, originalTokens: number): Promise<DetokResult> {
  const scriptPath = path.join(repoRoot(), 'scripts', 'llmlingua2_compress.py');
  const python = process.env.UTK_DETOK_PYTHON ?? 'python';
  const request = JSON.stringify({
    text,
    rate: options.rate,
    targetToken: options.targetToken,
    forceTokens: options.forceTokens,
    modelName: options.modelName
  });
  const output = await runProcess(python, [scriptPath], request);
  const parsed = JSON.parse(output) as Partial<DetokResult> & { error?: string };
  if (parsed.error) {
    recordFailure(options.tracer, {
      name: 'detok.unavailable',
      runType: 'parser',
      ...(options.parentSpan ? { span: options.parentSpan } : {}),
      error: { name: 'DetokError', message: parsed.error },
      extra: { model: options.modelName ?? 'llmlingua2' }
    });
    return { ...skipped(text, options.rate, originalTokens), error: parsed.error };
  }

  const compressedText = parsed.compressedText ?? text;
  return {
    originalText: text,
    compressedText,
    applied: compressedText !== text,
    originTokens: parsed.originTokens ?? originalTokens,
    compressedTokens: parsed.compressedTokens ?? estimateTokens(compressedText),
    rate: parsed.rate ?? options.rate,
    model: parsed.model ?? 'llmlingua2',
    usedLlmlingua2: parsed.usedLlmlingua2 ?? true
  };
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
    /* c8 ignore next */
    child.on('error', (error) => resolve(JSON.stringify({ error: error.message })));
    child.on('close', (code) => {
      const stdout = Buffer.concat(chunks).toString('utf8');
      if (code === 0 && stdout.trim()) {
        resolve(stdout);
        return;
      }
      resolve(JSON.stringify({ error: Buffer.concat(errors).toString('utf8') || `llmlingua2 exited with code ${code}` }));
    });
    child.stdin.end(stdin);
  });
}
/* c8 ignore stop */
