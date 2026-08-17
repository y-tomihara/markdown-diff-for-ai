import { describe, it, expect } from 'vitest';
import { segmentText } from '../../src/engine/segmenter';

describe('Segmenter', () => {
    it('should segment Japanese text correctly', () => {
        const text = 'こんにちは、世界！';
        const segments = segmentText(text);
        
        // Expected segmentation might vary slightly by JS engine, but generally:
        // 'こんにちは', '、', '世界', '！'
        expect(segments.length).toBeGreaterThan(1);
        expect(segments.join('')).toBe(text);
    });

    it('should segment English text into words and punctuation', () => {
        const text = 'Hello, world!';
        const segments = segmentText(text, 'en');
        
        expect(segments).toEqual(['Hello', ',', ' ', 'world', '!']);
        expect(segments.join('')).toBe(text);
    });

    it('should segment mixed CJK and English text correctly', () => {
        const text = 'これはテスト test です。';
        const segments = segmentText(text);
        
        expect(segments.join('')).toBe(text);
        expect(segments).toContain('test');
        expect(segments).toContain(' ');
        expect(segments).toContain('です');
    });

    it('should handle empty strings', () => {
        expect(segmentText('')).toEqual([]);
    });
});
