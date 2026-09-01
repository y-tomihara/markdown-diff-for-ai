import { describe, it, expect } from 'vitest';
import { computeNormalizedImageHash } from '../../src/engine/hash';

describe('hash util', () => {
    it('should compute identical hash for SVGs with different line endings', () => {
        const svgCRLF = Buffer.from('<svg>\r\n<text>test</text>\r\n</svg>');
        const svgLF = Buffer.from('<svg>\n<text>test</text>\n</svg>');
        
        const hashCRLF = computeNormalizedImageHash(svgCRLF, '.svg');
        const hashLF = computeNormalizedImageHash(svgLF, '.svg');
        
        expect(hashCRLF).toBe(hashLF);
    });

    it('should compute identical hash for uppercase SVG extension', () => {
        const svgCRLF = Buffer.from('<svg>\r\n<text>test</text>\r\n</svg>');
        const svgLF = Buffer.from('<svg>\n<text>test</text>\n</svg>');
        
        const hashCRLF = computeNormalizedImageHash(svgCRLF, '.SVG');
        const hashLF = computeNormalizedImageHash(svgLF, '.SVG');
        
        expect(hashCRLF).toBe(hashLF);
    });

    it('should compute different hash for PNGs with different binaries', () => {
        const png1 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        const png2 = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0A, 0x0A, 0x1A, 0x0A]); // simulated CRLF -> LF corruption
        
        const hash1 = computeNormalizedImageHash(png1, '.png');
        const hash2 = computeNormalizedImageHash(png2, '.png');
        
        expect(hash1).not.toBe(hash2);
    });
});
