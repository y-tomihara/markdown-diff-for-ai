import { describe, it, expect } from 'vitest';
import { calculateSimilarity, isSimilarEnough } from '../../src/engine/similarity';

describe('Similarity Evaluator', () => {
    it('should return 1.0 for identical strings', () => {
        expect(calculateSimilarity('hello world', 'hello world')).toBeCloseTo(1.0);
        expect(calculateSimilarity('こんにちは', 'こんにちは')).toBeCloseTo(1.0);
    });

    it('should return 0.0 for completely different strings', () => {
        expect(calculateSimilarity('hello', 'world')).toBeCloseTo(0.0);
    });

    it('should calculate partial similarity correctly', () => {
        const score = calculateSimilarity('hello world', 'hello there world');
        // before: ["hello", " ", "world"] (length 3)
        // after:  ["hello", " ", "there", " ", "world"] (length 5)
        // common: "hello", " ", "world" (count 3)
        // expected: 2 * 3 / 8 = 0.75
        expect(score).toBeCloseTo(0.75);
    });

    it('should determine if similarity is above threshold', () => {
        expect(isSimilarEnough('hello world', 'hello there world', 0.5)).toBe(true);
        expect(isSimilarEnough('hello world', 'entirely different text', 0.5)).toBe(false);
    });

    it('should handle empty strings', () => {
        expect(calculateSimilarity('', '')).toBeCloseTo(1.0);
        expect(calculateSimilarity('a', '')).toBeCloseTo(0.0);
        expect(calculateSimilarity('', 'b')).toBeCloseTo(0.0);
    });
});
