import { describe, it, expect } from 'vitest';
import { matchBlocks } from '../../src/engine/block_matcher';
import { parseMarkdown } from '../../src/engine/parser';

describe('Block Matcher', () => {
    it('should identify unchanged blocks', () => {
        const before = parseMarkdown('# Title\n\nParagraph 1');
        const after = parseMarkdown('# Title\n\nParagraph 1');
        
        const result = matchBlocks(before, after);
        
        expect(result.length).toBe(2);
        expect(result[0].status).toBe('unchanged');
        expect(result[0].node.type).toBe('heading');
        expect(result[1].status).toBe('unchanged');
        expect(result[1].node.type).toBe('paragraph');
    });

    it('should identify added blocks', () => {
        const before = parseMarkdown('# Title');
        const after = parseMarkdown('# Title\n\nParagraph 1');
        
        const result = matchBlocks(before, after);
        
        expect(result.length).toBe(2);
        expect(result[0].status).toBe('unchanged');
        expect(result[1].status).toBe('added');
        expect(result[1].node.type).toBe('paragraph');
    });

    it('should identify removed blocks', () => {
        const before = parseMarkdown('# Title\n\nParagraph 1');
        const after = parseMarkdown('Paragraph 1');
        
        const result = matchBlocks(before, after);
        
        expect(result.length).toBe(2);
        expect(result[0].status).toBe('removed');
        expect(result[0].node.type).toBe('heading');
        expect(result[1].status).toBe('unchanged');
        expect(result[1].node.type).toBe('paragraph');
    });

    it('should ignore position differences in unchanged blocks', () => {
        // Here, the number of newlines differs, but the actual block content is identical.
        // remark-parse will generate different 'position' data for Paragraph 1 because of the extra newlines.
        const before = parseMarkdown('# Title\n\nParagraph 1');
        const after = parseMarkdown('# Title\n\n\n\nParagraph 1');
        
        const result = matchBlocks(before, after);
        
        expect(result.length).toBe(2);
        expect(result.every(r => r.status === 'unchanged')).toBe(true);
    });
});
