"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const parser_1 = require("../../src/engine/parser");
(0, vitest_1.describe)('Markdown Parser', () => {
    (0, vitest_1.it)('should correctly parse a simple markdown string to an AST', () => {
        const markdown = '# Hello World\n\nThis is a test.';
        const ast = (0, parser_1.parseMarkdown)(markdown);
        (0, vitest_1.expect)(ast.type).toBe('root');
        (0, vitest_1.expect)(ast.children.length).toBe(2);
        (0, vitest_1.expect)(ast.children[0].type).toBe('heading');
        (0, vitest_1.expect)(ast.children[1].type).toBe('paragraph');
    });
    (0, vitest_1.it)('should correctly parse GFM tables', () => {
        const markdown = '| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |';
        const ast = (0, parser_1.parseMarkdown)(markdown);
        (0, vitest_1.expect)(ast.type).toBe('root');
        (0, vitest_1.expect)(ast.children.length).toBe(1);
        (0, vitest_1.expect)(ast.children[0].type).toBe('table');
    });
});
//# sourceMappingURL=parser.test.js.map