# Quickstart

This quickstart shows the smallest useful UTK integration: mediate a tool result, inspect the compact response, and recover the full output from `.utk/`.

## Install

```bash
python -m pip install -r requirements-detok.txt
npm install
npm run build
```

UTK is a workspace package in this repo. Consumers should call the package APIs from a hook host or integration layer.

## Mediate A Shell Result

```ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mediateToolExecution } from '@utk/core';

const execFileAsync = promisify(execFile);

const result = await mediateToolExecution({
  workspaceRoot: process.cwd(),
  toolId: 'shell.git.status',
  input: { command: 'git status --short' },
  execute: async () => {
    const { stdout, stderr } = await execFileAsync('git', ['status', '--short']);
    return `${stdout}${stderr}`;
  }
});

console.log(result.response);
```

## Mediate A Structured Tool Result

```ts
const result = await mediateToolExecution({
  workspaceRoot: process.cwd(),
  toolId: 'workspace.symbols',
  input: { query: 'mediateToolExecution' },
  execute: async () => ({
    symbols: [
      { name: 'mediateToolExecution', file: 'packages/core/src/mediation/toolMediator.ts' }
    ]
  })
});
```

Structured output is summarized for chat but preserved exactly in the raw artifact.

## Inspect Results

After mediation, inspect:

```text
.utk/tools/<tool-id>/observations/<run-id>/output.raw.*
.utk/tools/<tool-id>/observations/<run-id>/output.compact.*
.utk/tools/<tool-id>/observations/<run-id>/output.schema.json
.utk/tools/<tool-id>/route.json
```

Use the raw artifact for full fidelity and the compact artifact for model-visible summaries.

## Initialize Project-Local Reuse Artifacts

Use `skills/utk-init` when onboarding a repo. It seeds schema artifacts and prepares dynamic reuse folders:

```text
.utk/session-agents  -> .github/agents
.utk/session-skills  -> .agents/skills
```

The links are created only when the destination path does not already contain a concrete directory.

## Next References

- [Copilot Hook Integration](copilot-hook.md)
- [Configuration](configuration.md)
- [Artifacts And Recovery](artifacts.md)
- [Bash-Like Tool Templates](bash-like-tool.md)
- [Session Agents And Skills](session-artifacts.md)
