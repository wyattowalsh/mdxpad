import { describe, expect, it } from 'vitest';

import { renderMarkdownInline } from './markdown-inline-html';
import {
  closeOpenTableRows,
  markdownTableToHtml,
  markdownTableToLatex,
  parseMarkdownTable,
} from './markdown-table';

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
