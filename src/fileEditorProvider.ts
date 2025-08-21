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
                        if(Boolean(message.hasHeader) && length > 0) length--;
                        vscode.env.clipboard.writeText(fileContent);
                        vscode.window.showInformationMessage(`Copied ${length} row(s) to clipboard`);
                        return;
                    case 'parseWithDelimiter':
                        // Parse delimited file with custom delimiter and return to webview
                        const fileData = FileParser.parse(message.rawText, message.delimiter || ',', message.useRawContent);
                        webviewPanel.webview.postMessage({
                            type: 'parsedData',
                            data: fileData
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
                <input type="checkbox" id="rawTextCheckbox"> Raw Text
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
            <button id="copyBtn" disabled title="Copy Selected Rows"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-copy" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/>
</svg></button>
            <span id="selectionInfo">No rows selected</span>
        </div>
    </div>
    <div id="tableContainer">
        <table id="csvTable">
            <thead id="csvHeader"></thead>
            <tbody id="csvBody"></tbody>
        </table>
    </div>
    
    <!-- Modal for viewing large text content -->
    <div id="textModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Full Text Content</h3>
                <button class="close-btn" id="closeModal">&times;</button>
            </div>
            <div class="modal-body">
                <pre id="modalText"></pre>
            </div>
        </div>
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
