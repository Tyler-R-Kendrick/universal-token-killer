#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { compressPromptForLlm, compressTextWithLlmlingua2, type DetokResult, type PromptCompressionResult } from '@utk/core';
import { z } from 'zod';

const detokInputSchema = {
  text: z.string().describe('Input text to rewrite into simplified tokens with LLMLingua2.'),
  rate: z.number().min(0.05).max(1).optional().describe('Compression rate to keep. Defaults to 0.33.'),
  targetToken: z.number().int().positive().optional().describe('Optional target token count passed to LLMLingua2.'),
  modelName: z.string().optional().describe('Optional Hugging Face model name for LLMLingua2.'),
  forceTokens: z.array(z.string()).optional().describe('Tokens that LLMLingua2 should preserve.')
};

const detokOutputSchema = {
  compressedText: z.string(),
  originalTokens: z.number(),
  compressedTokens: z.number(),
  rate: z.number(),
  model: z.string(),
  usedLlmlingua2: z.boolean(),
  applied: z.boolean()
};

const detokPromptInputSchema = {
  prompt: z.string().describe('Prompt text to compress. Only natural-language spans are rewritten.'),
  workspaceRoot: z.string().optional().describe('Workspace root containing .utk/config.toml. Defaults to current working directory.'),
  rate: z.number().min(0.05).max(1).optional().describe('Compression rate to keep. Defaults to .utk/config.toml detok.prompt.rate.'),
  targetToken: z.number().int().positive().optional().describe('Optional target token count passed to the compression provider.'),
  model: z.string().optional().describe('Compression model id in <provider>/<model> form, for example default/LLMLingua2.')
};

const detokPromptOutputSchema = {
  compressedPrompt: z.string(),
  originalTokens: z.number(),
  compressedTokens: z.number(),
  rate: z.number(),
  model: z.string(),
  applied: z.boolean(),
  error: z.string().optional()
};

export type DetokToolArgs = {
  text: string;
  rate?: number;
  targetToken?: number;
  modelName?: string;
  forceTokens?: string[];
};

export type DetokToolOutput = {
  compressedText: string;
  originalTokens: number;
  compressedTokens: number;
  rate: number;
  model: string;
  usedLlmlingua2: boolean;
  applied: boolean;
};

export type DetokPromptToolArgs = {
  prompt: string;
  workspaceRoot?: string;
  rate?: number;
  targetToken?: number;
  model?: string;
};

export type DetokPromptToolOutput = {
  compressedPrompt: string;
  originalTokens: number;
  compressedTokens: number;
  rate: number;
  model: string;
  applied: boolean;
  error?: string;
};

export async function runDetokTool(args: DetokToolArgs): Promise<DetokToolOutput> {
  const result = await compressTextWithLlmlingua2(args.text, {
    force: true,
    rate: args.rate,
    targetToken: args.targetToken,
    modelName: args.modelName,
    forceTokens: args.forceTokens
  });
  return toToolOutput(result);
}

export async function runDetokPromptTool(args: DetokPromptToolArgs): Promise<DetokPromptToolOutput> {
  const result = await compressPromptForLlm(args.prompt, {
    workspaceRoot: args.workspaceRoot ?? process.cwd(),
    rate: args.rate,
    targetToken: args.targetToken,
    model: args.model
  });
  return toPromptToolOutput(result);
}

export function createDetokServer(): McpServer {
  const server = new McpServer({
    name: 'detok',
    version: '0.1.0'
  });

  server.registerTool('detok', {
    title: 'Detok',
    description: 'Rewrite input text into simplified tokens locally with LLMLingua2 before passing it to an LLM.',
    inputSchema: detokInputSchema,
    outputSchema: detokOutputSchema
  }, async (args) => {
    const output = await runDetokTool(args);
    return {
      structuredContent: output,
      content: [{ type: 'text', text: output.compressedText }]
    };
  });

  server.registerTool('detoks-prompt', {
    title: 'Detoks Prompt',
    description: 'Compress only natural-language spans in a prompt while preserving code, inline code, blockquotes, and quoted strings.',
    inputSchema: detokPromptInputSchema,
    outputSchema: detokPromptOutputSchema
  }, async (args) => {
    const output = await runDetokPromptTool(args);
    return {
      structuredContent: output,
      content: [{ type: 'text', text: output.compressedPrompt }]
    };
  });

  return server;
}

/* c8 ignore start */
export async function main(): Promise<void> {
  const server = createDetokServer();
  await server.connect(new StdioServerTransport());
}

function toToolOutput(result: DetokResult): DetokToolOutput {
  return {
    compressedText: result.compressedText,
    originalTokens: result.originTokens,
    compressedTokens: result.compressedTokens,
    rate: result.rate,
    model: result.model,
    usedLlmlingua2: result.usedLlmlingua2,
    applied: result.applied
  };
}

function toPromptToolOutput(result: PromptCompressionResult): DetokPromptToolOutput {
  return {
    compressedPrompt: result.compressedPrompt,
    originalTokens: result.originalTokens,
    compressedTokens: result.compressedTokens,
    rate: result.rate,
    model: result.model,
    applied: result.applied,
    ...(result.error ? { error: result.error } : {})
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
/* c8 ignore stop */
