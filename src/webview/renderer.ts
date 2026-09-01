import { unified } from 'unified';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { h } from 'hastscript';
import { toHast } from 'mdast-util-to-hast';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import type { BlockDiffResult } from '../engine/diff';
import type { Root as HastRoot, RootContent as HastContent } from 'hast';

// カスタムサニタイズスキーマ: デフォルトに加えて <ins>, <del> と class 属性を許可する
const customSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), 'ins', 'del'],
    attributes: {
        ...defaultSchema.attributes,
        '*': [...(defaultSchema.attributes?.['*'] || []), 'className']
    },
    protocols: {
        ...defaultSchema.protocols,
        src: [...(defaultSchema.protocols?.src || []), 'vscode-webview-resource']
    }
};

/**
 * BlockDiffResultの配列をHTMLにレンダリングする
 * AST/HAST構造を維持したまま、安全なサニタイズ処理を行う
 */
export async function renderDiff(diffResults: BlockDiffResult[], beforeLabel: string = 'Before', afterLabel: string = 'After'): Promise<string> {
    const hastNodes: HastContent[] = [];

    for (const result of diffResults) {
        if (result.type === 'unchanged' && result.newNode) {
            const hast = toHast(result.newNode);
            if (hast) {
                // Ensure it's treated as an array of HastContent
                if (Array.isArray(hast)) {
                    hastNodes.push(...hast as HastContent[]);
                } else if (hast.type !== 'root') {
                    hastNodes.push(hast as HastContent);
                } else {
                    hastNodes.push(...(hast as HastRoot).children);
                }
            }
        } else if (result.type === 'added' && result.newNode) {
            const hast = toHast(result.newNode);
            if (hast) {
                const node = Array.isArray(hast) ? h('div', hast) : (hast.type === 'root' ? h('div', hast.children) : hast);
                const element = h('div', { className: ['diff-added', 'diff-block'] }, node);
                hastNodes.push(element);
            }
        } else if (result.type === 'removed' && result.oldNode) {
            const hast = toHast(result.oldNode);
            if (hast) {
                const node = Array.isArray(hast) ? h('div', hast) : (hast.type === 'root' ? h('div', hast.children) : hast);
                const element = h('div', { className: ['diff-removed', 'diff-block'] }, node);
                hastNodes.push(element);
            }
        } else if (result.type === 'modified') {
            if (result.mergedNode) {
                // 既にマージ済みのAST（例：表）がある場合は、そのままHASTに変換する
                const mergedHast = toHast(result.mergedNode, { allowDangerousHtml: true }) as HastContent;
                const element = h('div', { className: ['diff-modified', 'diff-block'] }, [mergedHast]);
                hastNodes.push(element);
            } else if (result.oldNode?.type === 'code' && result.newNode?.type === 'code' && result.inlineDiffs) {
                // コードブロックの場合は、行単位のdiffを直接HASTで構築してシンタックスハイライト構造を維持する
                const codeChildren: HastContent[] = [];
                for (const d of result.inlineDiffs) {
                    if (d.added) {
                        codeChildren.push(h('ins', { className: ['diff-inline-added'] }, d.value));
                    } else if (d.removed) {
                        codeChildren.push(h('del', { className: ['diff-inline-removed'] }, d.value));
                    } else {
                        codeChildren.push({ type: 'text', value: d.value });
                    }
                }
                const lang = (result.newNode as any).lang;
                const codeNode = h('code', lang ? { className: [`language-${lang}`] } : {}, codeChildren);
                const preNode = h('pre', [codeNode]);
                const element = h('div', { className: ['diff-modified', 'diff-block'] }, [preNode]);
                hastNodes.push(element);
            } else if (result.inlineDiffs) {
                // 通常のブロック（段落など）の場合は、マークダウン構文を維持するため文字列化してから再パース
                let diffMarkdown = result.inlineDiffs.map(diff => {
                    if (diff.added) return `<ins class="diff-inline-added">${diff.value}</ins>`;
                    if (diff.removed) return `<del class="diff-inline-removed">${diff.value}</del>`;
                    return diff.value;
                }).join('');

                // Preserve heading format if both old and new nodes were headings
                if (result.oldNode?.type === 'heading' && result.newNode?.type === 'heading') {
                    const depth = Math.min(result.oldNode.depth, result.newNode.depth);
                    const prefix = '#'.repeat(depth) + ' ';
                    diffMarkdown = prefix + diffMarkdown;
                }

                const inlineProcessor = unified()
                    .use(remarkParse)
                    .use(remarkGfm)
                    .use(remarkRehype, { allowDangerousHtml: true })
                    .use(rehypeRaw);

                try {
                    const mdast = inlineProcessor.parse(diffMarkdown);
                    const inlineHast = inlineProcessor.runSync(mdast) as HastRoot;
                    const element = h('div', { className: ['diff-modified', 'diff-block'] }, inlineHast.children);
                    hastNodes.push(element);
                } catch (e) {
                    // Fallback to raw text if parsing fails
                    const element = h('div', { className: ['diff-modified', 'diff-block'] }, [
                        { type: 'text', value: diffMarkdown }
                    ] as HastContent[]);
                    hastNodes.push(element);
                }
            } else if (!result.inlineDiffs && result.oldNode && result.newNode) {
                // Block replacement (e.g. modified image content)
                const oldHast = toHast(result.oldNode);
                const newHast = toHast(result.newNode);
                
                const oldNodeHast = Array.isArray(oldHast) ? h('div', oldHast) : (oldHast?.type === 'root' ? h('div', oldHast.children) : oldHast);
                const newNodeHast = Array.isArray(newHast) ? h('div', newHast) : (newHast?.type === 'root' ? h('div', newHast.children) : newHast);
                
                const oldElement = h('div', { className: ['diff-removed', 'diff-image-old'] }, [
                    h('div', { className: ['diff-image-label'] }, beforeLabel),
                    oldNodeHast
                ]);
                
                const newElement = h('div', { className: ['diff-added', 'diff-image-new'] }, [
                    h('div', { className: ['diff-image-label'] }, afterLabel),
                    newNodeHast
                ]);
                
                const element = h('div', { className: ['diff-modified-image-block'] }, [oldElement, newElement]);
                hastNodes.push(element);
            }
        }
    }

    const hastTree: HastRoot = {
        type: 'root',
        children: hastNodes
    };

    // HASTツリーをHTML文字列に変換し、サニタイズ処理を通す
    const processor = unified()
        .use(rehypeRaw)
        .use(rehypeSanitize, customSchema)
        .use(rehypeStringify);

    const vfile = await processor.run(hastTree);
    const html = processor.stringify(vfile);

    return String(html);
}
