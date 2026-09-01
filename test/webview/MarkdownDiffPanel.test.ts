import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('MarkdownDiffPanel', () => {
    it('should include text-decoration: none for diff-image-old and diff-image-new in CSS', () => {
        const panelPath = path.resolve(__dirname, '../../src/webview/MarkdownDiffPanel.ts');
        const code = fs.readFileSync(panelPath, 'utf8');
        
        // Simple regex to check if CSS rules are present
        const oldRegex = /\.diff-image-old\s*\{[^}]*text-decoration:\s*none;[^}]*\}/;
        const newRegex = /\.diff-image-new\s*\{[^}]*text-decoration:\s*none;[^}]*\}/;
        
        expect(oldRegex.test(code)).toBe(true);
        expect(newRegex.test(code)).toBe(true);
    });
});
