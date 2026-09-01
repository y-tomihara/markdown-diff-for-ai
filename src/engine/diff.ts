import * as diff from 'diff';
import type { Root, Content } from 'mdast';
import { matchBlocks } from './block_matcher';
import { calculateSimilarity, isSimilarEnough } from './similarity';
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

    const beforeSegments = segmentText(beforeText, locale, false);
    const afterSegments = segmentText(afterText, locale, false);
    
    return diff.diffArrays(beforeSegments, afterSegments).map(change => ({
        value: change.value.join(''),
        added: change.added,
        removed: change.removed
    }));
}

const yieldToEventLoop = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Helper to process a chunk of removed and added nodes recursively using Divide and Conquer.
 * This preserves the relative document order for unmatched nodes around the matched anchor pairs.
 */
function processDiffChunk(removed: any[], added: any[], threshold: number): BlockDiffResult[] {
    const results: BlockDiffResult[] = [];
    const consumedAdded = new Set<number>();

    for (let r = 0; r < removed.length; r++) {
        let bestSim = -1;
        let bestA = -1;

        const oldText = extractText(removed[r]);
        for (let a = 0; a < added.length; a++) {
            if (consumedAdded.has(a)) continue;

            const newText = extractText(added[a]);
            const sim = isSimilarEnough(oldText, newText, 0) ? calculateSimilarity(oldText, newText) : -1;
            
            if (sim >= threshold && sim > bestSim) {
                bestSim = sim;
                bestA = a;
            }
        }

        if (bestSim !== -1) {
            // Flush any unmatched added blocks appearing before the matched one
            for (let a = 0; a < bestA; a++) {
                if (!consumedAdded.has(a)) {
                    results.push({ type: 'added', newNode: added[a] });
                    consumedAdded.add(a);
                }
            }

            results.push({
                type: 'modified',
                oldNode: removed[r],
                newNode: added[bestA],
                inlineDiffs: computeInlineDiff(removed[r], added[bestA])
            });
            consumedAdded.add(bestA);
        } else {
            results.push({ type: 'removed', oldNode: removed[r] });
        }
    }

    // Flush any remaining unmatched added blocks
    for (let a = 0; a < added.length; a++) {
        if (!consumedAdded.has(a)) {
            results.push({ type: 'added', newNode: added[a] });
            consumedAdded.add(a);
        }
    }

    return results;
}

/**
 * Async version of processDiffChunk that yields to the event loop occasionally.
 */
async function processDiffChunkAsync(removed: any[], added: any[], threshold: number, yieldCount: { count: number, limit: number }): Promise<BlockDiffResult[]> {
    const results: BlockDiffResult[] = [];
    const consumedAdded = new Set<number>();

    for (let r = 0; r < removed.length; r++) {
        if (yieldCount.count++ > yieldCount.limit) {
            await yieldToEventLoop();
            yieldCount.count = 0;
        }

        let bestSim = -1;
        let bestA = -1;

        const oldText = extractText(removed[r]);
        for (let a = 0; a < added.length; a++) {
            if (consumedAdded.has(a)) continue;

            const newText = extractText(added[a]);
            const sim = isSimilarEnough(oldText, newText, 0) ? calculateSimilarity(oldText, newText) : -1;
            
            if (sim >= threshold && sim > bestSim) {
                bestSim = sim;
                bestA = a;
            }
        }

        if (bestSim !== -1) {
            // Flush any unmatched added blocks appearing before the matched one
            for (let a = 0; a < bestA; a++) {
                if (!consumedAdded.has(a)) {
                    results.push({ type: 'added', newNode: added[a] });
                    consumedAdded.add(a);
                }
            }

            results.push({
                type: 'modified',
                oldNode: removed[r],
                newNode: added[bestA],
                inlineDiffs: computeInlineDiff(removed[r], added[bestA])
            });
            consumedAdded.add(bestA);
        } else {
            results.push({ type: 'removed', oldNode: removed[r] });
        }
    }

    // Flush any remaining unmatched added blocks
    for (let a = 0; a < added.length; a++) {
        if (!consumedAdded.has(a)) {
            results.push({ type: 'added', newNode: added[a] });
            consumedAdded.add(a);
        }
    }

    return results;
}

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
    const yieldCount = { count: 0, limit: yieldInterval };

    let i = 0;
    while (i < exactBlocks.length) {
        if (yieldCount.count++ > yieldCount.limit) {
            await yieldToEventLoop();
            yieldCount.count = 0;
        }

        const current = exactBlocks[i] as any;
        if (current.status === 'unchanged') {
            results.push({ type: 'unchanged', oldNode: current.node, newNode: current.node });
            i++;
            continue;
        }

        const removedChunk: any[] = [];
        const addedChunk: any[] = [];
        while (i < exactBlocks.length && exactBlocks[i].status !== 'unchanged') {
            if (exactBlocks[i].status === 'removed') {
                removedChunk.push(exactBlocks[i].node);
            } else if (exactBlocks[i].status === 'added') {
                addedChunk.push(exactBlocks[i].node);
            }
            i++;
        }

        const chunkResults = await processDiffChunkAsync(removedChunk, addedChunk, similarityThreshold, yieldCount);
        results.push(...chunkResults);
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

    let i = 0;
    while (i < exactBlocks.length) {
        const current = exactBlocks[i] as any;
        if (current.status === 'unchanged') {
            results.push({ type: 'unchanged', oldNode: current.node, newNode: current.node });
            i++;
            continue;
        }

        const removedChunk: any[] = [];
        const addedChunk: any[] = [];
        while (i < exactBlocks.length && exactBlocks[i].status !== 'unchanged') {
            if (exactBlocks[i].status === 'removed') {
                removedChunk.push(exactBlocks[i].node);
            } else if (exactBlocks[i].status === 'added') {
                addedChunk.push(exactBlocks[i].node);
            }
            i++;
        }

        results.push(...processDiffChunk(removedChunk, addedChunk, similarityThreshold));
    }

    return results;
}
