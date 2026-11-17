import { describe, expect, it } from 'vitest';

import { markdownTableToHtml, parseMarkdownTable } from './markdown-table';

describe('parseMarkdownTable', () => {
  it('reads a header, a separator, and body rows', () => {
    const table = parseMarkdownTable(['| Name | Value |', '| --- | ---: |', '| A | 1 |']);
    expect(table).toEqual({
      headers: ['Name', 'Value'],
      rows: [['A', '1']],
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
});
