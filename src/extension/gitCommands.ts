import * as vscode from 'vscode';
import { GitService } from '../git/GitService';
import { GitHistoryProvider } from '../git/GitHistoryProvider';
import { MarkdownDiffPanel } from '../webview/MarkdownDiffPanel';
import * as path from 'path';

const gitService = new GitService();
const gitHistory = new GitHistoryProvider(gitService);

export async function compareWithHead(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    if (!uri) {
        vscode.window.showErrorMessage('Markdown Diff for AI: ファイルが選択されていません。');
        return;
    }
    await compareWithGitRef(context, uri, 'HEAD', 'Git: HEAD');
}

export async function compareWithPrevious(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    if (!uri) {
        vscode.window.showErrorMessage('Markdown Diff for AI: ファイルが選択されていません。');
        return;
    }
    const cwd = getWorkspaceFolder(uri);
    if (!cwd) return;
    
    if (!(await gitService.isGitRepository(cwd))) {
        vscode.window.showInformationMessage('Markdown Diff for AI: このファイルはGitリポジトリの管理下にありません。');
        return;
    }

    const previousCommit = await gitHistory.getPreviousChangeCommit(uri.fsPath, cwd);
    if (!previousCommit) {
        vscode.window.showInformationMessage('Markdown Diff for AI: 前の変更（コミット）が見つかりません。');
        return;
    }
    await compareWithGitRef(context, uri, previousCommit, `Git: ${previousCommit.substring(0, 7)}`);
}
export async function compareWithCommit(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    if (!uri) {
        vscode.window.showErrorMessage('Markdown Diff for AI: ファイルが選択されていません。');
        return;
    }
    const cwd = getWorkspaceFolder(uri);
    if (!cwd) return;
    if (!(await gitService.isGitRepository(cwd))) {
        vscode.window.showInformationMessage('Markdown Diff for AI: このファイルはGitリポジトリの管理下にありません。');
        return;
    }

    let commits;
    try {
        const config = vscode.workspace.getConfiguration('markdownDiffForAi');
        const limit = config.get<number>('commitHistoryLimit', 50);
        commits = await gitHistory.getCommitHistory(uri.fsPath, cwd, limit);
    } catch (e) {
        vscode.window.showErrorMessage(`Markdown Diff for AI: コミット履歴の取得に失敗しました: ${e}`);
        return;
    }

    if (commits.length === 0) {
        vscode.window.showInformationMessage('Markdown Diff for AI: コミット履歴が見つかりません。');
        return;
    }

    const items: vscode.QuickPickItem[] = commits.map(c => ({
        label: `$(git-commit) ${c.shortHash}`,
        description: `${c.author} - ${c.date}`,
        detail: c.message,
        commitHash: c.hash // Custom property
    } as vscode.QuickPickItem & { commitHash: string }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '比較対象のコミットを選択してください',
        matchOnDescription: true,
        matchOnDetail: true
    }) as (vscode.QuickPickItem & { commitHash: string }) | undefined;

    if (selected) {
        await compareWithGitRef(context, uri, selected.commitHash, `Git: ${selected.label.replace('$(git-commit) ', '')}`);
    }
}

export async function compareWithBranch(context: vscode.ExtensionContext, uri?: vscode.Uri) {
    if (!uri) {
        vscode.window.showErrorMessage('Markdown Diff for AI: ファイルが選択されていません。');
        return;
    }
    const cwd = getWorkspaceFolder(uri);
    if (!cwd) return;
    if (!(await gitService.isGitRepository(cwd))) {
        vscode.window.showInformationMessage('Markdown Diff for AI: このファイルはGitリポジトリの管理下にありません。');
        return;
    }

    const branches = await gitHistory.getLocalBranches(cwd);
    if (branches.length === 0) {
        vscode.window.showInformationMessage('Markdown Diff for AI: ブランチが見つかりません。');
        return;
    }

    const items: vscode.QuickPickItem[] = branches.map(b => ({
        label: `$(git-branch) ${b}`
    }));

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: '比較対象のブランチを選択してください'
    });

    if (selected) {
        const branchName = selected.label.replace('$(git-branch) ', '');
        await compareWithGitRef(context, uri, branchName, `Git: ${branchName}`);
    }
}
async function compareWithGitRef(context: vscode.ExtensionContext, uri: vscode.Uri, ref: string, label: string) {
    const cwd = getWorkspaceFolder(uri);
    if (!cwd) return;

    if (!(await gitService.isGitRepository(cwd))) {
        vscode.window.showInformationMessage('Markdown Diff for AI: このファイルはGitリポジトリの管理下にありません。');
        return;
    }

    try {
        const content = await gitService.getFileContent(uri.fsPath, ref, cwd);
        // We will pass the virtual path and content to MarkdownDiffPanel
        const virtualPath = `git:${ref}:${uri.fsPath}`;
        
        MarkdownDiffPanel.renderWithVirtual(context.extensionUri, uri, 'after', virtualPath, label, content);
    } catch (e) {
        vscode.window.showErrorMessage(`Markdown Diff for AI: Git情報の取得に失敗しました。 ${e}`);
    }
}

function getWorkspaceFolder(uri: vscode.Uri): string | undefined {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) {
        return folder.uri.fsPath;
    }
    return path.dirname(uri.fsPath);
}
