import { describe, expect, it } from 'vitest';

import { renderMarkdownInline } from './markdown-inline-html';
import {
  closeOpenTableRows,
  markdownTableToHtml,
  markdownTableToLatex,
  parseMarkdownTable,
} from './markdown-table';

describe('parseMarkdownTable', () => {
  it('keeps a price and a link in separate columns', () => {
    const table = parseMarkdownTable([
      '| $5 | [link](https://example.com/$10) |',
      '| --- | --- |',
      '| a | b |',
    ]);
    expect(table?.headers).toEqual(['$5', '[link](https://example.com/$10)']);
    expect(table?.rows).toEqual([['a', 'b']]);
    const html = table ? markdownTableToHtml(table, renderMarkdownInline) : '';
    expect(html).toContain('href="https://example.com/$10"');
    expect(html).toContain('>$5<');
  });

  it('reads a header, a separator, and body rows', () => {
    const table = parseMarkdownTable(['| Name | Value |', '| --- | ---: |', '| A | 1 |']);
    expect(table).toEqual({
      headers: ['Name', 'Value'],
      aligns: ['left', 'right'],
      rows: [['A', '1']],
    });
  });

  it('keeps a separator beside an underscore inside a word', () => {
    const table = parseMarkdownTable([
      '| Name | Size |',
      '| --- | --- |',
      '| notes_txt | size_kb |',
    ]);
    expect(table?.rows).toEqual([['notes_txt', 'size_kb']]);
    const doubled = parseMarkdownTable([
      '| file__name | other__col |',
      '| --- | --- |',
      '| file__name | other__col |',
    ]);
    expect(doubled?.headers).toEqual(['file__name', 'other__col']);
    expect(doubled?.rows).toEqual([['file__name', 'other__col']]);
    const emphasis = parseMarkdownTable(['| f | g |', '| --- | --- |', '| _keep|pipe_ | ok |']);
    expect(emphasis?.rows).toEqual([['_keep|pipe_', 'ok']]);
    const strong = parseMarkdownTable(['| f | g |', '| --- | --- |', '| __keep|pipe__ | ok |']);
    expect(strong?.rows).toEqual([['__keep|pipe__', 'ok']]);
    const stars = parseMarkdownTable(['| a* | b* |', '| --- | --- |', '| 1 | 2 |']);
    expect(stars?.headers).toEqual(['a*', 'b*']);
    expect(stars?.rows).toEqual([['1', '2']]);
    const doubledStars = parseMarkdownTable(['| a** | b** |', '| --- | --- |', '| 1 | 2 |']);
    expect(doubledStars?.headers).toEqual(['a**', 'b**']);
    const inside = parseMarkdownTable(['| *keep|pipe* | ok |', '| --- | --- |', '| 1 | 2 |']);
    expect(inside?.headers).toEqual(['*keep|pipe*', 'ok']);
    const across = parseMarkdownTable(['| **a | b** |', '| --- | --- |', '| 1 | 2 |']);
    expect(across?.headers).toEqual(['**a', 'b**']);
    expect(across?.rows).toEqual([['1', '2']]);
    const struck = parseMarkdownTable(['| a~~ | b~~ |', '| --- | --- |', '| 1 | 2 |']);
    expect(struck?.headers).toEqual(['a~~', 'b~~']);
    const struckInside = parseMarkdownTable([
      '| ~~keep|pipe~~ | ok |',
      '| --- | --- |',
      '| 1 | 2 |',
    ]);
    expect(struckInside?.headers).toEqual(['~~keep|pipe~~', 'ok']);
    const span = parseMarkdownTable([
      '| <span title="a|b">x</span> | c |',
      '| --- | --- |',
      '| 1 | 2 |',
    ]);
    expect(span?.headers).toEqual(['<span title="a|b">x</span>', 'c']);
    const em = parseMarkdownTable(['| <em>a|b</em> | c |', '| --- | --- |', '| 1 | 2 |']);
    expect(em?.headers).toEqual(['<em>a|b</em>', 'c']);
    const loose = parseMarkdownTable(['| a < b | c |', '| --- | --- |', '| 1 | 2 |']);
    expect(loose?.headers).toEqual(['a < b', 'c']);
  });

  it('keeps a pipe inside emphasis and a link', () => {
    const strong = parseMarkdownTable(['| f | g |', '| --- | --- |', '| **a|b** | c |']);
    expect(strong?.rows).toEqual([['**a|b**', 'c']]);
    const emphasis = parseMarkdownTable(['| f | g |', '| --- | --- |', '| _a|b_ | c |']);
    expect(emphasis?.rows).toEqual([['_a|b_', 'c']]);
    const link = parseMarkdownTable([
      '| f | g |',
      '| --- | --- |',
      '| [a|b](https://example.com) | c |',
    ]);
    expect(link?.rows).toEqual([['[a|b](https://example.com)', 'c']]);
    const addressed = parseMarkdownTable([
      '| f | g |',
      '| --- | --- |',
      '| [see](https://example.com/a|b) | c |',
    ]);
    expect(addressed?.rows).toEqual([['[see](https://example.com/a|b)', 'c']]);
  });

  it('keeps a pipe inside a formula', () => {
    const table = parseMarkdownTable(['| formula |', '| --- |', '| \\(a|b\\) |']);
    expect(table?.rows).toEqual([['\\(a|b\\)']]);
    const display = parseMarkdownTable(['| $$a \\$$ | b$$ |', '| --- |']);
    expect(display?.headers).toEqual(['$$a \\$$ | b$$']);
  });

  it('keeps a pipe inside inline code', () => {
    const table = parseMarkdownTable(['| Code | Note |', '| --- | --- |', '| `a|b` | ok |']);
    expect(table).toEqual({
      headers: ['Code', 'Note'],
      aligns: ['left', 'left'],
      rows: [['`a|b`', 'ok']],
    });
    const doubled = parseMarkdownTable(['| Code | Note |', '| --- | --- |', '| ``a|b`` | ok |']);
    expect(doubled?.rows).toEqual([['``a|b``', 'ok']]);
    const open = parseMarkdownTable(['| A | B | C |', '| --- | --- | --- |', '| `a|b | c |']);
    expect(open?.rows).toEqual([['`a', 'b', 'c']]);
    const wrapped = parseMarkdownTable([
      '| A | B |',
      '| --- | --- |',
      '| **a `b** | c` d** | e |',
    ]);
    expect(wrapped?.rows).toEqual([['**a `b** | c` d**', 'e']]);
    const linked = parseMarkdownTable([
      '| A | B |',
      '| --- | --- |',
      '| [a `b](url) | c`](https://example.com) | e |',
    ]);
    expect(linked?.rows).toEqual([['[a `b](url) | c`](https://example.com)', 'e']]);
  });

  it('keeps an escaped pipe inside a cell', () => {
    const table = parseMarkdownTable(['| A \\| B | C |', '| --- | :---: |', '| 1 | 2 |']);
    expect(table).toEqual({
      headers: ['A | B', 'C'],
      aligns: ['left', 'center'],
      rows: [['1', '2']],
    });
  });

  it('keeps escaped emphasis literal in a cell', () => {
    const table = parseMarkdownTable(['| A \\*B\\* |', '| --- |', '| 1 |']);
    expect(table?.headers).toEqual(['A \\*B\\*']);
    if (!table) return;
    const html = markdownTableToHtml(table, renderMarkdownInline);
    expect(html).toContain('A *B*');
    expect(html).not.toContain('<em>');
  });

  it('rejects a pipe line that is not a table', () => {
    expect(parseMarkdownTable(['| only |', '| text |'])).toBeNull();
  });

  it('renders header and body cells', () => {
    const table = parseMarkdownTable(['| Name |', '| --- |', '| **A** |']);
    expect(table).not.toBeNull();
    if (!table) return;
    const html = markdownTableToHtml(table, (cell) => cell);
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>**A**</td>');
  });

  it('closes a table that omits its outer pipes', () => {
    expect(closeOpenTableRows('Name | Value\n--- | ---:\nA | 1\n')).toBe(
      '| Name | Value |\n| --- | ---: |\n| A | 1 |\n'
    );
    expect(closeOpenTableRows('| Name | Value\n| --- | ---\n| A | 1\n')).toBe(
      '| Name | Value |\n| --- | --- |\n| A | 1 |\n'
    );
    const fenced = '```\nName | Value\n--- | ---\n```\n';
    expect(closeOpenTableRows(fenced)).toBe(fenced);
    expect(closeOpenTableRows('Title\n---\n')).toBe('Title\n---\n');
    expect(closeOpenTableRows('See a | b here\n\nMore\n')).toBe('See a | b here\n\nMore\n');
    expect(closeOpenTableRows('1) a | b\n--- | ---\n2) c | d\n')).toBe(
      '1) a | b\n--- | ---\n2) c | d\n'
    );
    expect(closeOpenTableRows('  A | B\n  --- | ---\n  1 | 2\n')).toBe(
      '  | A | B |\n  | --- | --- |\n  | 1 | 2 |\n'
    );
  });

  it('accepts a separator made of one hyphen', () => {
    const table = parseMarkdownTable(['| a | b |', '| - | -: |', '| *c* | **d** |']);
    expect(table).toEqual({
      headers: ['a', 'b'],
      aligns: ['left', 'right'],
      rows: [['*c*', '**d**']],
    });
    expect(closeOpenTableRows('a | b\n- | -\n*c* | **d**\n')).toBe(
      '| a | b |\n| - | - |\n| *c* | **d** |\n'
    );
  });

  it('writes column alignment into HTML and LaTeX', () => {
    const table = parseMarkdownTable(['| L | C | R |', '| :--- | :---: | ---: |', '| a | b | c |']);
    expect(table).not.toBeNull();
    if (!table) return;
    const html = markdownTableToHtml(table, (cell) => cell);
    expect(html).toContain('<th>L</th>');
    expect(html).toContain('<th style="text-align: center">C</th>');
    expect(html).toContain('<td style="text-align: right">c</td>');
    expect(markdownTableToLatex(table, (cell) => cell)).toContain('\\begin{tabular}{lcr}');
  });
});
