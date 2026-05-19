#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { compressTextWithLlmlingua2, type DetokResult } from '@utk/core';
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
/* c8 ignore stop */
