import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/engine/parser';
import { visit } from 'unist-util-visit';

describe('Markdown Parser', () => {
    it('should correctly parse a simple markdown string to an AST', () => {
        const markdown = '# Hello World\n\nThis is a test.';
        const ast = parseMarkdown(markdown);
        
        expect(ast.type).toBe('root');
        expect(ast.children.length).toBe(2);
        
        expect(ast.children[0].type).toBe('heading');
        expect(ast.children[1].type).toBe('paragraph');
    });

    it('should correctly parse GFM tables', () => {
        const markdown = '| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |';
        const ast = parseMarkdown(markdown);
        
        expect(ast.type).toBe('root');
        expect(ast.children.length).toBe(1);
        expect(ast.children[0].type).toBe('table');
    });

    it('should rewrite image URLs if a rewriteImageUrl callback is provided', () => {
        const markdown = `
# Title
![alt1](http://example.com/image.png)
![alt2](local_image.svg)
![alt3](./assets/local_image.svg)
        `;

        const resolveImage = (url: string, node: any) => {
            node.originalUrl = url;
            if (url.startsWith('http')) {
                node.url = url;
            } else {
                node.url = `vscode-webview-resource://dummy/${url}`;
            }
        };

        const ast = parseMarkdown(markdown, resolveImage);
        
        let imagesFound = 0;
        visit(ast, 'image', (node: any) => {
            if (imagesFound === 0) {
                expect(node.url).toBe('http://example.com/image.png');
            } else if (imagesFound === 1) {
                expect(node.url).toBe('vscode-webview-resource://dummy/local_image.svg');
            } else if (imagesFound === 2) {
                expect(node.url).toBe('vscode-webview-resource://dummy/./assets/local_image.svg');
            }
            imagesFound++;
        });

        expect(imagesFound).toBe(3);
    });

    it('should ignore Byte Order Mark (BOM) when parsing', () => {
        const contentWithoutBOM = '# Title';
        const contentWithBOM = '\uFEFF# Title';

        const astWithoutBOM = parseMarkdown(contentWithoutBOM);
        const astWithBOM = parseMarkdown(contentWithBOM);

        // 両者のASTが完全に一致することを確認
        expect(astWithoutBOM).toEqual(astWithBOM);
    });

    it('should ignore CRLF line endings and treat them as LF', () => {
        const contentWithLF = '# Title\n\nParagraph 1\nParagraph 2';
        const contentWithCRLF = '# Title\r\n\r\nParagraph 1\r\nParagraph 2';

        const astWithLF = parseMarkdown(contentWithLF);
        const astWithCRLF = parseMarkdown(contentWithCRLF);

        // 改行コードの違いが無視され、完全に一致することを確認
        expect(astWithLF).toEqual(astWithCRLF);
    });
});
