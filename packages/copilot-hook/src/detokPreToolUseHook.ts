import { readFileSync } from 'node:fs';
import { processCopilotPreToolUsePayload } from './copilotHook.js';

/* c8 ignore start */
async function main(): Promise<void> {
  const payload = readFileSync(0, 'utf8');
  const workspaceRoot = process.env.UTK_WORKSPACE_ROOT ?? process.cwd();
  const output = await processCopilotPreToolUsePayload(payload, { workspaceRoot });
  if (output) process.stdout.write(output);
}

main().catch(() => {
  process.stdout.write('{}');
});
/* c8 ignore stop */
