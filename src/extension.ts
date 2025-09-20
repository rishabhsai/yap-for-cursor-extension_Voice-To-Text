import * as vscode from 'vscode';

type TranscriptAction = 'copy' | 'insertAtCursor' | 'insertBelow' | 'insertAbove' | 'newFile';

class YapController {
  private statusItem: vscode.StatusBarItem;
  private recording = false;
  private webviewPanel: vscode.WebviewPanel | null = null;
  private inlineDecoration: vscode.TextEditorDecorationType | null = null;
  private lastPreviewRange: vscode.Range | null = null;

  constructor(private ctx: vscode.ExtensionContext) {
    this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    this.statusItem.command = 'yap.toggle';
    this.updateStatusItem();
    this.statusItem.show();
  }

  dispose() {
    this.statusItem.dispose();
    this.inlineDecoration?.dispose();
    this.webviewPanel?.dispose();
  }

  async toggle() {
    if (this.recording) {
      await this.stop();
    } else {
      await this.start();
    }
  }

  private updateStatusItem() {
    if (this.recording) {
      this.statusItem.text = '$(circle-filled) Recording';
      this.statusItem.tooltip = 'Click to stop recording';
      this.statusItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
    } else {
      this.statusItem.text = '$(mic) Yap';
      this.statusItem.tooltip = 'Click to start recording';
      this.statusItem.color = undefined;
    }
  }

  private ensureInlineDecoration() {
    if (!this.inlineDecoration) {
      this.inlineDecoration = vscode.window.createTextEditorDecorationType({
        after: { margin: '0 0 0 0.6em', color: new vscode.ThemeColor('editorCodeLens.foreground') },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      });
    }
  }

  private showInlinePreview(text: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    if (!vscode.workspace.getConfiguration('yap').get<boolean>('inlinePreview', true)) return;
    this.ensureInlineDecoration();
    const pos = editor.selection.active;
    const range = new vscode.Range(pos, pos);
    this.lastPreviewRange = range;
    const decs: vscode.DecorationOptions[] = [
      { range, renderOptions: { after: { contentText: text } } }
    ];
    editor.setDecorations(this.inlineDecoration!, decs);
  }

