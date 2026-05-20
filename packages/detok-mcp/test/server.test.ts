import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createDetokServer, runDetokPromptTool, runDetokTool } from '../src/server.js';

describe('detok MCP server', () => {
  it('rewrites text with the LLMLingua2-backed detok tool', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    try {
      const result = await runDetokTool({
        text: 'alpha beta gamma delta epsilon zeta eta theta iota kappa',
        rate: 0.3
      });

      expect(result.usedLlmlingua2).toBe(true);
      expect(result.applied).toBe(true);
      expect(result.compressedText).toBe('alpha beta gamma');
      expect(result.compressedTokens).toBeLessThan(result.originalTokens);
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('creates an MCP server named detok', () => {
    const server = createDetokServer();
    expect(server.isConnected()).toBe(false);
  });

  it('runs detoks-prompt with prompt-safe compression', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    try {
      const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-detok-prompt-mcp-'));
      const result = await runDetokPromptTool({
        prompt: 'Compress this long natural language prompt. `EXACT_TOKEN` must stay unchanged.',
        workspaceRoot,
        rate: 0.5
      });

      expect(result.compressedPrompt).toContain('Compress this');
      expect(result.compressedPrompt).toContain('`EXACT_TOKEN`');
      expect(result.model).toBe('default/LLMLingua2');
    } finally {
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });

  it('serves the detok tool over MCP', async () => {
    const previousFake = process.env.UTK_DETOK_FAKE;
    process.env.UTK_DETOK_FAKE = '1';
    const server = createDetokServer();
    const client = new Client({ name: 'detok-test-client', version: '0.1.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport)
      ]);

      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain('detok');

      const result = await client.callTool({
        name: 'detok',
        arguments: {
          text: 'alpha beta gamma delta epsilon zeta eta theta iota kappa',
          rate: 0.2
        }
      });
      expect(result.structuredContent?.compressedText).toBe('alpha beta');
    } finally {
      await client.close();
      await server.close();
      if (previousFake === undefined) {
        delete process.env.UTK_DETOK_FAKE;
      } else {
        process.env.UTK_DETOK_FAKE = previousFake;
      }
    }
  });
});
