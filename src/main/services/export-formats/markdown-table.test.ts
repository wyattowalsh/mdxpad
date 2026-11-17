import { describe, expect, it } from 'vitest';

import { markdownTableToHtml, markdownTableToLatex, parseMarkdownTable } from './markdown-table';

describe('parseMarkdownTable', () => {
  it('reads a header, a separator, and body rows', () => {
    const table = parseMarkdownTable(['| Name | Value |', '| --- | ---: |', '| A | 1 |']);
    expect(table).toEqual({
      headers: ['Name', 'Value'],
      aligns: ['left', 'right'],
      rows: [['A', '1']],
    });
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
  });

  it('keeps an escaped pipe inside a cell', () => {
    const table = parseMarkdownTable(['| A \\| B | C |', '| --- | :---: |', '| 1 | 2 |']);
    expect(table).toEqual({
      headers: ['A | B', 'C'],
      aligns: ['left', 'center'],
      rows: [['1', '2']],
    });
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
