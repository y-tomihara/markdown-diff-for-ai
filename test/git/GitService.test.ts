import { describe, it, expect, vi } from 'vitest';
import { GitService } from '../../src/git/GitService';

vi.mock('child_process', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        exec: vi.fn((_cmd, _options, callback) => {
            if (typeof callback === 'function') {
                callback(null, Buffer.from('mock binary data'));
            }
        })
    };
});

import * as cp from 'child_process';

describe('GitService', () => {
    it('should fetch binary file content correctly', async () => {
        const gitService = new GitService();
        
        // Mock the execGitCommand to return a mock repo root
        gitService.execGitCommand = vi.fn().mockResolvedValue('/mock/repo/root');

        const buffer = await gitService.getFileContentBinary('/mock/repo/root/file.svg', 'HEAD', '/mock/repo/root');
        
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.toString()).toBe('mock binary data');
        expect(cp.exec).toHaveBeenCalledWith(
            'git show "HEAD:file.svg"',
            expect.objectContaining({ encoding: 'buffer' }),
            expect.any(Function)
        );
        
        vi.restoreAllMocks();
    });
});
