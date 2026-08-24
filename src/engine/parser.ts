import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

/**
 * Parses a markdown string into an AST (mdast Root node).
 * @param markdown The raw markdown content.
 * @param resolveImage Optional callback to modify image nodes (e.g. resolve URLs and compute hashes).
 * @returns The parsed mdast Root object.
 */
export function parseMarkdown(content: string, resolveImage?: (url: string, node: any) => void): Root {
    // Strip BOM (Byte Order Mark) if present
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }

    // Normalize CRLF to LF to prevent diffs caused by line endings
    content = content.replace(/\r\n/g, '\n');

    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm);
    
    // Parse the markdown string into a syntax tree
    const ast = processor.parse(content) as Root;

    // Resolve local image paths if callback is provided
    if (resolveImage) {
        visit(ast, 'image', (node: any) => {
            if (node.url) {
                resolveImage(node.url, node);
            }
        });
    }

    return ast;
}
