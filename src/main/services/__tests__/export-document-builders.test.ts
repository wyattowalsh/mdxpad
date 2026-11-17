import { describe, expect, it } from 'vitest';

import { buildDocxDocument, buildPdfDocument } from '../export-document-builders';

describe('built-in export documents', () => {
  it('decodes a character reference in plain text', () => {
    const pdf = buildPdfDocument('Say AT&amp;T.');
    expect(pdf.content).toContain('Say AT&T.');
    expect(pdf.content).not.toContain('&amp;');
  });

  it('drops a closing hash run from a heading', () => {
    const pdf = buildPdfDocument('# Title #\n\n# Hash#');
    expect(pdf.content).toContain('TITLE');
    expect(pdf.content).toContain('HASH#');
    expect(pdf.content).not.toContain('TITLE #');
    const docx = Buffer.from(buildDocxDocument('# Title #').content).toString('utf8');
    expect(docx).toContain('Title');
    expect(docx).not.toContain('Title #');
  });

  it('keeps a fenced comment out of the heading style and shows emphasis as text', () => {
    const source = '```\n# comment\n```\n\n# Title\n\n**bold**';
    const pdf = buildPdfDocument(source);
    expect(pdf.content).toContain('comment');
    expect(pdf.content).not.toContain('COMMENT');
    expect(pdf.content).toContain('TITLE');
    expect(pdf.content).toContain('bold');
    expect(pdf.content).not.toContain('**bold**');

    const docx = Buffer.from(buildDocxDocument(source).content).toString('utf8');
    expect(docx).toContain('comment');
    expect(docx.match(/w:val="Heading1"/g)).toHaveLength(1);
    expect(docx).toContain('bold');
    expect(docx).not.toContain('**bold**');
  });

  it('does not turn a list or a quote into an underlined heading', () => {
    const pdf = buildPdfDocument('- item\n---\n\n> Note\n---\n\nFoo\nBar\n---');
    expect(pdf.content).toContain('- item');
    expect(pdf.content).toContain('Note');
    expect(pdf.content).toContain('FOO BAR');
    expect(pdf.content).not.toContain('- ITEM');
    expect(pdf.content).not.toContain('NOTE');
  });

  it('joins repeated quote markers and keeps a blank line', () => {
    const pdf = buildPdfDocument('> hello\n> there\n>\n> next');
    expect(pdf.content).toContain('(hello there) Tj');
    expect(pdf.content).toContain('(next) Tj');
    expect(pdf.content).not.toContain('hello there next');
  });

  it('keeps a wrapped quote on one line', () => {
    const pdf = buildPdfDocument('> Keep this\nline too.\n\nAfter');
    expect(pdf.content).toContain('Keep this line too.');
    expect(pdf.content).toContain('After');
    const docx = Buffer.from(buildDocxDocument('> Keep **this**\nline too.').content).toString(
      'utf8'
    );
    expect(docx).toContain('Keep this line too.');
    expect(docx).not.toContain('**');
  });

  it('keeps a loose list continuation on the item', () => {
    const pdf = buildPdfDocument('- item\n\n    continued\n\nAfter');
    expect(pdf.content).toContain('- item continued');
    expect(pdf.content).not.toContain('```');
    expect(pdf.content).toContain('After');
  });

  it('keeps a wrapped list item on one line', () => {
    const pdf = buildPdfDocument('- item\n  **continued**\n\nAfter');
    expect(pdf.content).toContain('- item continued');
    expect(pdf.content).not.toContain('**');
    expect(pdf.content).toContain('After');
    const docx = Buffer.from(buildDocxDocument('- item\n  continued').content).toString('utf8');
    expect(docx).toContain('item continued');
  });

  it('writes a table inside a quote as cells', () => {
    const source = '> Intro\n> | A | B |\n> | --- | ---: |\n> | 1 | 2 |';
    const pdf = buildPdfDocument(source);
    expect(pdf.content).toContain('Intro');
    expect(pdf.content).toContain('A | B');
    expect(pdf.content).toContain('1 | 2');
    expect(pdf.content).not.toContain('---');
    expect(pdf.content).not.toContain('Intro | A');
    const docx = Buffer.from(buildDocxDocument(source).content).toString('utf8');
    expect(docx).toContain('<w:tbl>');
    expect(docx).toContain('w:val="right"');
    expect(docx).toContain('Intro');
  });

  it('writes a table as cells and leaves out the separator', () => {
    const source = 'Name | Value\n--- | ---:\n**A** | 1';
    const pdf = buildPdfDocument(source);
    expect(pdf.content).toContain('Name | Value');
    expect(pdf.content).toContain('A | 1');
    expect(pdf.content).not.toContain('---');
    expect(pdf.content).not.toContain('**');

    const docx = Buffer.from(buildDocxDocument(source).content).toString('utf8');
    expect(docx).toContain('<w:tbl>');
    expect(docx).toContain('Name');
    expect(docx).toContain('A');
    expect(docx).toContain('w:val="right"');
    expect(docx).not.toContain('---');
  });

  it('writes a task and a horizontal rule as plain text', () => {
    const pdf = buildPdfDocument('- [x] **done**\n\n* * *\n\nBelow');
    expect(pdf.content).toContain('[x] done');
    expect(pdf.content).toContain('----------');
    expect(pdf.content).not.toContain('* * *');
    expect(pdf.content).not.toContain('**');
    expect(pdf.content).toContain('Below');
  });

  it('keeps a hard break without printing the backslash', () => {
    const pdf = buildPdfDocument('Hello\\\nworld\n\n> Stay\\\n> put');
    expect(pdf.content).toContain('(Hello) Tj');
    expect(pdf.content).toContain('(world) Tj');
    expect(pdf.content).toContain('(Stay) Tj');
    expect(pdf.content).toContain('(put) Tj');
    expect(pdf.content).not.toContain('Hello\\\\');
    expect(pdf.content).not.toContain('Stay put');
    const docx = Buffer.from(buildDocxDocument('> Stay\\\n> put').content).toString('utf8');
    expect(docx).toContain('Stay');
    expect(docx).toContain('<w:br/>');
    expect(docx).toContain('put');
  });

  it('keeps an escaped asterisk in a table cell', () => {
    const pdf = buildPdfDocument('| A \\*B\\* |\n| --- |\n| 1 |');
    expect(pdf.content).toContain('A *B*');
  });

  it('reads a block quote without the marker', () => {
    const pdf = buildPdfDocument('> Keep **this**');
    expect(pdf.content).toContain('Keep this');
    expect(pdf.content).not.toContain('> Keep');
    expect(pdf.content).not.toContain('**');
  });

  it('keeps a link address in the text', () => {
    const pdf = buildPdfDocument('See [docs](https://example.com).');
    expect(pdf.content).toContain('docs');
    expect(pdf.content).toContain('https://example.com');

    const docx = Buffer.from(
      buildDocxDocument('See [docs](https://example.com).').content
    ).toString('utf8');
    expect(docx).toContain('docs');
    expect(docx).toContain('https://example.com');
  });

  it('turns an underlined title into a heading', () => {
    const pdf = buildPdfDocument('Title\n===\n\nRule\n\n---');
    expect(pdf.content).toContain('TITLE');
    expect(pdf.content).not.toContain('===');
    expect(pdf.content).toContain('---');

    const docx = Buffer.from(buildDocxDocument('Title\n===').content).toString('utf8');
    expect(docx).toContain('w:val="Heading1"');
    expect(docx).not.toContain('===');
  });

  it('wraps a long line instead of running off the page', () => {
    const pdf = buildPdfDocument(`word ${'longword '.repeat(40)}`);
    const drawn = [...pdf.content.matchAll(/\(([^)]*)\) Tj/g)].map((match) => match[1] ?? '');
    expect(drawn.length).toBeGreaterThan(1);
    expect(drawn.every((line) => line.length <= 90)).toBe(true);
    expect(drawn.join(' ')).toContain('longword');
  });

  it('prints a footnote number with the Helvetica-safe marker', () => {
    const pdf = buildPdfDocument('See [^1].\n\n[^1]: Note');
    expect(pdf.content).toContain('[1]');
    expect(pdf.content).toContain('Note');
    expect(pdf.content).not.toContain('¹');
  });
});
