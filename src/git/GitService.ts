import * as cp from 'child_process';
import * as util from 'util';
import * as path from 'path';

const exec = util.promisify(cp.exec);

export class GitService {
    /**
     * Executes a git command in the specified directory.
     * @param args The arguments to pass to git.
     * @param cwd The working directory.
     * @returns The stdout of the command.
     */
    public async execGitCommand(args: string[], cwd: string): Promise<string> {
        try {
            const command = `git ${args.join(' ')}`;
            const { stdout } = await exec(command, { cwd, maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer for large histories/files
            return stdout.trim();
        } catch (error) {
            throw new Error(`Git command failed: git ${args.join(' ')}\nError: ${error}`);
        }
    }

    /**
     * Checks if the directory is inside a git repository.
     */
    public async isGitRepository(cwd: string): Promise<boolean> {
        try {
            await this.execGitCommand(['rev-parse', '--is-inside-work-tree'], cwd);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Retrieves the content of a file at a specific git ref (e.g., HEAD, commit hash, branch name).
     */
    public async getFileContent(filePath: string, ref: string, cwd: string): Promise<string> {
        // First get the repository root
        const repoRoot = await this.execGitCommand(['rev-parse', '--show-toplevel'], cwd);
        
        // Convert to relative path from repo root
        // path.relative handles different slash formats nicely
        let relativePath = path.relative(repoRoot.trim(), filePath);
        
        // Git paths must always use forward slashes
        relativePath = relativePath.replace(/\\/g, '/');

        return this.execGitCommand(['show', `"${ref}:${relativePath}"`], cwd);
    }

    /**
     * Retrieves the binary content of a file at a specific git ref.
     */
    public async getFileContentBinary(filePath: string, ref: string, cwd: string): Promise<Buffer> {
        const repoRoot = await this.execGitCommand(['rev-parse', '--show-toplevel'], cwd);
        let relativePath = path.relative(repoRoot.trim(), filePath).replace(/\\/g, '/');
        
        return new Promise((resolve, reject) => {
            cp.exec(`git show "${ref}:${relativePath}"`, { cwd, maxBuffer: 1024 * 1024 * 10, encoding: 'buffer' }, (error, stdout) => {
                if (error) reject(error);
                else resolve(stdout);
            });
        });
    }
}
