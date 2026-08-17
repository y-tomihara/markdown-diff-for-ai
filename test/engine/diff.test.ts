import { describe, it, expect } from 'vitest';
import { computeFineGrainedDiff, computeFineGrainedDiffAsync, computeInlineDiff } from '../../src/engine/diff';
import { parseMarkdown } from '../../src/engine/parser';

describe('Fine-grained Diff', () => {
    it('should calculate inline diffs for changed text inside same block type', () => {
        const before = parseMarkdown('some old text').children[0];
        const after = parseMarkdown('some new text').children[0];
        
        const inline = computeInlineDiff(before, after, 'en');
        expect(inline).toBeDefined();
        
        if (inline) {
            const removed = inline.find(d => d.removed);
            const added = inline.find(d => d.added);
            
            expect(removed).toBeDefined();
            expect(added).toBeDefined();
            expect(removed?.value).toContain('old');
            expect(added?.value).toContain('new');
        }
    });

    it('should identify a modified block with inline diffs when similarity is high', () => {
        const before = parseMarkdown('This is a test document.');
        const after = parseMarkdown('This is an awesome test document.');
        
        const results = computeFineGrainedDiff(before, after, 0.3);
        
        expect(results.length).toBe(1);
        expect(results[0].type).toBe('modified');
        expect(results[0].inlineDiffs).toBeDefined();
        if (results[0].inlineDiffs) {
            expect(results[0].inlineDiffs.length).toBeGreaterThan(0);
            expect(results[0].inlineDiffs.some(diff => diff.added && diff.value.includes('awesome'))).toBe(true);
        }
    });

    it('should treat completely different blocks as removed and added', () => {
        const before = parseMarkdown('Short text');
        const after = parseMarkdown('Completely different lengthy paragraph that has nothing in common with the previous one.');
        
        // Use a high threshold to ensure they don't match
        const results = computeFineGrainedDiff(before, after, 0.5);
        
        expect(results.length).toBe(2);
        expect(results[0].type).toBe('removed');
        expect(results[1].type).toBe('added');
    });

    it('should keep exactly matching blocks as unchanged', () => {
        const before = parseMarkdown('# Heading\n\nParagraph');
        const after = parseMarkdown('# Heading\n\nParagraph');
        
        const results = computeFineGrainedDiff(before, after);
        expect(results.length).toBe(2);
        expect(results[0].type).toBe('unchanged');
        expect(results[1].type).toBe('unchanged');
    });

    it('should use line-based diff for code blocks (REQ-010)', () => {
        const before = parseMarkdown('```typescript\nconst a = 1;\nconst b = 2;\n```');
        const after = parseMarkdown('```typescript\nconst a = 1;\nconst c = 3;\nconst b = 2;\n```');
        
        const results = computeFineGrainedDiff(before, after, 0.3);
        
        expect(results.length).toBe(1);
        expect(results[0].type).toBe('modified');
        expect(results[0].inlineDiffs).toBeDefined();
        
        const inline = results[0].inlineDiffs!;
        // Expected: unchanged "const a = 1;\n", added "const c = 3;\n", unchanged "const b = 2;\n"
        const addedLine = inline.find(diff => diff.added);
        expect(addedLine).toBeDefined();
        expect(addedLine?.value).toBe('const c = 3;\n');
    });

    it('should yield to event loop during async processing (REQ-011)', async () => {
        // Generate a large number of blocks
        const beforeText = Array.from({ length: 100 }, (_, i) => `Paragraph ${i}`).join('\n\n');
        const afterText = Array.from({ length: 100 }, (_, i) => `Paragraph ${i} changed`).join('\n\n');
        
        const before = parseMarkdown(beforeText);
        const after = parseMarkdown(afterText);
        
        let parallelTaskExecuted = false;
        
        // Schedule a task in the event loop
        setTimeout(() => {
            parallelTaskExecuted = true;
        }, 0);
        
        // Run diff with yieldInterval = 10 so it yields multiple times
        await computeFineGrainedDiffAsync(before, after, 0.3, 10);
        
        // If it yielded correctly, the parallel task should have executed
        expect(parallelTaskExecuted).toBe(true);
    });
});
