import * as diff from 'diff';
import type { Root, Content } from 'mdast';

export type BlockStatus = 'added' | 'removed' | 'unchanged';

export interface BlockDiff {
    status: BlockStatus;
    node: Content;
}

/**
 * Normalizes an AST node for comparison by removing position information.
 */
function normalizeNodeForComparison(node: Content): string {
    return JSON.stringify(node, (key, value) => {
        if (key === 'position') {
            return undefined;
        }
        return value;
    });
}

/**
 * Compares two Markdown ASTs (Root nodes) and determines added, removed, and unchanged blocks.
 * @param before AST of the original Markdown
 * @param after AST of the modified Markdown
 * @returns Array of block diff objects
 */
export function matchNodes(beforeNodes: any[], afterNodes: any[]): BlockDiff[] {
    const changes = diff.diffArrays(beforeNodes, afterNodes, {
        comparator: (left: any, right: any) => {
            return normalizeNodeForComparison(left) === normalizeNodeForComparison(right);
        }
    });

    const result: BlockDiff[] = [];

    for (const change of changes) {
        const status: BlockStatus = change.added ? 'added' : change.removed ? 'removed' : 'unchanged';
        for (const node of change.value) {
            result.push({
                status,
                node
            });
        }
    }

    return result;
}

export function matchBlocks(before: Root, after: Root): BlockDiff[] {
    return matchNodes(before.children, after.children);
}
