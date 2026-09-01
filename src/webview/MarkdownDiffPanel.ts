import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import { parseMarkdown } from '../engine/parser';
import { computeFineGrainedDiffAsync } from '../engine/diff';
import { computeNormalizedImageHash } from '../engine/hash';
import { renderDiff } from './renderer';
import { localize } from '../extension/i18n';
import { GitService } from '../git/GitService';
import { visit } from 'unist-util-visit';

export class MarkdownDiffPanel {
    public static currentPanel: MarkdownDiffPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, initialUri?: vscode.Uri, initialTarget: 'before' | 'after' = 'after') {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getHtmlForWebview(initialUri, initialTarget);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'requestFile':
                        this._handleFileRequest(message.target);
                        return;
                    case 'diff':
                        this._handleDiffRequest(message.beforePath, message.afterPath, message.sensitivity, message.beforeLabel, message.afterLabel, message.diffId);
                        return;
                    case 'checkAutoPair':
                        this._handleAutoPair(message);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static render(extensionUri: vscode.Uri, initialUri?: vscode.Uri, initialTarget: 'before' | 'after' = 'after') {
        if (MarkdownDiffPanel.currentPanel) {
            MarkdownDiffPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            if (initialUri) {
                const fileName = initialUri.fsPath.split(/[/\\]/).pop() || initialUri.fsPath;
                MarkdownDiffPanel.currentPanel._panel.webview.postMessage({
                    command: 'fileSelected',
                    target: initialTarget,
                    fileName: fileName,
                    filePath: initialUri.fsPath
                });
            }
        } else {
            const panel = vscode.window.createWebviewPanel(
                'markdownDiffForAi',
                'Markdown Diff for AI',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    enableFindWidget: true,
                    localResourceRoots: [
                        extensionUri,
                        ...(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(f => f.uri) : [])
                    ]
                }
            );

            MarkdownDiffPanel.currentPanel = new MarkdownDiffPanel(panel, initialUri, initialTarget);
        }
    }

    public static renderWithVirtual(extensionUri: vscode.Uri, documentUri: vscode.Uri, target: 'before' | 'after', virtualPath: string, virtualLabel: string, _content: string) {
        const isNew = !MarkdownDiffPanel.currentPanel;
        
        // First ensure panel is rendered
        MarkdownDiffPanel.render(extensionUri, documentUri, target);
        
        // Then send the virtual file info
        const panel = MarkdownDiffPanel.currentPanel;
        if (panel) {
            const sendVirtual = () => {
                panel._panel.webview.postMessage({
                    command: 'fileSelected',
                    target: target === 'after' ? 'before' : 'after', // if documentUri is after, virtual is before
                    fileName: virtualLabel, // Show label in UI
                    filePath: virtualPath   // Use virtual path for backend tracking
                });
            };

            if (isNew) {
                // If the panel was just created, wait for the webview to mount before posting
                setTimeout(sendVirtual, 800);
            } else {
                sendVirtual();
            }
        }
    }

    private async _handleFileRequest(target: 'before' | 'after') {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: {
                'Markdown': ['md', 'markdown']
            }
        });

        if (uris && uris[0]) {
            const filePath = uris[0].fsPath;
            const fileName = filePath.split(/[/\\]/).pop() || filePath;
            
            this._panel.webview.postMessage({
                command: 'fileSelected',
                target: target,
                fileName: fileName,
                filePath: filePath
            });
        }
    }

    private async _handleAutoPair(message: any) {
        if (!message.oldPath || !message.newPath || !message.oppositePath) return;

        const oldDir = path.dirname(message.oldPath);
        const relativePath = path.relative(oldDir, message.newPath);
        const oppositeDir = path.dirname(message.oppositePath);
        const candidatePath = path.resolve(oppositeDir, relativePath);

        // Normalize paths for comparison (Windows drive letters, slashes)
        const normalize = (p: string) => path.normalize(p).toLowerCase();
        
        if (normalize(candidatePath) === normalize(message.oppositePath)) {
            return; // Already matches, prevent infinite loop
        }

        try {
            await fs.access(candidatePath);
            // File exists!
            const oppositeTarget = message.changedTarget === 'before' ? 'after' : 'before';
            this._panel.webview.postMessage({
                command: 'fileSelected',
                target: oppositeTarget,
                filePath: candidatePath,
                fileName: path.basename(candidatePath)
            });
        } catch (e) {
            // File does not exist, do nothing
        }
    }

    private async _handleDiffRequest(beforePath: string, afterPath: string, sensitivity: number, beforeLabel: string, afterLabel: string, diffId?: number) {
        // Create a URL resolver that resolves absolute paths, generates Webview URIs, and computes file hash
        const createUrlResolver = (baseDir: string) => (url: string, node: any) => {
            node.originalUrl = url;
            if (/^(https?|data):/i.test(url)) {
                node.url = url;
                node.imageHash = url; // for remote URLs, rely on URL as hash
                return;
            }
            try {
                let absolutePath: string;
                if (url.startsWith('file://')) {
                    absolutePath = vscode.Uri.parse(url).fsPath;
                } else {
                    absolutePath = path.resolve(baseDir, decodeURIComponent(url));
                }
                const uri = vscode.Uri.file(absolutePath);
                let baseWebviewUrl = this._panel.webview.asWebviewUri(uri).toString();
                
                // Compute SHA-256 hash of the file content
                if (fsSync.existsSync(absolutePath)) {
                    const fileBuffer = fsSync.readFileSync(absolutePath);
                    const ext = path.extname(absolutePath);
                    node.imageHash = computeNormalizedImageHash(fileBuffer, ext);
                } else {
                    node.imageHash = 'not-found-' + absolutePath;
                }
                
                // Append hash as cache buster to prevent VS Code Webview from aggressively caching swapped images
                node.url = baseWebviewUrl + '?t=' + node.imageHash;
            } catch (e) {
                node.url = url;
                node.imageHash = 'error';
            }
        };

        try {
            let actualBeforePath = beforePath;
            let beforeData: Buffer;
            let beforeGitRef: string | undefined = undefined;
            if (beforePath.startsWith('git:')) {
                // git:ref:absolutePath
                const parts = beforePath.split(':');
                beforeGitRef = parts[1];
                const originalPath = parts.slice(2).join(':');
                actualBeforePath = originalPath;
                const cwd = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(originalPath))?.uri.fsPath || path.dirname(originalPath);
                const gitService = new GitService();
                beforeData = Buffer.from(await gitService.getFileContent(originalPath, beforeGitRef, cwd));
            } else {
                beforeData = await fs.readFile(beforePath);
            }

            let afterData = await fs.readFile(afterPath);
            
            let beforeContent = beforeData.toString('utf8');
            let afterContent = afterData.toString('utf8');

            // Strip BOM (Byte Order Mark) if present
            if (beforeContent.charCodeAt(0) === 0xFEFF) {
                beforeContent = beforeContent.slice(1);
            }
            if (afterContent.charCodeAt(0) === 0xFEFF) {
                afterContent = afterContent.slice(1);
            }

            const beforeAst = parseMarkdown(beforeContent, createUrlResolver(path.dirname(actualBeforePath)));
            const afterAst = parseMarkdown(afterContent, createUrlResolver(path.dirname(afterPath)));

            // Resolve Git images if the before file is from Git
            if (beforeGitRef) {
                const gitService = new GitService();
                const cwd = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(actualBeforePath))?.uri.fsPath || path.dirname(actualBeforePath);
                const baseDir = path.dirname(actualBeforePath);
                const promises: Promise<void>[] = [];
                visit(beforeAst, 'image', (node: any) => {
                    if (!node.originalUrl || /^(https?|data):/i.test(node.originalUrl)) return;
                    promises.push((async () => {
                        try {
                            let absolutePath: string;
                            if (node.originalUrl.startsWith('file://')) {
                                absolutePath = vscode.Uri.parse(node.originalUrl).fsPath;
                            } else {
                                absolutePath = path.resolve(baseDir, decodeURIComponent(node.originalUrl));
                            }
                            let buffer = await gitService.getFileContentBinary(absolutePath, beforeGitRef!, cwd);
                            const ext = path.extname(absolutePath).toLowerCase();
                            node.imageHash = computeNormalizedImageHash(buffer, ext);
                            
                            let mime = 'application/octet-stream';
                            if (ext === '.svg') mime = 'image/svg+xml';
                            else if (ext === '.png') mime = 'image/png';
                            else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
                            else if (ext === '.gif') mime = 'image/gif';
                            else if (ext === '.webp') mime = 'image/webp';
                            node.url = `data:${mime};base64,${buffer.toString('base64')}`;
                        } catch (e) {
                            node.imageHash = 'git-not-found-' + node.originalUrl;
                        }
                    })());
                });
                await Promise.all(promises);
            }

            // Fetch configuration
            const config = vscode.workspace.getConfiguration('markdownDiffForAi');
            const defaultSensitivity = config.get<number>('defaultSensitivity', 0.8);
            const threshold = sensitivity !== undefined ? sensitivity : defaultSensitivity;

            // Compute diff asynchronously, yielding to avoid blocking Extension Host
            const diffResults = await computeFineGrainedDiffAsync(beforeAst, afterAst, threshold, 50);

            // Render to HTML safely
            const html = await renderDiff(diffResults, beforeLabel, afterLabel);

            // Send HTML to Webview
            this._panel.webview.postMessage({
                command: 'htmlReady',
                html: html,
                diffId: diffId
            });

        } catch (error) {
            vscode.window.showErrorMessage(`${localize('error.computing')} ${error}`);
        }
    }

    public dispose() {
        MarkdownDiffPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(initialUri?: vscode.Uri, initialTarget: 'before' | 'after' = 'after') {
        const config = vscode.workspace.getConfiguration('markdownDiffForAi');
        const defaultSensitivity = config.get<number>('defaultSensitivity', 0.8);

        return `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Markdown Diff for AI</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            display: flex;
            flex-direction: column;
            height: 100vh;
            box-sizing: border-box;
        }
        .container {
            display: flex;
            flex-direction: row;
            gap: 20px;
            margin-bottom: 20px;
        }
        .diff-container {
            flex-grow: 1;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            padding: 20px;
            background-color: var(--vscode-editor-background);
        }
        .diff-added {
            background-color: var(--vscode-diffEditor-insertedTextBackground);
            border-left: 4px solid var(--vscode-editorOverviewRuler-addedForeground);
        }
        .diff-removed {
            background-color: var(--vscode-diffEditor-removedTextBackground);
            border-left: 4px solid var(--vscode-editorOverviewRuler-deletedForeground);
            text-decoration: line-through;
        }
        .diff-modified {
            border-left: 4px solid var(--vscode-editorOverviewRuler-modifiedForeground);
        }
        .diff-modified-image-block {
            border-left: 4px solid var(--vscode-editorOverviewRuler-modifiedForeground);
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 10px;
            background-color: var(--vscode-editor-background);
        }
        .diff-image-label {
            font-size: 0.85em;
            font-weight: bold;
            opacity: 0.7;
            margin-bottom: 5px;
        }
        .diff-image-old {
            border-left: none;
            padding: 10px;
            text-decoration: none;
            display: inline-block;
        }
        .diff-image-new {
            border-left: none;
            padding: 10px;
            text-decoration: none;
            display: inline-block;
        }
        ins.diff-inline-added {
            background-color: var(--vscode-diffEditor-insertedTextBackground);
            text-decoration: none;
            color: var(--vscode-editor-foreground);
            font-weight: bold;
        }
        del.diff-inline-removed {
            background-color: var(--vscode-diffEditor-removedTextBackground);
            text-decoration: line-through;
            color: var(--vscode-editor-foreground);
            opacity: 0.7;
        }
        .slider-container {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- After comes first -->
        <div>
            <h3>${localize('webview.after')}</h3>
            <button id="selectAfter">${localize('webview.selectFile')}</button>
            <span id="afterName">${localize('webview.notSelected')}</span>
        </div>
        <div>
            <h3>${localize('webview.before')}</h3>
            <button id="selectBefore">${localize('webview.selectFile')}</button>
            <span id="beforeName">${localize('webview.notSelected')}</span>
        </div>
        <div>
            <br/>
            <button id="startDiff" disabled>${localize('webview.compare')}</button>
            <button id="clearAll">${localize('webview.clear')}</button>
            
            <div class="slider-container">
                <label for="sensitivitySlider" title="${localize('webview.sensitivityTooltip')}">${localize('webview.sensitivity')}: <span id="sensitivityValue">${defaultSensitivity.toFixed(1)}</span></label>
                <input type="range" id="sensitivitySlider" min="0" max="1" step="0.1" value="${defaultSensitivity}" disabled>
            </div>
        </div>
    </div>
    
    <div class="diff-container" id="diffOutput">
        <!-- Rendered Diff will appear here -->
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        let beforePath = ${initialUri && initialTarget === 'before' ? JSON.stringify(initialUri.fsPath) : 'null'};
        let afterPath = ${initialUri && initialTarget === 'after' ? JSON.stringify(initialUri.fsPath) : 'null'};
        let beforeLabel = beforePath ? beforePath.split(/[/\\\\]/).pop() : null;
        let afterLabel = afterPath ? afterPath.split(/[/\\\\]/).pop() : null;
        const slider = document.getElementById('sensitivitySlider');
        const sliderVal = document.getElementById('sensitivityValue');

        function updateUI() {
            document.getElementById('beforeName').textContent = beforePath ? (beforeLabel || beforePath.split(/[/\\\\]/).pop()) : '${localize('webview.notSelected')}';
            document.getElementById('afterName').textContent = afterPath ? (afterLabel || afterPath.split(/[/\\\\]/).pop()) : '${localize('webview.notSelected')}';
            
            if (beforePath && afterPath) {
                document.getElementById('startDiff').disabled = false;
                document.getElementById('sensitivitySlider').disabled = false;
            } else {
                document.getElementById('startDiff').disabled = true;
                document.getElementById('sensitivitySlider').disabled = true;
            }
        }

        function updatePath(target, newPath, newLabel) {
            const oldPath = target === 'before' ? beforePath : afterPath;
            const oppositePath = target === 'before' ? afterPath : beforePath;
            
            if (target === 'before') {
                beforePath = newPath;
                beforeLabel = newLabel;
            } else {
                afterPath = newPath;
                afterLabel = newLabel;
            }
            
            updateUI();
            
            if (oldPath && oppositePath && oldPath !== newPath) {
                vscode.postMessage({
                    command: 'checkAutoPair',
                    changedTarget: target,
                    oldPath: oldPath,
                    newPath: newPath,
                    oppositePath: oppositePath
                });
            }
            
            if (beforePath && afterPath) {
                triggerDiff();
            }
        }

        let currentDiffId = 0;
        function triggerDiff() {
            currentDiffId++;
            vscode.postMessage({ 
                command: 'diff',
                diffId: currentDiffId,
                beforePath: beforePath,
                afterPath: afterPath,
                beforeLabel: beforeLabel || (beforePath ? beforePath.split(/[/\\\\]/).pop() : ''),
                afterLabel: afterLabel || (afterPath ? afterPath.split(/[/\\\\]/).pop() : ''),
                sensitivity: parseFloat(slider.value)
            });
            document.getElementById('diffOutput').innerHTML = '<p>${localize('webview.computing')}</p>';
        }

        document.getElementById('selectBefore').addEventListener('click', () => vscode.postMessage({ command: 'requestFile', target: 'before' }));
        document.getElementById('selectAfter').addEventListener('click', () => vscode.postMessage({ command: 'requestFile', target: 'after' }));

        document.getElementById('startDiff').addEventListener('click', triggerDiff);

        document.getElementById('clearAll').addEventListener('click', () => {
            beforePath = null;
            afterPath = null;
            beforeLabel = null;
            afterLabel = null;
            document.getElementById('diffOutput').innerHTML = '';
            updateUI();
        });

        slider.addEventListener('input', (e) => {
            sliderVal.textContent = parseFloat(e.target.value).toFixed(1);
        });

        slider.addEventListener('change', () => {
            if (beforePath && afterPath) {
                triggerDiff();
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'fileSelected') {
                updatePath(message.target, message.filePath, message.fileName);
            } else if (message.command === 'htmlReady') {
                if (message.diffId === undefined || message.diffId === currentDiffId) {
                    document.getElementById('diffOutput').innerHTML = message.html;
                }
            }
        });

        function handleDrop(e, target) {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.path && file.path.match(/\\.(md|markdown)$/i)) {
                    updatePath(target, file.path);
                }
            }
        }

        const beforeArea = document.getElementById('beforeName').parentElement;
        const afterArea = document.getElementById('afterName').parentElement;

        [beforeArea, afterArea].forEach((area, index) => {
            const target = index === 0 ? 'before' : 'after';
            area.addEventListener('dragover', (e) => { e.preventDefault(); area.style.opacity = '0.5'; });
            area.addEventListener('dragleave', (e) => { area.style.opacity = '1'; });
            area.addEventListener('drop', (e) => {
                area.style.opacity = '1';
                handleDrop(e, target);
            });
        });

        // Initialize UI with any injected values
        updateUI();
    </script>
</body>
</html>`;
    }
}
