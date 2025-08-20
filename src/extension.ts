import * as vscode from 'vscode';
import { FileEditorProvider } from './fileEditorProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Table View extension is now active!');

	// Register the custom editor provider
	context.subscriptions.push(FileEditorProvider.register(context));

	// Register the command to open delimited files as table
	const openAsTableCommand = vscode.commands.registerCommand('fileViewer.openAsTable', async (uri?: vscode.Uri) => {
		// If no URI provided, get the active editor
		if (!uri && vscode.window.activeTextEditor) {
			uri = vscode.window.activeTextEditor.document.uri;
		}

		if (uri) {
			// Open the file with our custom editor
			await vscode.commands.executeCommand('vscode.openWith', uri, 'fileViewer.fileEditor');
		} else {
			vscode.window.showInformationMessage('No file selected');
		}
	});

	context.subscriptions.push(openAsTableCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
