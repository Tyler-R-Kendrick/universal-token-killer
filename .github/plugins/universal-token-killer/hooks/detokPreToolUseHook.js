#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const input = readFileSync(0, 'utf8');
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = process.env.UTK_WORKSPACE_ROOT || process.cwd();

const candidates = [
  join(workspaceRoot, 'packages', 'copilot-hook', 'dist', 'detokPreToolUseHook.js'),
  join(workspaceRoot, 'node_modules', '@utk', 'copilot-hook', 'dist', 'detokPreToolUseHook.js'),
  join(pluginRoot, 'node_modules', '@utk', 'copilot-hook', 'dist', 'detokPreToolUseHook.js')
];

const runner = candidates.find((candidate) => existsSync(candidate));
if (!runner) {
  process.stdout.write('{}');
  process.exit(0);
}

const result = spawnSync(process.execPath, [runner], {
  input,
  encoding: 'utf8',
  env: {
    ...process.env,
    UTK_WORKSPACE_ROOT: workspaceRoot
  }
});

if (result.error || result.status !== 0) {
  process.stdout.write('{}');
  process.exit(0);
}

process.stdout.write(result.stdout || '{}');
