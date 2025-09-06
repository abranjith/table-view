import * as vscode from 'vscode';
import { FileParser } from './fileParser';

/**
 * Custom editor provider for delimited files
 */
export class FileEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new FileEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(
            FileEditorProvider.viewType, 
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        );
        return providerRegistration;
    }

    private static readonly viewType = 'fileViewer.fileEditor';

    constructor(private readonly context: vscode.ExtensionContext) {}

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Setup webview options
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        // Set the HTML content
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Function to update webview content
        function updateWebview() {
            webviewPanel.webview.postMessage({
                type: 'update',
                rawText: document.getText()
            });
        }

        // Set up event listeners
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                updateWebview();
            }
        });

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'copy':
                        // Copy selected rows to clipboard
                        const delimiter = message.delimiter || ',';
                        const fileContent = FileParser.stringify(message.rows, delimiter);
                        let length = message.rows.length;
                        if(Boolean(message.hasHeader) && length > 0) {
                            length--;
                        }
                        vscode.env.clipboard.writeText(fileContent);
                        vscode.window.showInformationMessage(`Copied ${length} row(s) to clipboard`);
                        return;
                    case 'save':
                        // Save edited data to file
                        this.saveFile(document, message.data, message.delimiter || ',');
                        return;
                    case 'parseWithDelimiter':
                        // Parse delimited file with custom delimiter and return to webview
                        const fileData = FileParser.parse(message.rawText, message.delimiter || ',', message.useRawContent);
                        webviewPanel.webview.postMessage({
                            type: 'parsedData',
                            data: fileData
                        });
                        return;
                    case 'showCancelConfirmation':
                        vscode.window.showWarningMessage('Are you sure you want to cancel? All unsaved changes will be lost.', { modal: true }, 'Yes')
                            .then(selection => {
                                if (selection === 'Yes') {
                                    webviewPanel.webview.postMessage({
                                        type: 'cancelConfirmed',
                                        confirmed: true
                                    });
                                }
                            });
                        return;
                    default:
                        // Handle unknown message types
                        console.warn(`Unknown message type: ${message.type}`);
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Clean up
        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });

        // Initialize with current content
        updateWebview();
    }

    /**
     * Save edited data to the document
     */
    private async saveFile(document: vscode.TextDocument, data: string[][], delimiter: string): Promise<void> {
        try {
            const fileContent = FileParser.stringify(data, delimiter);
            const edit = new vscode.WorkspaceEdit();
            
            // Replace entire document content
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );
            
            edit.replace(document.uri, fullRange, fileContent);
            await vscode.workspace.applyEdit(edit);

            vscode.window.showInformationMessage('Changes saved successfully.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save changes: ${error}`);
        }
    }

    /**
     * Get the static HTML used for the editor webview.
     */
    private getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'fileViewer.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'fileViewer.css'));

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>Table View</title>
</head>
<body>
    <div id="controls">
        <div id="controlsLeft">
            <label id="rawTextLabel">
                <input type="checkbox" id="rawTextCheckbox" checked> Raw Text
            </label>
            <label id="hasHeaderLabel">
                <input type="checkbox" id="hasHeaderCheckbox" checked> Has Header
            </label>
            <label id="fitToScreenLabel">
                <input type="checkbox" id="fitToScreenCheckbox"> Fit To Screen
            </label>
            <label id="delimiterLabel">
                Delimiter: <input type="text" style="font-weight: bold;" id="delimiterInput" value="," maxlength="10">
            </label>
        </div>
        <div id="controlsRight">
            <button id="editBtn" disabled title="Edit File">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-fill" viewBox="0 0 16 16">
                <path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z"/>
                </svg>
            </button>
            <button id="saveBtn" disabled title="Save Changes" style="display: none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-floppy-fill" viewBox="0 0 16 16">
                <path d="M0 1.5A1.5 1.5 0 0 1 1.5 0H3v5.5A1.5 1.5 0 0 0 4.5 7h7A1.5 1.5 0 0 0 13 5.5V0h.086a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 16 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5H14v-5.5A1.5 1.5 0 0 0 12.5 9h-9A1.5 1.5 0 0 0 2 10.5V16h-.5A1.5 1.5 0 0 1 0 14.5z"/>
                <path d="M3 16h10v-5.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5zm9-16H4v5.5a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5zM9 1h2v4H9z"/>
                </svg>
            </button>
            <button id="cancelBtn" disabled title="Cancel Changes" style="display: none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-square" viewBox="0 0 16 16">
                <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/>
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
                </svg>
            </button>
            <div class="button-divider"></div>
            <button id="copyBtn" disabled title="Copy Selected Rows">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard-fill" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M10 1.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5zm-5 0A1.5 1.5 0 0 1 6.5 0h3A1.5 1.5 0 0 1 11 1.5v1A1.5 1.5 0 0 1 9.5 4h-3A1.5 1.5 0 0 1 5 2.5zm-2 0h1v1A2.5 2.5 0 0 0 6.5 5h3A2.5 2.5 0 0 0 12 2.5v-1h1a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3.5a2 2 0 0 1 2-2"/>
                </svg>
            </button>
            <span id="selectionInfo">No rows selected</span>
        </div>
    </div>
    <div id="tableContainer">
        <table id="csvTable">
            <thead id="csvHeader"></thead>
            <tbody id="csvBody"></tbody>
        </table>
    </div>

    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
