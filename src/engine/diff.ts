import * as diff from 'diff';
import type { Root, Content } from 'mdast';
import { matchBlocks, matchNodes } from './block_matcher';
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
    mergedNode?: Content;
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

            let mergedNode: Content | undefined = undefined;
            if (removed[r].type === 'table' && added[bestA].type === 'table') {
                mergedNode = computeTableDiff(removed[r], added[bestA], threshold);
            }

            results.push({
                type: 'modified',
                oldNode: removed[r],
                newNode: added[bestA],
                inlineDiffs: computeInlineDiff(removed[r], added[bestA]),
                mergedNode
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
 * Deeply compares two table AST nodes and returns a merged table AST node 
 * containing inline diffs and class properties for styling.
 */
function computeTableDiff(oldTable: any, newTable: any, threshold: number): any {
    const mergedTable = { ...newTable, children: [] };
    const rowDiffs = matchNodes(oldTable.children || [], newTable.children || []);
    
    let i = 0;
    while (i < rowDiffs.length) {
        const current = rowDiffs[i] as any;
        if (current.status === 'unchanged') {
            mergedTable.children.push(current.node);
            i++;
            continue;
        }

        const removedRows: any[] = [];
        const addedRows: any[] = [];
        while (i < rowDiffs.length && rowDiffs[i].status !== 'unchanged') {
            if (rowDiffs[i].status === 'removed') {
                removedRows.push(rowDiffs[i].node);
            } else if (rowDiffs[i].status === 'added') {
                addedRows.push(rowDiffs[i].node);
            }
            i++;
        }

        const consumedAdded = new Set<number>();
        for (let r = 0; r < removedRows.length; r++) {
            let bestSim = -1;
            let bestA = -1;
            const oldText = extractText(removedRows[r]);
            for (let a = 0; a < addedRows.length; a++) {
                if (consumedAdded.has(a)) continue;
                const newText = extractText(addedRows[a]);
                const sim = isSimilarEnough(oldText, newText, 0) ? calculateSimilarity(oldText, newText) : -1;
                if (sim >= threshold && sim > bestSim) {
                    bestSim = sim;
                    bestA = a;
                }
            }
            
            if (bestSim !== -1) {
                // flush unmatched added
                for (let a = 0; a < bestA; a++) {
                    if (!consumedAdded.has(a)) {
                        const addedRow = JSON.parse(JSON.stringify(addedRows[a]));
                        addedRow.data = { ...addedRow.data, hProperties: { ...(addedRow.data?.hProperties || {}), className: ['diff-added'] } };
                        mergedTable.children.push(addedRow);
                        consumedAdded.add(a);
                    }
                }
                
                // merge matched row
                const mergedRow = computeTableRowDiff(removedRows[r], addedRows[bestA]);
                mergedTable.children.push(mergedRow);
                consumedAdded.add(bestA);
            } else {
                // unmatched removed
                const removedRow = JSON.parse(JSON.stringify(removedRows[r]));
                removedRow.data = { ...removedRow.data, hProperties: { ...(removedRow.data?.hProperties || {}), className: ['diff-removed'] } };
                mergedTable.children.push(removedRow);
            }
        }
        
        // flush remaining added
        for (let a = 0; a < addedRows.length; a++) {
            if (!consumedAdded.has(a)) {
                const addedRow = JSON.parse(JSON.stringify(addedRows[a]));
                addedRow.data = { ...addedRow.data, hProperties: { ...(addedRow.data?.hProperties || {}), className: ['diff-added'] } };
                mergedTable.children.push(addedRow);
                consumedAdded.add(a);
            }
        }
    }
    
    return mergedTable;
}

function computeTableRowDiff(oldRow: any, newRow: any): any {
    const mergedRow = { ...newRow, children: [] };
    const maxCells = Math.max(oldRow.children?.length || 0, newRow.children?.length || 0);
    
    for (let i = 0; i < maxCells; i++) {
        const oldCell = oldRow.children?.[i];
        const newCell = newRow.children?.[i];
        
        if (oldCell && newCell) {
            const mergedCell = { ...newCell, children: [] };
            const inlineDiffs = computeInlineDiff(oldCell, newCell);
            if (inlineDiffs) {
                // Instead of re-parsing, we map SegmentDiff[] directly into html and text nodes.
                // Note: inline markdown inside the segments might not be parsed if we wrap in html,
                // but extractText preserves the text. The easiest way without unified here is to 
                // just push html tags. 
                for (const d of inlineDiffs) {
                    if (d.added) {
                        mergedCell.children.push({ type: 'html', value: '<ins class="diff-inline-added">' });
                        mergedCell.children.push({ type: 'text', value: d.value });
                        mergedCell.children.push({ type: 'html', value: '</ins>' });
                    } else if (d.removed) {
                        mergedCell.children.push({ type: 'html', value: '<del class="diff-inline-removed">' });
                        mergedCell.children.push({ type: 'text', value: d.value });
                        mergedCell.children.push({ type: 'html', value: '</del>' });
                    } else {
                        mergedCell.children.push({ type: 'text', value: d.value });
                    }
                }
            } else {
                mergedCell.children = newCell.children;
            }
            mergedRow.children.push(mergedCell);
        } else if (newCell) {
            const addedCell = JSON.parse(JSON.stringify(newCell));
            addedCell.data = { ...addedCell.data, hProperties: { ...(addedCell.data?.hProperties || {}), className: ['diff-added'] } };
            mergedRow.children.push(addedCell);
        } else if (oldCell) {
            const removedCell = JSON.parse(JSON.stringify(oldCell));
            removedCell.data = { ...removedCell.data, hProperties: { ...(removedCell.data?.hProperties || {}), className: ['diff-removed'] } };
            mergedRow.children.push(removedCell);
        }
    }
    
    return mergedRow;
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

            let mergedNode: Content | undefined = undefined;
            if (removed[r].type === 'table' && added[bestA].type === 'table') {
                mergedNode = computeTableDiff(removed[r], added[bestA], threshold);
            }

            results.push({
                type: 'modified',
                oldNode: removed[r],
                newNode: added[bestA],
                inlineDiffs: computeInlineDiff(removed[r], added[bestA]),
                mergedNode
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
