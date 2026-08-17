import * as vscode from 'vscode';
import { MarkdownDiffPanel } from '../webview/MarkdownDiffPanel';
import { initI18n } from './i18n';

export function activate(context: vscode.ExtensionContext) {
    console.log('Markdown Diff for AI is now active.');

    initI18n(context.extensionPath, vscode.env.language);

    // Register the commands defined in package.json
    const disposable1 = vscode.commands.registerCommand('markdownDiffForAi.selectAsAfter', (uri?: vscode.Uri) => {
        MarkdownDiffPanel.render(context.extensionUri, uri, 'after');
    });
    const disposable2 = vscode.commands.registerCommand('markdownDiffForAi.selectAsBefore', (uri?: vscode.Uri) => {
        MarkdownDiffPanel.render(context.extensionUri, uri, 'before');
    });

    context.subscriptions.push(disposable1, disposable2);
}

export function deactivate() {}
