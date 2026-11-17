import { describe, expect, it } from 'vitest';

import { buildDocxDocument, buildPdfDocument } from '../export-document-builders';

describe('built-in export documents', () => {
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
