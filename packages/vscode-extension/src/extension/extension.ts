import * as vscode from 'vscode';
import { cleanupObservations, compactSchemaHistory, initializeWorkspaceStore, quarantineInvalidArtifacts, rebuildRoutes, validateArtifacts } from '../store/workspace.js';

export const COMMANDS = [
  'utk.status',
  'utk.cleanupObservations',
  'utk.compactSchemaHistory',
  'utk.rebuildSchemas',
  'utk.rebuildRoutes',
  'utk.validateArtifacts',
  'utk.quarantineInvalidArtifacts',
  'utk.openStorageFolder'
] as const;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceFolder) return;
  const storageRoot = await initializeWorkspaceStore(workspaceFolder);

  for (const command of COMMANDS) {
    context.subscriptions.push(vscode.commands.registerCommand(command, async () => runCommand(command, workspaceFolder, storageRoot)));
  }
}

export function deactivate(): void {
  // no-op
}

export async function runCommand(command: (typeof COMMANDS)[number], workspaceFolder: string, storageRoot: string): Promise<void> {
  if (command === 'utk.openStorageFolder') {
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.joinPath(vscode.Uri.file(workspaceFolder), '.utk'));
    return;
  }

  if (command === 'utk.cleanupObservations') {
    const removed = await cleanupObservations(storageRoot);
    await vscode.window.showInformationMessage(`UTK removed ${removed} observation set(s).`);
    return;
  }

  if (command === 'utk.compactSchemaHistory') {
    const removed = await compactSchemaHistory(storageRoot);
    await vscode.window.showInformationMessage(`UTK compacted schema history; removed ${removed} artifact(s).`);
    return;
  }

  if (command === 'utk.rebuildRoutes' || command === 'utk.rebuildSchemas') {
    await rebuildRoutes(storageRoot);
    await vscode.window.showInformationMessage('UTK rebuilt route artifacts.');
    return;
  }

  if (command === 'utk.validateArtifacts') {
    const invalid = await validateArtifacts(storageRoot);
    await vscode.window.showInformationMessage(`UTK artifact validation found ${invalid.length} invalid artifact(s).`);
    return;
  }

  if (command === 'utk.quarantineInvalidArtifacts') {
    const count = await quarantineInvalidArtifacts(storageRoot);
    await vscode.window.showInformationMessage(`UTK quarantined ${count} invalid artifact(s).`);
    return;
  }

  await vscode.window.showInformationMessage(`UTK storage ready at ${storageRoot}.`);
}
