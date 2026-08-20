import { GitService } from './GitService';


export interface CommitInfo {
    hash: string;
    shortHash: string;
    message: string;
    date: string;
    author: string;
}

export class GitHistoryProvider {
    constructor(private gitService: GitService) {}



    /**
     * Retrieves the commit hash of the immediately preceding modification to the file.
     * @param absolutePath Absolute path of the file
     * @param cwd Working directory (usually workspace folder)
     */
    public async getPreviousChangeCommit(absolutePath: string, cwd: string): Promise<string | null> {
        const gitPath = absolutePath.replace(/\\/g, '/');
        try {
            // Get the last 2 commits that modified the file
            const output = await this.gitService.execGitCommand(['log', '-n', '2', '--format="%H"', '--', `"${gitPath}"`], cwd);
            const hashes = output.split('\n').map(h => h.replace(/"/g, '').trim()).filter(h => h.length > 0);
            
            if (hashes.length >= 2) {
                return hashes[1]; // The second one is the previous change
            } else if (hashes.length === 1) {
                // If there's only 1 commit, there is no "previous" change
                return null;
            }
            return null;
        } catch (e) {
            console.error("Error getting previous commit:", e);
            return null;
        }
    }

    /**
     * Retrieves the commit history for a specific file.
     */
    public async getCommitHistory(absolutePath: string, cwd: string, limit = 50): Promise<CommitInfo[]> {
        const gitPath = absolutePath.replace(/\\/g, '/');
        try {
            // Format: hash|short_hash|date|author|message
            const format = '%H|%h|%cd|%an|%s';
            const output = await this.gitService.execGitCommand(['log', '-n', limit.toString(), `--format="${format}"`, '--date=short', '--', `"${gitPath}"`], cwd);
            
            if (!output) return [];

            return output.split('\n').filter(line => line.trim().length > 0).map(line => {
                const parts = line.split('|');
                return {
                    hash: parts[0] || '',
                    shortHash: parts[1] || '',
                    date: parts[2] || '',
                    author: parts[3] || '',
                    message: parts.slice(4).join('|') || '' // In case message contains |
                };
            });
        } catch (e) {
            console.error("Error getting commit history:", e);
            throw e;
        }
    }

    /**
     * Retrieves a list of local branches.
     */
    public async getLocalBranches(cwd: string): Promise<string[]> {
        try {
            const output = await this.gitService.execGitCommand(['branch', '--format="%(refname:short)"'], cwd);
            return output.split('\n').map(b => b.replace(/"/g, '').trim()).filter(b => b.length > 0);
        } catch (e) {
            console.error("Error getting local branches:", e);
            return [];
        }
    }
}
