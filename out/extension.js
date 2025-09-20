"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
/**
 * Provider for the recorder webview placed in the bottom Panel.
 * We keep the webview lightweight — it only displays a tiny "Recording…" UI
 * and owns the microphone + model worker.
 */
class YapRecorderViewProvider {
    constructor(ctx, onMessage) {
        this.ctx = ctx;
        this.onMessage = onMessage;
        this.view = null;
    }
    resolveWebviewView(webviewView) {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getWebviewHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage((msg) => this.onMessage(msg));
    }
    get ready() { return !!this.view; }
    async focus() {
        await vscode.commands.executeCommand(`${YapRecorderViewProvider.viewId}.focus`);
    }
    postMessage(msg) {
        this.view?.webview.postMessage(msg);
    }
    dispose() {
        this.view = null;
    }
    getWebviewHtml(webview) {
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
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: transparent; margin: 0; padding: 8px 12px; }
        .row { display: flex; align-items: center; gap: 10px; }
        select, button { background: var(--vscode-input-background); color: var(--vscode-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 2px 6px; }
        .rec { display: inline-flex; align-items: center; gap: 8px; }
        .dot { width: 10px; height: 10px; border-radius: 5px; background: var(--vscode-charts-red); animation: pulse 1.2s infinite; }
        @keyframes pulse { 0% { transform: scale(0.8); opacity: .6 } 50% { transform: scale(1.2); opacity: 1 } 100% { transform: scale(0.8); opacity: .6 } }
        #status { opacity: 0.9 }
      </style>
    </head>
    <body>
      <div class="row" style="margin-bottom:8px">
        <label for="micSelect">Mic</label>
        <select id="micSelect"></select>
        <button id="stopBtn">Stop</button>
      </div>
      <div class="rec" id="recordingStatus" style="display: none;">
        <div class="dot"></div>
        <div id="status">Recording…</div>
      </div>
      <div id="idleStatus">
        <div>Click the mic button in status bar to start recording</div>
        <div style="font-size: 12px; opacity: 0.8; margin-top: 8px;">
          If microphone doesn't work, check System Settings → Privacy & Security → Microphone
        </div>
      </div>
      <script nonce="${nonce}">const vscode = acquireVsCodeApi();</script>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
    }
}
YapRecorderViewProvider.viewId = 'yap.recorderView';
class YapController {
    constructor(ctx, viewProvider) {
        this.ctx = ctx;
        this.viewProvider = viewProvider;
        this.recording = false;
        this.inlineDecoration = null;
        this.lastPreviewRange = null;
        // Move Yap control to bottom-right
        this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
        this.statusItem.command = 'yap.toggle';
        this.updateStatusItem();
        this.statusItem.show();
    }
    dispose() {
        this.statusItem.dispose();
        this.inlineDecoration?.dispose();
        this.viewProvider.dispose();
    }
    async toggle() {
        if (this.recording) {
            await this.stop();
        }
        else {
            await this.start();
        }
    }
    updateStatusItem() {
        if (this.recording) {
            this.statusItem.text = '$(circle-filled) Recording';
            this.statusItem.tooltip = 'Click to stop recording';
            this.statusItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        }
        else {
            this.statusItem.text = '$(mic) Yap';
            this.statusItem.tooltip = 'Click to start recording';
            this.statusItem.color = undefined;
        }
    }
    ensureInlineDecoration() {
        if (!this.inlineDecoration) {
            this.inlineDecoration = vscode.window.createTextEditorDecorationType({
                after: { margin: '0 0 0 0.6em', color: new vscode.ThemeColor('editorCodeLens.foreground') },
                rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            });
        }
    }
    showInlinePreview(text) {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        if (!vscode.workspace.getConfiguration('yap').get('inlinePreview', true))
            return;
        this.ensureInlineDecoration();
        const pos = editor.selection.active;
        const range = new vscode.Range(pos, pos);
        this.lastPreviewRange = range;
        const decs = [
            { range, renderOptions: { after: { contentText: text } } }
        ];
        editor.setDecorations(this.inlineDecoration, decs);
    }
    clearInlinePreview() {
        const editor = vscode.window.activeTextEditor;
        if (!editor || !this.inlineDecoration)
            return;
        editor.setDecorations(this.inlineDecoration, []);
        this.lastPreviewRange = null;
    }
    applyFinalTranscript(action, text) {
        const editor = vscode.window.activeTextEditor;
        switch (action) {
            case 'copy':
                vscode.env.clipboard.writeText(text);
                vscode.window.setStatusBarMessage('Yap: Copied transcript to clipboard', 2000);
                return;
            case 'insertAtCursor':
                if (!editor)
                    return;
                editor.edit((eb) => eb.insert(editor.selection.active, text));
                return;
            case 'insertBelow':
                if (!editor)
                    return;
                editor.edit((eb) => {
                    const line = editor.selection.active.line;
                    eb.insert(new vscode.Position(line + 1, 0), (line < editor.document.lineCount - 1 ? '\n' : '') + text + '\n');
                });
                return;
            case 'insertAbove':
                if (!editor)
                    return;
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
    async pickAction() {
        const alwaysPrompt = vscode.workspace.getConfiguration('yap').get('alwaysPrompt', true);
        const defaultAction = vscode.workspace.getConfiguration('yap').get('defaultAction', 'copy');
        if (!alwaysPrompt)
            return defaultAction;
        const picked = await vscode.window.showQuickPick([
            { label: 'Copy', action: 'copy' },
            { label: 'Insert at cursor', action: 'insertAtCursor' },
            { label: 'Insert below', action: 'insertBelow' },
            { label: 'Insert above', action: 'insertAbove' },
            { label: 'Open new file', action: 'newFile' }
        ], { placeHolder: 'Apply transcript to…' });
        return picked?.action;
    }
    // Webview logic moved into YapRecorderViewProvider (bottom panel)
    onWebviewMessage(msg) {
        switch (msg.type) {
            case 'loading':
                vscode.window.setStatusBarMessage(`Yap: ${msg.message}`, 1500);
                break;
            case 'stopRequest':
                // Stop requested from webview UI
                if (this.recording) {
                    this.stop();
                }
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
    // Exposed for the view provider callback
    onWebviewMessagePublic(msg) {
        this.onWebviewMessage(msg);
    }
    async start() {
        this.recording = true;
        vscode.commands.executeCommand('setContext', 'yap.recording', true);
        this.updateStatusItem();
        const showPopup = vscode.workspace.getConfiguration('yap').get('showPopupWhileRecording', true);
        if (showPopup) {
            await this.viewProvider.focus(); // Ensure the panel view is created + visible
        }
        else if (!this.viewProvider.ready) {
            // If user disabled popup, still ensure the webview exists by briefly focusing then hiding panel
            await this.viewProvider.focus();
            // Hide the panel again to avoid visual noise
            await vscode.commands.executeCommand('workbench.action.togglePanel');
        }
        const language = vscode.workspace.getConfiguration('yap').get('language', 'auto');
        this.viewProvider.postMessage({ type: 'start', language });
        vscode.window.setStatusBarMessage('Yap: Recording…', 1500);
    }
    async stop() {
        // Immediately reflect stopping in UI
        if (this.recording) {
            this.recording = false;
            vscode.commands.executeCommand('setContext', 'yap.recording', false);
            this.updateStatusItem();
        }
        vscode.window.setStatusBarMessage('Yap: Stopping…', 1500);
        this.viewProvider.postMessage({ type: 'stop' });
    }
    async finishWithText(text) {
        this.recording = false;
        vscode.commands.executeCommand('setContext', 'yap.recording', false);
        this.updateStatusItem();
        const action = await this.pickAction();
        if (action)
            this.applyFinalTranscript(action, text);
    }
}
let controller = null;
function activate(context) {
    const provider = new YapRecorderViewProvider(context, (msg) => controller?.onWebviewMessagePublic(msg));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(YapRecorderViewProvider.viewId, provider));
    controller = new YapController(context, provider);
    context.subscriptions.push(vscode.commands.registerCommand('yap.toggle', () => controller?.toggle()), vscode.commands.registerCommand('yap.start', () => controller && !controller['recording'] && controller.toggle()), vscode.commands.registerCommand('yap.stop', () => controller && controller['recording'] && controller.toggle()), controller);
}
function deactivate() {
    controller?.dispose();
}
//# sourceMappingURL=extension.js.map