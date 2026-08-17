import { expect, test } from 'vitest';
import { parseMarkdown } from '../../src/engine/parser';
import { computeFineGrainedDiffAsync } from '../../src/engine/diff';
import { renderDiff } from '../../src/webview/renderer';

test('Sensitivity slider changes diff output', async () => {
    const beforeText = 'This is a very long sentence that has some specific words at the end.';
    const afterText =  'This is a very long sentence that has completely different words now.';

    const beforeAst = parseMarkdown(beforeText);
    const afterAst = parseMarkdown(afterText);

    // low threshold = 0.1 -> block is "similar enough", so it uses inline diff -> <ins> and <del> should be present
    const diffLow = await computeFineGrainedDiffAsync(beforeAst, afterAst, 0.1);
    const htmlLow = await renderDiff(diffLow);

    // high threshold = 0.9 -> block is NOT "similar enough", so it splits into removed and added -> NO <ins> and <del>, but div diff-added and diff-removed
    const diffHigh = await computeFineGrainedDiffAsync(beforeAst, afterAst, 0.9);
    const htmlHigh = await renderDiff(diffHigh);

    expect(htmlLow).not.toEqual(htmlHigh);
    expect(htmlLow).toContain('<ins');
    expect(htmlLow).toContain('<del');
    
    expect(htmlHigh).not.toContain('<ins');
    expect(htmlHigh).not.toContain('<del');
});
