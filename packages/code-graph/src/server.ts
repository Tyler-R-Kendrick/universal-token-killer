#!/usr/bin/env node
/* c8 ignore file */
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createCodeGraph, handleCodeGraphMcpTool, listCodeGraphMcpTools } from './index.js';

const graph = createCodeGraph({ workspaceRoot: process.cwd() });
const lines = readline.createInterface({ input, output: process.stderr });

for await (const line of lines) {
  if (!line.trim()) continue;
  try {
    const request = JSON.parse(line) as { id?: unknown; method?: string; params?: Record<string, unknown> };
    if (request.method === 'tools/list') {
      output.write(`${JSON.stringify({ id: request.id, result: { tools: listCodeGraphMcpTools() } })}\n`);
      continue;
    }
    if (request.method === 'tools/call') {
      const params = request.params ?? {};
      const name = typeof params.name === 'string' ? params.name : '';
      const args = params.arguments && typeof params.arguments === 'object' ? (params.arguments as Record<string, unknown>) : {};
      output.write(`${JSON.stringify({ id: request.id, result: await handleCodeGraphMcpTool(graph, name, args) })}\n`);
      continue;
    }
    output.write(`${JSON.stringify({ id: request.id, error: { message: `Unknown method: ${request.method}` } })}\n`);
  } catch (error) {
    output.write(`${JSON.stringify({ error: { message: error instanceof Error ? error.message : String(error) } })}\n`);
  }
}
