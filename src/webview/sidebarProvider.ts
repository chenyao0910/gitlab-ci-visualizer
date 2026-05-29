import * as vscode from 'vscode'
import { PipelineMessage } from '../types'

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'src', 'webview'),
      ],
    }

    webviewView.webview.html = this.buildHtml(webviewView.webview)
  }

  postMessage(message: PipelineMessage): void {
    this.view?.webview.postMessage(message)
  }

  private buildHtml(webview: vscode.Webview): string {
    const rendererUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'renderer.js')
    )
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'styles.css')
    )
    const nonce = getNonce()

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none';
             style-src ${webview.cspSource};
             script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${stylesUri}">
  <title>GitLab CI Pipeline</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${rendererUri}"></script>
</body>
</html>`
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
