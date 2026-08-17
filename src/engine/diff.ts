import * as diff from 'diff';
import type { Root, Content } from 'mdast';
import { matchBlocks } from './block_matcher';
import { isSimilarEnough } from './similarity';
import { segmentText } from './segmenter';
import { visit } from 'unist-util-visit';

export type DiffType = 'unchanged' | 'added' | 'removed' | 'modified';

export interface SegmentDiff {
    value: string;
    added?: boolean;
    removed?: boolean;
}

export interface BlockDiffResult {
    type: DiffType;
    oldNode?: Content;
    newNode?: Content;
    inlineDiffs?: SegmentDiff[];
}

/**
 * Extracts raw text from an AST node.
 * This is a simplified extraction for similarity comparison.
 */
function extractText(node: any): string {
    if (node.type === 'image') {
        return `![${node.alt || ''}](${node.url || ''})`;
    }
    if (node.type === 'link') {
        return `[${node.children ? node.children.map(extractText).join('') : ''}](${node.url || ''})`;
    }
    if (node.type === 'strong') {
        return `**${node.children ? node.children.map(extractText).join('') : ''}**`;
    }
    if (node.type === 'emphasis') {
        return `*${node.children ? node.children.map(extractText).join('') : ''}*`;
    }
    if (node.type === 'inlineCode') {
        return `\`${node.value}\``;
    }
    if ('value' in node) {
        return node.value;
    }
    if ('children' in node && Array.isArray(node.children)) {
        return node.children.map(extractText).join('');
    }
    return '';
}

/**
 * Computes the fine-grained inline diff between two text strings using the segmenter.
 * For code blocks, it uses line-based diff instead of word-based segmentation (REQ-010).
 */
export function computeInlineDiff(oldNode: Content, newNode: Content, locale: string = 'ja'): SegmentDiff[] | undefined {
    // Synchronize image URLs if their original relative URLs match AND their hashes match.
    // This prevents absolute path differences (due to files being in different folders)
    // from generating inline diffs that break the markdown syntax.
    let hasModifiedImage = false;
    visit(oldNode, 'image', (oImg: any) => {
        visit(newNode, 'image', (nImg: any) => {
            if (oImg.originalUrl && oImg.originalUrl === nImg.originalUrl) {
                if (oImg.imageHash === nImg.imageHash) {
                    oImg.url = nImg.url; 
                } else {
                    hasModifiedImage = true;
                }
            }
        });
    });

    if (hasModifiedImage) {
        return undefined; // Skip inline diff, tell renderer to do a block-level replacement
    }

    const beforeText = extractText(oldNode);
    const afterText = extractText(newNode);

    if (oldNode.type === 'code' || newNode.type === 'code') {
        return diff.diffLines(beforeText, afterText).map(change => ({
            value: change.value,
            added: change.added,
            removed: change.removed
        }));
    }

    const beforeSegments = segmentText(beforeText, locale);
    const afterSegments = segmentText(afterText, locale);
    
    return diff.diffArrays(beforeSegments, afterSegments).map(change => ({
        value: change.value.join(''),
        added: change.added,
        removed: change.removed
    }));
}

const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Computes a fine-grained diff asynchronously to prevent blocking the event loop.
 * Yields control to the event loop every `yieldInterval` blocks.
 */
export async function computeFineGrainedDiffAsync(
    beforeAst: Root, 
    afterAst: Root, 
    similarityThreshold: number = 0.3,
    yieldInterval: number = 50
): Promise<BlockDiffResult[]> {
    const exactBlocks = matchBlocks(beforeAst, afterAst);
    const results: BlockDiffResult[] = [];

    for (let i = 0; i < exactBlocks.length; i++) {
        if (i > 0 && i % yieldInterval === 0) {
            await yieldToEventLoop();
        }

        const current = exactBlocks[i];

        if (current.status === 'unchanged') {
            results.push({ type: 'unchanged', oldNode: current.node, newNode: current.node });
            continue;
        }

        if (current.status === 'removed') {
            if (i + 1 < exactBlocks.length && exactBlocks[i + 1].status === 'added') {
                const next = exactBlocks[i + 1];
                const oldText = extractText(current.node);
                const newText = extractText(next.node);

                if (isSimilarEnough(oldText, newText, similarityThreshold)) {
                    results.push({
                        type: 'modified',
                        oldNode: current.node,
                        newNode: next.node,
                        inlineDiffs: computeInlineDiff(current.node, next.node)
                    });
                    i++; 
                    continue;
                }
            }
            results.push({ type: 'removed', oldNode: current.node });
            continue;
        }

        if (current.status === 'added') {
            results.push({ type: 'added', newNode: current.node });
        }
    }

    return results;
}

/**
 * Computes a fine-grained diff combining block-level exact matches and 
 * inline text diffs for similar blocks.
 */
export function computeFineGrainedDiff(beforeAst: Root, afterAst: Root, similarityThreshold: number = 0.3): BlockDiffResult[] {
    const exactBlocks = matchBlocks(beforeAst, afterAst);
    const results: BlockDiffResult[] = [];

    // Group adjacent removed and added blocks to check for modifications
    for (let i = 0; i < exactBlocks.length; i++) {
        const current = exactBlocks[i];

        if (current.status === 'unchanged') {
            results.push({ type: 'unchanged', oldNode: current.node, newNode: current.node });
            continue;
        }

        if (current.status === 'removed') {
            // Check if the next block is 'added' to pair them up
            if (i + 1 < exactBlocks.length && exactBlocks[i + 1].status === 'added') {
                const next = exactBlocks[i + 1];
                const oldText = extractText(current.node);
                const newText = extractText(next.node);

                if (isSimilarEnough(oldText, newText, similarityThreshold)) {
                    // It's a modification
                    results.push({
                        type: 'modified',
                        oldNode: current.node,
                        newNode: next.node,
                        inlineDiffs: computeInlineDiff(current.node, next.node)
                    });
                    i++; // skip the 'added' block since we consumed it
                    continue;
                }
            }
            // Not paired or not similar enough
            results.push({ type: 'removed', oldNode: current.node });
            continue;
        }

        if (current.status === 'added') {
            results.push({ type: 'added', newNode: current.node });
        }
    }

    return results;
}
