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

  it('drops a closing hash run from a chapter title', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '# Chapter #\n\n### Keep ### b',
      outputPath: '/tmp/closing-hash.epub',
    });
    const createFn = epubGen.default as ReturnType<typeof vi.fn>;
    const contentArg = createFn.mock.calls[0]?.[1] as { title: string; content: string }[];
    expect(contentArg[0]?.title).toBe('Chapter');
    expect(contentArg[0]?.content).toContain('<a id="chapter"></a>');
    expect(contentArg[0]?.content).toContain('<h3 id="keep-b">Keep ### b</h3>');
    expect(contentArg[0]?.content).not.toContain('Keep ### b #');
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

  it('keeps a setext heading inside a list item', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- item\n  ---\n  after\n',
      outputPath: '/tmp/list-setext.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<li><h2 id="item">item</h2>');
    expect(html).toContain('<p>after</p>');
    expect(html).not.toContain('<hr />');
  });

  it('keeps a horizontal rule inside a list item', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- item\n\n  ---\n\n  after\n',
      outputPath: '/tmp/list-rule.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<li><p>item</p><hr /><p>after</p></li>');
    expect(html.indexOf('<hr />')).toBeLessThan(html.indexOf('</ul>'));
  });

  it('keeps indented code inside a list item', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- item\n\n      const x = 1\n',
      outputPath: '/tmp/list-indent.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<li><p>item</p><pre><code>const x = 1</code></pre>');
    expect(html.indexOf('</code></pre>')).toBeLessThan(html.indexOf('</ul>'));
    expect(html).not.toContain('  const');
  });

  it('keeps display math inside a list item', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- item\n\n  $$\n  a < b\n  $$\n',
      outputPath: '/tmp/list-math.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<li><p>item</p><span class="katex">');
    expect(html).toContain('application/x-tex">a &lt; b');
    expect(html.indexOf('</span>')).toBeLessThan(html.indexOf('</ul>'));
    expect(html).not.toContain('katex-error');
  });

  it('keeps a table inside a list item', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- item\n\n  | A | B |\n  | --- | ---: |\n  | 1 | 2 |\n',
      outputPath: '/tmp/list-table.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<li><p>item</p><table>');
    expect(html).toContain('<td style="text-align: right">2</td>');
    expect(html.indexOf('</table>')).toBeLessThan(html.indexOf('</ul>'));
  });

  it('keeps a block quote inside a list item', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- item\n\n  > quoted\n  > line\n',
      outputPath: '/tmp/list-quote.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<li><p>item</p><blockquote>');
    expect(html).toContain('<p>quoted line</p>');
    expect(html.indexOf('</blockquote>')).toBeLessThan(html.indexOf('</ul>'));
  });

  it('keeps a fenced block inside a list item', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- item\n\n  ```js\n  const x = 1\n  ```\n',
      outputPath: '/tmp/list-code.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<li><p>item</p><pre><code class="language-js">');
    expect(html.indexOf('<li><p>item</p><pre>')).toBeLessThan(html.indexOf('</ul>'));
    expect(html).not.toContain('  <span class="hljs-keyword">const');
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
    await exporter.export({
      content: '1) one\n\n\n2) two',
      outputPath: '/tmp/paren-list.epub',
    });
    const continued = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as {
      content: string;
    }[];
    const continuedHtml = continued.map((chapter) => chapter.content).join('\n');
    expect(continuedHtml.match(/<ol\b/g)).toHaveLength(1);
    expect(continuedHtml).toContain('<li><p>one</p></li>');
    expect(continuedHtml).toContain('<li><p>two</p></li>');
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

  it('renders a block quote in chapter HTML', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '> Keep this',
      outputPath: '/tmp/quote.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('Keep this');
    expect(html).not.toContain('> Keep this');
  });

  it('keeps a later paragraph inside the parent item', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- parent\n\n  - child\n\n  more\n',
      outputPath: '/tmp/nested-more.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain(
      '<ul>\n<li><p>parent</p>\n<ul>\n<li>child</li>\n</ul>\n<p>more</p>\n</li>'
    );
    await exporter.export({
      content: '- parent\n  - child\n\n  more\n',
      outputPath: '/tmp/nested-tight-child.epub',
    });
    const tight = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as {
      content: string;
    }[];
    const tightHtml = tight.map((chapter) => chapter.content).join('\n');
    expect(tightHtml).toContain(
      '<ul>\n<li><p>parent</p>\n<ul>\n<li>child</li>\n</ul>\n<p>more</p>\n</li>'
    );
  });

  it('nests a child list under its parent', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- parent\n  - child',
      outputPath: '/tmp/nested.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<ul>\n<li>parent\n<ul>\n<li>child</li>\n</ul>\n</li>\n</ul>');
  });

  it('resolves a reference link', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: 'See [the docs][guide].\n\n[guide]: https://example.com',
      outputPath: '/tmp/ref.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<a href="https://example.com">the docs</a>');
    expect(html).not.toContain('[guide]:');
  });

  it('keeps a wrapped paragraph and a hard break', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: 'Hello\nworld\n\nStay  \nput',
      outputPath: '/tmp/wrap.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<p>Hello world</p>');
    expect(html).toContain('<p>Stay<br />put</p>');
  });

  it('renders a horizontal rule in chapter HTML', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: 'Above\n\n---\n\nBelow',
      outputPath: '/tmp/rule.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<hr />');
    expect(html).toContain('Above');
    expect(html).not.toContain('---');
  });

  it('renders a task checkbox in chapter HTML', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '- [x] done',
      outputPath: '/tmp/tasks.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<input type="checkbox" disabled checked />');
    expect(html).toContain('done');
    expect(html).not.toContain('[x]');
  });

  it('links a footnote in chapter HTML', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: 'A footnote[^1].\n\n[^1]: Note',
      outputPath: '/tmp/note.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<sup><a href="#fn-1" id="fnref-1">1</a></sup>');
    expect(html).toContain('<li><span id="fn-1"></span>Note</li>');
    expect(html).not.toContain('[^1]');
  });

  it('renders a markdown table in chapter HTML', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '| Name | Value |\n| --- | --- |\n| A | 1 |',
      outputPath: '/tmp/table.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('border: 1px solid #d1d5db');
    expect(html).toContain('text-align: left');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>A</td>');
  });

  it('keeps a one-line HTML block from being parsed again', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '<div>\n\nhello\n\n</div>\n',
      outputPath: '/tmp/html-one-line.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html.indexOf('<div>')).toBeLessThan(html.indexOf('<p>hello</p>'));
    expect(html.indexOf('<p>hello</p>')).toBeLessThan(html.indexOf('</div>'));
    expect(html).not.toContain('<p><div>');
    expect(html).not.toContain('<p></div>');
  });

  it('keeps a raw HTML block in chapter HTML', async () => {
    const epubGen = await import('epub-gen-memory');
    await exporter.export({
      content: '<div>\nHello\n</div>\n\nAfter',
      outputPath: '/tmp/html-block.epub',
    });
    const contentArg = (epubGen.default as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as {
      content: string;
    }[];
    const html = contentArg.map((chapter) => chapter.content).join('\n');
    expect(html).toContain('<div>\nHello\n</div>');
    expect(html).toContain('After');
    expect(html).not.toContain('&lt;div&gt;');
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
