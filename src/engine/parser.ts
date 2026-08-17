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
export function parseMarkdown(markdown: string, resolveImage?: (url: string, node: any) => void): Root {
    const processor = unified()
        .use(remarkParse)
        .use(remarkGfm);
    
    // Parse the markdown string into a syntax tree
    const ast = processor.parse(markdown) as Root;

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
