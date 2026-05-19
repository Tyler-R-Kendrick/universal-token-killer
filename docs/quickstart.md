# Quickstart

This quickstart shows the smallest useful UTK integration: mediate a tool result, inspect the compact response, and recover the full output from `.utk/`.

## Install

```bash
npm install
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
