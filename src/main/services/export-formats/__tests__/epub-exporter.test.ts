import { describe, it, expect, vi, beforeEach } from 'vitest';

import { EpubExporter } from '../epub-exporter';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('epub-gen-memory', () => ({
  default: vi.fn().mockResolvedValue(Buffer.from('fake-epub')),
}));

describe('EpubExporter', () => {
  let exporter: EpubExporter;

  beforeEach(() => {
    exporter = new EpubExporter();
    vi.clearAllMocks();
  });

  it('has correct metadata', () => {
    expect(exporter.format).toBe('epub');
    expect(exporter.label).toBe('EPUB');
    expect(exporter.extension).toBe('epub');
    expect(exporter.mimeType).toBe('application/epub+zip');
  });

  it('exports a document with chapters split by headings', async () => {
    const epubGen = await import('epub-gen-memory');
    const options: ExportOptions = {
      content: '# Chapter 1\n\nContent one.\n\n# Chapter 2\n\nContent two.',
      title: 'Test Book',
      author: 'Test Author',
      outputPath: '/tmp/test.epub',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(true);
    expect(result.outputPath).toBe('/tmp/test.epub');

    const createFn = epubGen.default as ReturnType<typeof vi.fn>;
    expect(createFn).toHaveBeenCalledOnce();

    const optionsArg = createFn.mock.calls[0]?.[0] as {
      title: string;
      author: string;
    };
    const contentArg = createFn.mock.calls[0]?.[1] as { title: string; content: string }[];
    expect(optionsArg.title).toBe('Test Book');
    expect(optionsArg.author).toBe('Test Author');
    // Should have at least the two chapters
    expect(contentArg.length).toBeGreaterThanOrEqual(2);
  });

  it('creates an introduction chapter for content before first heading', async () => {
    const epubGen = await import('epub-gen-memory');
    const options: ExportOptions = {
      content: 'Some intro text.\n\n# First Chapter\n\nBody.',
      outputPath: '/tmp/intro.epub',
    };

    await exporter.export(options);

    const createFn = epubGen.default as ReturnType<typeof vi.fn>;
    const contentArg = createFn.mock.calls[0]?.[1] as { title: string; content: string }[];
    const titles = contentArg.map((c) => c.title);
    expect(titles[0]).toBe('Introduction');
  });

  it('handles content with only sub-headings (no chapter splits)', async () => {
    const options: ExportOptions = {
      content: '### Sub-heading\n\nSome text.',
      outputPath: '/tmp/nosplit.epub',
    };

    const result = await exporter.export(options);
    expect(result.ok).toBe(true);
  });

  it('writes buffer to output path', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '# Test',
      outputPath: '/tmp/output.epub',
    };

    await exporter.export(options);

    expect(writeFile).toHaveBeenCalledWith('/tmp/output.epub', expect.any(Buffer));
  });

  it('returns error on epub generation failure', async () => {
    const epubGen = await import('epub-gen-memory');
    (epubGen.default as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('gen failed'));

    const result = await exporter.export({
      content: '# Test',
      outputPath: '/tmp/fail.epub',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('gen failed');
  });

  it('wraps consecutive list items in one list', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- one\n- two\n\n1. first\n2. second',
      outputPath: '/tmp/lists.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    expect(html).toContain('<ol>\n<li>first</li>\n<li>second</li>\n</ol>');
  });

  it('renders emphasis and links in chapter HTML', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: 'See **bold** and [docs](https://example.com).',
      outputPath: '/tmp/inline.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<a href="https://example.com">docs</a>');
    expect(html).not.toContain('**bold**');
  });

  it('renders a formula in chapter HTML', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: 'See $a + b$.\n$$\nx^2\n$$',
      outputPath: '/tmp/math.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<math');
    expect(html).toContain('x^2');
    expect(html).not.toContain('$a + b$');
  });

  it('handles empty content gracefully', async () => {
    const result = await exporter.export({
      content: '',
      outputPath: '/tmp/empty.epub',
    });

    expect(result.ok).toBe(true);
  });
});
