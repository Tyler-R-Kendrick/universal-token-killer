import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { processCopilotToolHookPayload } from '../src/copilotHook.js';

describe('GitHub Copilot tool hook', () => {
  it('mediates observable non-shell tool results instead of passing through', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-hook-'));
    const payload = JSON.stringify({
      tool_name: 'read_file',
      tool_input: { path: 'src/index.ts' },
      tool_output: { contents: 'export const value = 1;' }
    });

    const output = await processCopilotToolHookPayload(payload, { workspaceRoot });

    expect(output).toBeTruthy();
    const parsed = JSON.parse(output ?? '{}') as { hookSpecificOutput?: { updatedOutput?: string } };
    expect(parsed.hookSpecificOutput?.updatedOutput).toContain('Tool result stored at:');
    expect(parsed.hookSpecificOutput?.updatedOutput).toContain('Serializer: toon');
    expect(await readFile(path.join(workspaceRoot, '.utk', 'routes', 'index.json'), 'utf8')).toContain('read_file');
  });

  it('passes malformed and unobservable payloads through silently', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-pass-'));

    await expect(processCopilotToolHookPayload('{', { workspaceRoot })).resolves.toBeUndefined();
    await expect(processCopilotToolHookPayload('null', { workspaceRoot })).resolves.toBeUndefined();
    await expect(processCopilotToolHookPayload(JSON.stringify({ tool_input: { path: 'x' }, tool_output: 'x' }), { workspaceRoot })).resolves.toBeUndefined();
    await expect(processCopilotToolHookPayload(JSON.stringify({ tool_name: 'read_file', tool_input: { path: 'x' } }), { workspaceRoot })).resolves.toBeUndefined();
  });

  it('observes alternate Copilot hook field names', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-copilot-alternate-'));

    await expect(processCopilotToolHookPayload(JSON.stringify({ toolName: 'tool.alt', toolInput: { id: 1 }, toolOutput: { ok: true } }), { workspaceRoot })).resolves.toContain('updatedOutput');
    await expect(processCopilotToolHookPayload(JSON.stringify({ toolName: 'tool.result', result: { ok: true } }), { workspaceRoot })).resolves.toContain('updatedOutput');
  });
});
