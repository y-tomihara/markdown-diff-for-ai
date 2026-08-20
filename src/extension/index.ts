import * as vscode from 'vscode';
import { MarkdownDiffPanel } from '../webview/MarkdownDiffPanel';
import * as gitCommands from './gitCommands';
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
    const disposable3 = vscode.commands.registerCommand('markdownDiffForAi.compareWithHead', (uri?: vscode.Uri) => {
        gitCommands.compareWithHead(context, uri);
    });
    const disposable4 = vscode.commands.registerCommand('markdownDiffForAi.compareWithPrevious', (uri?: vscode.Uri) => {
        gitCommands.compareWithPrevious(context, uri);
    });
    const disposable5 = vscode.commands.registerCommand('markdownDiffForAi.compareWithCommit', (uri?: vscode.Uri) => {
        gitCommands.compareWithCommit(context, uri);
    });
    const disposable6 = vscode.commands.registerCommand('markdownDiffForAi.compareWithBranch', (uri?: vscode.Uri) => {
        gitCommands.compareWithBranch(context, uri);
    });

    context.subscriptions.push(disposable1, disposable2, disposable3, disposable4, disposable5, disposable6);
}

export function deactivate() {}