  private clearInlinePreview() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.inlineDecoration) return;
    editor.setDecorations(this.inlineDecoration, []);
    this.lastPreviewRange = null;
  }

  private applyFinalTranscript(action: TranscriptAction, text: string) {
    const editor = vscode.window.activeTextEditor;
    switch (action) {
      case 'copy':
        vscode.env.clipboard.writeText(text);
        vscode.window.setStatusBarMessage('Yap: Copied transcript to clipboard', 2000);
        return;
      case 'insertAtCursor':
        if (!editor) return;
        editor.edit((eb) => eb.insert(editor.selection.active, text));
        return;
      case 'insertBelow':
        if (!editor) return;
        editor.edit((eb) => {
          const line = editor.selection.active.line;
          eb.insert(new vscode.Position(line + 1, 0), (line < editor.document.lineCount - 1 ? '\n' : '') + text + '\n');
        });
        return;
      case 'insertAbove':
        if (!editor) return;
        editor.edit((eb) => {
          const line = editor.selection.active.line;
          eb.insert(new vscode.Position(line, 0), text + '\n');
        });
        return;
      case 'newFile':
        vscode.workspace.openTextDocument({ content: text, language: editor?.document.languageId }).then(doc => {
          vscode.window.showTextDocument(doc);
        });
        return;
    }
  }

  private async pickAction(): Promise<TranscriptAction | undefined> {
    const alwaysPrompt = vscode.workspace.getConfiguration('yap').get<boolean>('alwaysPrompt', true);
    const defaultAction = vscode.workspace.getConfiguration('yap').get<TranscriptAction>('defaultAction', 'copy');
    if (!alwaysPrompt) return defaultAction;
    const picked = await vscode.window.showQuickPick([
      { label: 'Copy', action: 'copy' },
      { label: 'Insert at cursor', action: 'insertAtCursor' },
      { label: 'Insert below', action: 'insertBelow' },
      { label: 'Insert above', action: 'insertAbove' },
      { label: 'Open new file', action: 'newFile' }
    ], { placeHolder: 'Apply transcript to…' });
    return picked?.action as TranscriptAction | undefined;
  }

  private createOrRevealPanel() {
    const showPopup = vscode.workspace.getConfiguration('yap').get<boolean>('showPopupWhileRecording', true);
    if (!showPopup) return null;
    if (this.webviewPanel) {
      this.webviewPanel.reveal(undefined, true);
      return this.webviewPanel;
    }
    const panel = vscode.window.createWebviewPanel(
      'yapRecorder',
      'Yap Recorder',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true }
    );
    panel.iconPath = vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>').toString('base64'));
    panel.webview.html = this.getWebviewHtml(panel.webview);
    panel.webview.onDidReceiveMessage((msg) => this.onWebviewMessage(msg));
    panel.onDidDispose(() => {
      this.webviewPanel = null;
    });
    this.webviewPanel = panel;
    return panel;
  }

  private getWebviewHtml(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.ctx.extensionUri, 'media', 'asr-webview.js'));
    const nonce = String(Date.now());
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' 'unsafe-eval' https://cdn.jsdelivr.net; style-src ${webview.cspSource} 'unsafe-inline'; connect-src https://cdn.jsdelivr.net data:; media-src blob: data:; worker-src blob:;" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Yap Recorder</title>
      <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: transparent; margin: 0; padding: 16px; }
        .rec { display: inline-flex; align-items: center; gap: 8px; }
        .dot { width: 10px; height: 10px; border-radius: 5px; background: var(--vscode-charts-red); animation: pulse 1.2s infinite; }
        @keyframes pulse { 0% { transform: scale(0.8); opacity: .6 } 50% { transform: scale(1.2); opacity: 1 } 100% { transform: scale(0.8); opacity: .6 } }
        #status { opacity: 0.8 }
      </style>
    </head>
    <body>
      <div class="rec">
        <div class="dot"></div>
        <div id="status">Recording…</div>
      </div>
      <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
      </script>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  private onWebviewMessage(msg: any) {
    switch (msg.type) {
      case 'loading':
        vscode.window.setStatusBarMessage(`Yap: ${msg.message}`, 1500);
        break;
      case 'ready':
        // Worker ready
        break;
      case 'partial':
        this.showInlinePreview(msg.text || '');
        break;
      case 'final':
        this.clearInlinePreview();
        this.finishWithText(msg.text || '');
        break;
      case 'error':
        this.clearInlinePreview();
        vscode.window.showErrorMessage(`Yap error: ${msg.message || 'Unknown error'}`);
        this.recording = false;
        vscode.commands.executeCommand('setContext', 'yap.recording', false);
        this.updateStatusItem();
        break;
    }
  }

  private async start() {
    this.recording = true;
    vscode.commands.executeCommand('setContext', 'yap.recording', true);
    this.updateStatusItem();
    vscode.window.showInformationMessage('Recording…');
    const panel = this.createOrRevealPanel();
    const language = vscode.workspace.getConfiguration('yap').get<string>('language', 'auto');
    panel?.webview.postMessage({ type: 'start', language });
  }

  private async stop() {
    const panel = this.webviewPanel;
    panel?.webview.postMessage({ type: 'stop' });
  }

  private async finishWithText(text: string) {
    this.recording = false;
    vscode.commands.executeCommand('setContext', 'yap.recording', false);
    this.updateStatusItem();
    const action = await this.pickAction();
    if (action) this.applyFinalTranscript(action, text);
    // Close the panel after finishing
    this.webviewPanel?.dispose();
    this.webviewPanel = null;
  }
}

let controller: YapController | null = null;

export function activate(context: vscode.ExtensionContext) {
  controller = new YapController(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('yap.toggle', () => controller?.toggle()),
    vscode.commands.registerCommand('yap.start', () => controller && !controller['recording'] && controller.toggle()),
    vscode.commands.registerCommand('yap.stop', () => controller && controller['recording'] && controller.toggle()),
    controller
  );
}

export function deactivate() {
  controller?.dispose();
}

