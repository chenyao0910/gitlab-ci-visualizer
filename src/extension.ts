import * as vscode from 'vscode'
import { SidebarProvider } from './webview/sidebarProvider'
import { parseYaml } from './visualizer/parser'
import { resolveIncludes } from './visualizer/includeResolver'
import { mergeDocuments } from './visualizer/merger'
import { extractPipeline } from './visualizer/pipelineExtractor'
import { PipelineMessage } from './types'

export function activate(context: vscode.ExtensionContext): void {
  const sidebar = new SidebarProvider(context.extensionUri)

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gitlabCiVisualizer.sidebar', sidebar)
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('gitlabCiVisualizer.setToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your GitLab Personal Access Token (read_api scope)',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
      })
      if (token !== undefined) {
        await context.secrets.store('gitlabCiVisualizer.token', token)
        vscode.window.showInformationMessage('GitLab CI Visualizer: access token saved.')
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('gitlabCiVisualizer.visualize', () => {
      const doc = vscode.window.activeTextEditor?.document
      if (doc && isGitlabCi(doc)) {
        triggerUpdate(doc, context, sidebar)
      } else {
        vscode.window.showWarningMessage('Open a .gitlab-ci.yml file first.')
      }
    })
  )

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      if (isGitlabCi(doc)) triggerUpdate(doc, context, sidebar)
    })
  )
}

function isGitlabCi(doc: vscode.TextDocument): boolean {
  return doc.fileName.endsWith('.gitlab-ci.yml')
}

async function triggerUpdate(
  document: vscode.TextDocument,
  context: vscode.ExtensionContext,
  sidebar: SidebarProvider
): Promise<void> {
  sidebar.postMessage({ type: 'loading' })

  try {
    const workspaceRoot =
      vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath ?? ''
    const token = await context.secrets.get('gitlabCiVisualizer.token')
    const instanceUrl =
      vscode.workspace.getConfiguration('gitlabCiVisualizer')
        .get<string>('instanceUrl') ?? 'https://gitlab.com'

    const rootDoc = parseYaml(document.getText())
    const docs = await resolveIncludes(rootDoc, {
      workspaceRoot,
      gitlabConfig: { instanceUrl, token },
    })
    const merged = mergeDocuments(docs)
    const pipeline = extractPipeline(merged)

    sidebar.postMessage({ type: 'update', pipeline })
  } catch (e: any) {
    const msg: PipelineMessage = {
      type: 'error',
      message: e.message ?? 'Unknown error',
    }
    sidebar.postMessage(msg)
  }
}

export function deactivate(): void {}
