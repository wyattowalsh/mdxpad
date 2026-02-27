import { describe, it, expect, vi, beforeEach } from 'vitest';

import { DocxExporter } from '../docx-exporter';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('DocxExporter', () => {
  let exporter: DocxExporter;

  beforeEach(() => {
    exporter = new DocxExporter();
    vi.clearAllMocks();
  });

  it('has correct metadata', () => {
    expect(exporter.format).toBe('docx');
    expect(exporter.label).toBe('Word');
    expect(exporter.extension).toBe('docx');
    expect(exporter.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  it('exports a simple document successfully', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '# Hello\n\nWorld',
      title: 'Test Doc',
      author: 'Test Author',
      outputPath: '/tmp/test.docx',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(true);
    expect(result.outputPath).toBe('/tmp/test.docx');
    expect(writeFile).toHaveBeenCalledOnce();
    expect(result.warnings).toEqual([]);
  });

  it('writes a buffer to the output path', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '# Title\n\nParagraph text.',
      outputPath: '/tmp/output.docx',
    };

    await exporter.export(options);

    const args = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(args?.[0]).toBe('/tmp/output.docx');
    // The docx package produces a Buffer
    expect(Buffer.isBuffer(args?.[1])).toBe(true);
  });

  it('handles headings, lists, and code blocks', async () => {
    const { writeFile } = await import('node:fs/promises');
    const content = [
      '# Heading 1',
      '## Heading 2',
      '',
      'A paragraph.',
      '',
      '- Item one',
      '- Item two',
      '',
      '1. First',
      '2. Second',
      '',
      '```',
      'code block',
      '```',
    ].join('\n');

    const options: ExportOptions = {
      content,
      outputPath: '/tmp/full.docx',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(true);
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it('handles inline formatting (bold, italic, code, links)', async () => {
    const options: ExportOptions = {
      content: '**bold** *italic* `code` [link](http://example.com)',
      outputPath: '/tmp/inline.docx',
    };

    const result = await exporter.export(options);
    expect(result.ok).toBe(true);
  });

  it('returns error on write failure', async () => {
    const { writeFile } = await import('node:fs/promises');
    (writeFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('permission denied'));

    const result = await exporter.export({
      content: '# Test',
      outputPath: '/tmp/fail.docx',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('permission denied');
  });

  it('handles empty content', async () => {
    const result = await exporter.export({
      content: '',
      outputPath: '/tmp/empty.docx',
    });

    expect(result.ok).toBe(true);
  });

  it('handles horizontal rules', async () => {
    const result = await exporter.export({
      content: 'Above\n\n---\n\nBelow',
      outputPath: '/tmp/hr.docx',
    });

    expect(result.ok).toBe(true);
  });
});
