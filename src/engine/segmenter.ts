/**
 * Tokenizes a string into individual segments (words/characters) using Intl.Segmenter.
 * Uses the 'word' granularity to break text down appropriately.
 * Note: Intl.Segmenter automatically handles word boundaries for English and
 * character/word boundaries for CJK (Chinese, Japanese, Korean) text based on locale or auto-detection.
 * 
 * @param text The string to tokenize
 * @param locale The locale to use for segmentation. Defaults to 'ja' (Japanese) 
 *               which generally works well for mixed CJK and English text.
 * @returns Array of segmented strings
 */
export function segmentText(text: string, locale: string = 'ja'): string[] {
    if (!text) {
        return [];
    }
    
    const segmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    const segments = Array.from(segmenter.segment(text));
    
    return segments.map(segment => segment.segment);
}
