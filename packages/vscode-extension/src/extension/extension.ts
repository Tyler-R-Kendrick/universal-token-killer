import * as vscode from 'vscode';
import { initializeWorkspaceStore } from '../store/workspace.js';

const COMMANDS = [
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
  if (!workspaceFolder) {
    return;
  }

  await initializeWorkspaceStore(workspaceFolder);

  for (const command of COMMANDS) {
    const disposable = vscode.commands.registerCommand(command, async () => {
      if (command === 'utk.openStorageFolder') {
        const uri = vscode.Uri.joinPath(vscode.Uri.file(workspaceFolder), '.utk');
        await vscode.commands.executeCommand('revealFileInOS', uri);
        return;
      }

      await vscode.window.showInformationMessage(`Executed ${command}`);
    });

    context.subscriptions.push(disposable);
  }
}

export function deactivate(): void {
  // no-op
}
