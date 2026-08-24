import { describe, it, expect } from 'vitest';
import { segmentText } from '../../src/engine/segmenter';

describe('Segmenter', () => {
    it('should segment Japanese text correctly', () => {
        const text = 'こんにちは、世界！';
        const segments = segmentText(text);
        
        // spaces/punctuation are filtered out
        expect(segments).toEqual(['こんにちは', '世界']);
    });

    it('should segment English text into words and punctuation', () => {
        const text = 'Hello, world!';
        const segments = segmentText(text, 'en');
        
        // spaces/punctuation are filtered out
        expect(segments).toEqual(['Hello', 'world']);
    });

    it('should segment mixed CJK and English text correctly', () => {
        const text = 'これはテスト test です。';
        const segments = segmentText(text);
        
        // spaces/punctuation are filtered out
        expect(segments).toEqual(['これ', 'は', 'テスト', 'test', 'です']);
    });

    it('should handle empty strings', () => {
        expect(segmentText('')).toEqual([]);
    });
});
