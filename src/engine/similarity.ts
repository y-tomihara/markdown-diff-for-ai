import * as diff from 'diff';
import { segmentText } from './segmenter';

/**
 * Evaluates the similarity between two strings based on segmented tokens.
 * Calculates the Sørensen–Dice coefficient equivalent based on matching segments.
 * 
 * @param before The original text
 * @param after The modified text
 * @param locale The locale for segmentation (default: 'ja')
 * @returns Similarity score between 0.0 and 1.0
 */
export function calculateSimilarity(before: string, after: string, locale: string = 'ja'): number {
    if (!before && !after) {
        return 1.0;
    }
    if (!before || !after) {
        return 0.0;
    }

    const beforeSegments = segmentText(before, locale);
    const afterSegments = segmentText(after, locale);

    const changes = diff.diffArrays(beforeSegments, afterSegments);
    
    let commonSegmentsCount = 0;
    for (const change of changes) {
        if (!change.added && !change.removed) {
            commonSegmentsCount += change.value.length;
        }
    }

    const totalSegmentsCount = beforeSegments.length + afterSegments.length;
    
    if (totalSegmentsCount === 0) {
        return 1.0;
    }

    // Sørensen–Dice coefficient
    return (2.0 * commonSegmentsCount) / totalSegmentsCount;
}

/**
 * Determines if two strings are similar enough to be considered a modification
 * rather than a completely new block.
 * 
 * @param before Original text
 * @param after Modified text
 * @param threshold Minimum similarity score (default 0.3)
 * @returns Boolean indicating if similarity meets the threshold
 */
export function isSimilarEnough(before: string, after: string, threshold: number = 0.3): boolean {
    return calculateSimilarity(before, after) >= threshold;
}
