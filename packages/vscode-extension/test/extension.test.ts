import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const registered: Record<string, () => Promise<void>> = {};
const messages: string[] = [];
const executed: string[] = [];
let workspaceFolders: Array<{ uri: { fsPath: string } }> | undefined;

vi.mock('vscode', () => ({
  workspace: {
    get workspaceFolders() {
      return workspaceFolders;
    }
  },
  commands: {
    registerCommand: (command: string, callback: () => Promise<void>) => {
      registered[command] = callback;
      return { dispose: () => undefined };
    },
    executeCommand: async (command: string) => {
      executed.push(command);
    }
  },
  window: {
    showInformationMessage: async (message: string) => {
      messages.push(message);
    }
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
    joinPath: (base: { fsPath: string }, child: string) => ({ fsPath: `${base.fsPath}/${child}` })
  }
}));

const extension = await import('../src/extension/extension.js');

describe('VS Code extension command wiring', () => {
  it('activates only with workspace folders and registers commands', async () => {
    workspaceFolders = undefined;
    const empty = { subscriptions: [] as unknown[] };
    await extension.activate(empty as never);
    expect(empty.subscriptions).toHaveLength(0);

    workspaceFolders = [{ uri: { fsPath: await mkdtemp(path.join(os.tmpdir(), 'utk-vscode-ext-')) } }];
    const context = { subscriptions: [] as unknown[] };
    await extension.activate(context as never);
    expect(context.subscriptions).toHaveLength(extension.COMMANDS.length);
    await registered['utk.status']?.();
    expect(messages.at(-1)).toContain('UTK storage ready');
    extension.deactivate();
  });

  it('runs each command branch', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'utk-vscode-run-'));
    const storageRoot = await import('../src/store/workspace.js').then((store) => store.initializeWorkspaceStore(root));
    await extension.runCommand('utk.openStorageFolder', root, storageRoot);
    await extension.runCommand('utk.cleanupObservations', root, storageRoot);
    await extension.runCommand('utk.compactSchemaHistory', root, storageRoot);
    await extension.runCommand('utk.rebuildRoutes', root, storageRoot);
    await extension.runCommand('utk.rebuildSchemas', root, storageRoot);
    await extension.runCommand('utk.validateArtifacts', root, storageRoot);
    await extension.runCommand('utk.quarantineInvalidArtifacts', root, storageRoot);
    await extension.runCommand('utk.status', root, storageRoot);
    expect(executed).toContain('revealFileInOS');
    expect(messages.some((message) => message.includes('rebuilt route artifacts'))).toBe(true);
    expect(messages.some((message) => message.includes('quarantined'))).toBe(true);
  });
});
