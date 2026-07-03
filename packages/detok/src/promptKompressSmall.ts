import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DetokResult } from './llmlingua2.js';
import { estimateTokens } from './promptCompressionUtils.js';

const DEFAULT_KOMPRESS_TIMEOUT_MS = 30_000;

export async function compressTextWithKompressSmall(text: string, options: { rate: number }): Promise<DetokResult> {
  if (process.env.UTK_DETOK_FAKE === '1') {
    return fakeKompressSmallResult(text, options.rate);
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

function fakeKompressSmallResult(text: string, rate: number): DetokResult {
  const words = text.split(/\s+/).filter(Boolean);
  const keep = Math.max(1, Math.floor(words.length * rate));
  const compressedText = words.slice(0, keep).join(' ');
  return {
    originalText: text,
    compressedText,
    applied: compressedText !== text,
    originTokens: estimateTokens(text),
    compressedTokens: estimateTokens(compressedText),
    rate,
    model: 'Hugging-Face/Kompress-small',
    usedLlmlingua2: false
  };
}

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
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
