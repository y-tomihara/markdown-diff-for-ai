import { describe, it, expect } from 'vitest';
import { renderDiff } from '../../src/webview/renderer';
import type { BlockDiffResult } from '../../src/engine/diff';
import { parseMarkdown } from '../../src/engine/parser';

describe('Renderer', () => {
    it('should render unchanged blocks normally', async () => {
        const root = parseMarkdown('Hello **world**');
        const diffs: BlockDiffResult[] = [
            { type: 'unchanged', newNode: root.children[0] }
        ];
        
        const html = await renderDiff(diffs);
        expect(html).toContain('<p>Hello <strong>world</strong></p>');
    });

    it('should wrap added blocks with diff-added class', async () => {
        const root = parseMarkdown('New paragraph');
        const diffs: BlockDiffResult[] = [
            { type: 'added', newNode: root.children[0] }
        ];
        
        const html = await renderDiff(diffs);
        expect(html).toContain('class="diff-added');
        expect(html).toContain('<p>New paragraph</p>');
    });

    it('should sanitize dangerous HTML (REQ-012)', async () => {
        // 'javascript:' URL should be sanitized
        const root = parseMarkdown('[Evil Link](javascript:alert("xss"))');
        const diffs: BlockDiffResult[] = [
            { type: 'added', newNode: root.children[0] }
        ];
        
        const html = await renderDiff(diffs);
        expect(html).not.toContain('javascript:');
        expect(html).toContain('<a>Evil Link</a>'); // Sanitized output removes href
    });

    it('should preserve <ins>, <del>, and classes (REQ-012)', async () => {
        const diffs: BlockDiffResult[] = [
            {
                type: 'modified',
                inlineDiffs: [
                    { value: 'Hello ', added: false, removed: false },
                    { value: 'cruel ', added: false, removed: true },
                    { value: 'beautiful ', added: true, removed: false },
                    { value: 'world', added: false, removed: false }
                ]
            }
        ];
        
        const html = await renderDiff(diffs);
        expect(html).toContain('class="diff-modified');
        expect(html).toContain('<del class="diff-inline-removed">cruel </del>');
        expect(html).toContain('<ins class="diff-inline-added">beautiful </ins>');
    });

    it('should correctly parse and preserve markdown syntax in modified blocks', async () => {
        const diffResults: BlockDiffResult[] = [
            {
                type: 'modified',
                oldNode: { type: 'paragraph', children: [{ type: 'text', value: 'This is old text.' }] } as unknown as any,
                newNode: { type: 'paragraph', children: [{ type: 'text', value: 'This is **bold** text.' }] } as unknown as any,
                inlineDiffs: [
                    { value: 'This is ', added: undefined, removed: undefined },
                    { value: 'old', added: undefined, removed: true },
                    { value: '**bold**', added: true, removed: undefined },
                    { value: ' text.', added: undefined, removed: undefined }
                ]
            }
        ];

        const html = await renderDiff(diffResults);

        expect(html).toContain('class="diff-modified');
        expect(html).toContain('<del class="diff-inline-removed">old</del>');
        // The **bold** part should be wrapped in <ins> and then parsed into <strong> by remark
        expect(html).toContain('<ins class="diff-inline-added"><strong>bold</strong></ins>');
    });
});
