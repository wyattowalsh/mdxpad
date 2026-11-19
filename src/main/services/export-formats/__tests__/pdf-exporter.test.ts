import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFile } from 'node:fs/promises';

import { PdfExporter } from '../pdf-exporter';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  lstat: vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' })),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

const mockPrintToPDF = vi.fn().mockResolvedValue(Buffer.from('fake-pdf'));
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn();
const mockIsDestroyed = vi.fn().mockReturnValue(false);

vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: mockLoadURL,
    webContents: {
      printToPDF: mockPrintToPDF,
    },
    destroy: mockDestroy,
    isDestroyed: mockIsDestroyed,
  })),
}));

describe('PdfExporter', () => {
  let exporter: PdfExporter;

  beforeEach(() => {
    exporter = new PdfExporter();
    vi.clearAllMocks();
    mockIsDestroyed.mockReturnValue(false);
  });

  it('has correct metadata', () => {
    expect(exporter.format).toBe('pdf');
    expect(exporter.label).toBe('PDF');
    expect(exporter.extension).toBe('pdf');
    expect(exporter.mimeType).toBe('application/pdf');
  });

  it('creates a hidden BrowserWindow and calls printToPDF', async () => {
    const { BrowserWindow } = await import('electron');
    const options: ExportOptions = {
      content: '# Hello World',
      title: 'Test PDF',
      outputPath: '/tmp/test.pdf',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(true);
    expect(result.outputPath).toBe('/tmp/test.pdf');
    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        show: false,
        webPreferences: expect.objectContaining({
          offscreen: true,
          nodeIntegration: false,
          contextIsolation: true,
        }),
      })
    );
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    expect(typeof loadedUrl).toBe('string');
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<h1 id="hello-world">Hello World</h1>');
    expect(html).not.toContain('<pre style="white-space: pre-wrap;">');
    expect(mockLoadURL).toHaveBeenCalledOnce();
    expect(mockPrintToPDF).toHaveBeenCalledOnce();
  });

  it('does not print a local file named by an HTML block', async () => {
    await exporter.export({
      content: '<iframe src="file:///etc/passwd"></iframe>\n\n<script>\nlocation="file:///etc/passwd"\n</script>',
      outputPath: '/tmp/local.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).not.toContain('file:');
    expect(html).not.toContain('/etc/passwd');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<iframe');
  });

  it('uses the preset font in the printed document', async () => {
    await exporter.export({
      content: 'Hello',
      outputPath: '/tmp/font.pdf',
      metadata: { fontFamily: 'Georgia', fontSizePt: 14 },
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('font-family: Georgia');
    expect(html).toContain('font-size: 14pt');
  });

  it('keeps a style-breaking font family out of the printed document', async () => {
    await exporter.export({
      content: 'Hello',
      outputPath: '/tmp/font-bad.pdf',
      metadata: { fontFamily: 'Georgia; } body { background: url(https://evil.example)' },
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('-apple-system');
    expect(html).not.toContain('evil.example');
  });

  it('writes the preset subject and font size into a text PDF', async () => {
    mockPrintToPDF.mockRejectedValueOnce(new Error('print failed'));
    const result = await exporter.export({
      content: 'Hello',
      title: 'Notes',
      outputPath: '/tmp/subject.pdf',
      metadata: { subject: 'Field notes', fontSizePt: 14 },
    });

    expect(result.ok).toBe(true);
    const written = vi.mocked(writeFile).mock.calls[0]?.[1];
    expect(written).toContain('/Subject (Field notes)');
    expect(written).toContain('14.00 Tf');
  });

  it('writes a text PDF when print is unavailable', async () => {
    mockPrintToPDF.mockRejectedValueOnce(new Error('print failed'));
    const result = await exporter.export({
      content: '# Hello',
      outputPath: '/tmp/fallback.pdf',
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('PDF print was unavailable, so a text PDF was written.');
    const written = vi.mocked(writeFile).mock.calls[0]?.[1];
    expect(typeof written).toBe('string');
    if (typeof written !== 'string') {
      return;
    }
    expect(written.startsWith('%PDF')).toBe(true);
    expect(written).toContain('HELLO');
  });

  it('drops a closing hash run from a heading', async () => {
    await exporter.export({
      content: '# Title #\n\n# Hash#\n\n## Keep ### b',
      outputPath: '/tmp/closing-hash.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html).toContain('<h1 id="hash">Hash#</h1>');
    expect(html).toContain('<h2 id="keep-b">Keep ### b</h2>');
    expect(html).not.toContain('Title #');
  });

  it('starts an ordered list at its written number', async () => {
    await exporter.export({
      content: '3. third\n4. fourth',
      outputPath: '/tmp/start.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<ol start="3">');
    expect(html).toContain('<li>third</li>');
    expect(html).toContain('<li>fourth</li>');
    const paren = await exporter.export({
      content: '1) one\n\n\n2) two\n\n\nAfter',
      outputPath: '/tmp/paren-list.pdf',
    });
    expect(paren.ok).toBe(true);
    const parenHtml = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(parenHtml.match(/<ol\b/g)).toHaveLength(1);
    expect(parenHtml).toContain('<ol class="paren" style="counter-reset: mdx-paren 0">');
    expect(parenHtml).toContain('ol.paren > li::before');
    const markers = await exporter.export({
      content: '+ plus\n\n* star\n\n0) zero',
      outputPath: '/tmp/list-markers.pdf',
    });
    expect(markers.ok).toBe(true);
    const markerHtml = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(markerHtml).toContain('<ul class="plus">');
    expect(markerHtml).toContain('<ul class="star">');
    expect(markerHtml).toContain(
      '<ol class="paren" start="0" style="counter-reset: mdx-paren -1">'
    );
    expect(parenHtml).toContain('<li><p>one</p></li>');
    expect(parenHtml).toContain('<li><p>two</p></li>');
    expect(parenHtml).toContain('<p>After</p>');
    const zero = await exporter.export({
      content: '0. zero',
      outputPath: '/tmp/zero-list.pdf',
    });
    expect(zero.ok).toBe(true);
    const zeroHtml = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(zeroHtml).toContain('<ol start="0">');
    expect(zeroHtml).toContain('<li>zero</li>');
  });

  it('keeps indented code as code', async () => {
    await exporter.export({
      content: 'Intro\n\n    const x = 1',
      outputPath: '/tmp/indent.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<pre><code>');
    expect(html).toContain('const x = 1');
    expect(html).not.toContain('<p>const x = 1</p>');
  });

  it('colors a fenced TypeScript block', async () => {
    await exporter.export({
      content: '```ts\nconst answer = 1;\n```',
      outputPath: '/tmp/code-color.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('class="language-ts"');
    expect(html).toContain('hljs-keyword');
    expect(html).toContain('const');
    expect(html).toContain('answer');
  });

  it('keeps a tilde fence as code', async () => {
    await exporter.export({
      content: '~~~\n# not a heading\n~~~',
      outputPath: '/tmp/tilde.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<pre><code>');
    expect(html).toContain('# not a heading');
    expect(html).not.toContain('<h1>');
  });

  it('strikes text wrapped onto the next line', async () => {
    await exporter.export({
      content: '~~hello\nworld~~',
      outputPath: '/tmp/strike-wrap.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<del>hello world</del>');
  });

  it('strikes text across a hard break', async () => {
    await exporter.export({
      content: '~~hello  \nworld~~',
      outputPath: '/tmp/strike-break.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<del>hello</del><br /><del>world</del>');
  });

  it('keeps a hard break inside a list item', async () => {
    await exporter.export({
      content: '- Stay  \n  put',
      outputPath: '/tmp/list-break.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li>Stay<br />put</li>');
  });

  it('strikes a list item across a hard break', async () => {
    await exporter.export({
      content: '- ~~hello  \n  world~~',
      outputPath: '/tmp/list-strike.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><del>hello</del><br /><del>world</del></li>');
  });

  it('strikes a wrapped list item', async () => {
    await exporter.export({
      content: '- ~~hello\n  world~~',
      outputPath: '/tmp/list-strike-wrap.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><del>hello world</del></li>');
  });

  it('keeps a wrapped quoted list item together', async () => {
    await exporter.export({
      content: '> - ~~hello\n>   world~~',
      outputPath: '/tmp/quote-list.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><del>hello world</del></li>');
  });

  it('keeps a setext heading inside a list item', async () => {
    await exporter.export({
      content: '- item\n  ---\n  after\n',
      outputPath: '/tmp/list-setext.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><h2 id="item">item</h2><p>after</p></li>');
    expect(html).not.toContain('<hr />');
  });

  it('keeps a horizontal rule inside a list item', async () => {
    await exporter.export({
      content: '- item\n\n  ---\n\n  after\n',
      outputPath: '/tmp/list-rule.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><p>item</p><hr /><p>after</p></li>');
    expect(html.indexOf('<hr /><p>after</p></li>')).toBeLessThan(html.indexOf('</ul>'));
    const stars = await exporter.export({
      content: '- item\n\n  * * *\n',
      outputPath: '/tmp/list-stars.pdf',
    });
    expect(stars.ok).toBe(true);
    const starHtml = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(starHtml).toContain('<li><p>item</p><hr /></li>');
  });

  it('keeps indented code inside a list item', async () => {
    await exporter.export({
      content: '- item\n\n      const x = 1\n\n  after\n',
      outputPath: '/tmp/list-indent.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><p>item</p><pre><code>const x = 1</code></pre>');
    expect(html).toContain('</code></pre><p>after</p></li>');
    expect(html.indexOf('</code></pre><p>after</p></li>')).toBeLessThan(html.indexOf('</ul>'));
    expect(html).not.toContain('  const');
  });

  it('keeps display math inside a list item', async () => {
    await exporter.export({
      content: '- item\n\n  $$\n  a < b\n  $$\n\n  after\n',
      outputPath: '/tmp/list-math.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><p>item</p><span class="katex">');
    expect(html).toContain('<math');
    expect(html).toContain('application/x-tex">a &lt; b');
    expect(html).toContain('</span><p>after</p></li>');
    expect(html.indexOf('</span><p>after</p></li>')).toBeLessThan(html.indexOf('</ul>'));
    expect(html).not.toContain('katex-error');
  });

  it('keeps a table inside a list item', async () => {
    await exporter.export({
      content: '- item\n\n  | A | B |\n  | --- | ---: |\n  | 1 | 2 |\n\n  after\n',
      outputPath: '/tmp/list-table.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><p>item</p><table>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td style="text-align: right">2</td>');
    expect(html).toContain('</table><p>after</p></li>');
    expect(html.indexOf('</table><p>after</p></li>')).toBeLessThan(html.indexOf('</ul>'));
  });

  it('keeps a block quote inside a list item', async () => {
    await exporter.export({
      content: '- item\n\n  > quoted\n  > line\n\n  after\n',
      outputPath: '/tmp/list-quote.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><p>item</p><blockquote>');
    expect(html).toContain('<p>quoted line</p>');
    expect(html).toContain('</blockquote><p>after</p></li>');
    expect(html.indexOf('</blockquote><p>after</p></li>')).toBeLessThan(html.indexOf('</ul>'));
  });

  it('keeps a fence written on a parenthesis marker', async () => {
    await exporter.export({
      content: '1) ```js\n   const x = 1\n   ```\n',
      outputPath: '/tmp/paren-marker-fence.pdf',
    });
    const html = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(html).toContain('<li><pre><code class="language-js">');
    expect(html).toContain('const');
    expect(html.indexOf('</code></pre></li>')).toBeLessThan(html.indexOf('</ol>'));
  });

  it('keeps a fenced block inside a parenthesis list item', async () => {
    await exporter.export({
      content: '10) item\n\n    ```js\n    const x = 1\n    ```\n\n    after\n',
      outputPath: '/tmp/paren-code.pdf',
    });
    const inside = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(inside).toContain('<li><p>item</p><pre><code class="language-js">');
    expect(inside).toContain('</code></pre><p>after</p></li>');
    await exporter.export({
      content: '10) item\n\n   ```js\n   const x = 1\n   ```\n',
      outputPath: '/tmp/paren-code-out.pdf',
    });
    const outside = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(outside).toContain('<li>item</li>');
    expect(outside.indexOf('</ol>')).toBeLessThan(
      outside.indexOf('<pre><code class="language-js">')
    );
  });

  it('keeps a fenced block inside a list item', async () => {
    await exporter.export({
      content: '- item\n\n  ```js\n  const x = 1\n  ```\n\n  after\n',
      outputPath: '/tmp/list-code.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><p>item</p><pre><code class="language-js">');
    expect(html).toContain('</code></pre><p>after</p></li>');
    expect(html.indexOf('</code></pre><p>after</p></li>')).toBeLessThan(html.indexOf('</ul>'));
    expect(html).not.toContain('  <span class="hljs-keyword">const');
  });

  it('keeps a fenced block inside a quote', async () => {
    await exporter.export({
      content: '> ```js\n> const x = 1\n> ```\n',
      outputPath: '/tmp/quote-code.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('const');
    expect(html).toContain('x =');
    expect(html).not.toContain('<code>js const');
  });

  it('renders a comparison inside display math', async () => {
    await exporter.export({
      content: '$$\na < b\n$$',
      outputPath: '/tmp/math-compare.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<math');
    expect(html).not.toContain('katex-error');
  });

  it('does not let a later number interrupt a paragraph', async () => {
    await exporter.export({
      content:
        'See version\n14. Next sentence.\n\n- foo\n  2. bar\n\n- foo\n  1. bar\n\n- foo\n\n  2. bar\n',
      outputPath: '/tmp/list-interrupt.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<p>See version 14. Next sentence.</p>');
    expect(html).not.toContain('<ol start="14">');
    expect(html).toContain('<li><p>foo 2. bar</p></li>');
    expect(html).toContain('<ol>\n<li>bar</li>\n</ol>');
    expect(html).toContain('<ol start="2">');
  });

  it('groups consecutive list items into one list', async () => {
    const options: ExportOptions = {
      content: '- one\n- two\n\n1. first\n2. second',
      outputPath: '/tmp/lists.pdf',
    };
    await exporter.export(options);
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    const mixed = await exporter.export({
      content: '- one\n+ two\n* three',
      outputPath: '/tmp/mixed-bullets.pdf',
    });
    expect(mixed.ok).toBe(true);
    const mixedHtml = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(mixedHtml).toContain('<ul>\n<li>one</li>');
    expect(mixedHtml).toContain('<ul class="plus">\n<li>two</li>');
    expect(mixedHtml).toContain('<ul class="star">\n<li>three</li>');
    expect(mixedHtml).toContain('ul.plus > li::before');
    expect(mixedHtml).toContain('ul.star > li::before');
    expect(html).toContain('<ol>\n<li>first</li>\n<li>second</li>\n</ol>');
    expect(html).not.toContain('<ul><li>');
  });

  it('keeps a lazy line inside the child item', async () => {
    await exporter.export({
      content: '- parent\n  - child\n  more\n',
      outputPath: '/tmp/nested-lazy.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li>child more</li>');
    expect(html).toContain('<li>parent\n<ul>\n<li>child more</li>\n</ul>\n</li>');
  });

  it('keeps a later paragraph inside the parent item', async () => {
    await exporter.export({
      content: '- parent\n\n  - child\n\n  more\n',
      outputPath: '/tmp/nested-more.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain(
      '<ul>\n<li><p>parent</p>\n<ul>\n<li>child</li>\n</ul>\n<p>more</p>\n</li>'
    );
    const tightChild = await exporter.export({
      content: '- one\n- parent\n  - child\n\n  more\n',
      outputPath: '/tmp/nested-tight-child.pdf',
    });
    expect(tightChild.ok).toBe(true);
    const tightHtml = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(tightHtml).toContain('<li><p>one</p></li>');
    expect(tightHtml).toContain(
      '<li><p>parent</p>\n<ul>\n<li>child</li>\n</ul>\n<p>more</p>\n</li>'
    );
    expect(tightHtml).not.toContain('<li><p>child</p></li>');
    const ended = await exporter.export({
      content: '- parent\n\n  - child\n\nbaz\n',
      outputPath: '/tmp/nested-ended.pdf',
    });
    expect(ended.ok).toBe(true);
    const endedUrl = mockLoadURL.mock.calls.at(-1)?.[0];
    const endedHtml = decodeURIComponent(
      String(endedUrl).replace('data:text/html;charset=utf-8,', '')
    );
    expect(endedHtml).toContain('</ul>\n<p>baz</p>');
    expect(endedHtml.indexOf('</ul>\n<p>baz</p>')).toBeGreaterThan(
      endedHtml.indexOf('<li>child</li>')
    );
  });

  it('wraps every item when a blank line separates them', async () => {
    await exporter.export({
      content: '- a\n\n- b\n',
      outputPath: '/tmp/loose-items.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<ul>\n<li><p>a</p></li>\n<li><p>b</p></li>\n</ul>');
    const ended = await exporter.export({
      content: '- a\n\nAfter\n',
      outputPath: '/tmp/ended-list.pdf',
    });
    expect(ended.ok).toBe(true);
    const endedUrl = mockLoadURL.mock.calls.at(-1)?.[0];
    const endedHtml = decodeURIComponent(
      String(endedUrl).replace('data:text/html;charset=utf-8,', '')
    );
    expect(endedHtml).toContain('<li>a</li>');
    expect(endedHtml).toContain('<p>After</p>');
  });

  it('nests a child list under its parent', async () => {
    await exporter.export({
      content: '- parent\n  - child',
      outputPath: '/tmp/nested.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<ul>\n<li>parent\n<ul>\n<li>child</li>\n</ul>\n</li>\n</ul>');
  });

  it('nests a block quote', async () => {
    await exporter.export({
      content: '> outer\n> > inner',
      outputPath: '/tmp/nested-quote.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain(
      '<blockquote>\n<p>outer</p>\n<blockquote>\n<p>inner</p>\n</blockquote>\n</blockquote>'
    );
    expect(html).not.toContain('&gt;');
  });

  it('renders a block quote', async () => {
    await exporter.export({
      content: '> Keep this\n> and this',
      outputPath: '/tmp/quote.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<blockquote>');
    expect(html).toContain('Keep this');
    expect(html).toContain('and this');
    expect(html).not.toContain('> Keep this');
  });

  it('keeps a short following line in the ordered item', async () => {
    await exporter.export({
      content: '1. one\n  outside\n\n1. two\n   inside',
      outputPath: '/tmp/ordered-wrap.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><p>one outside</p></li>');
    expect(html).toContain('<li><p>two inside</p></li>');
    expect(html).not.toContain('<p>outside</p>');
  });

  it('keeps a loose list continuation with the item', async () => {
    await exporter.export({
      content: '- item\n\n    continued\n\nAfter',
      outputPath: '/tmp/loose-list.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li><p>item</p><p>continued</p></li>');
    expect(html).not.toContain('<pre>');
    expect(html).toContain('After');
  });

  it('keeps a wrapped list item together', async () => {
    await exporter.export({
      content: '- item\n  continued\n\nAfter',
      outputPath: '/tmp/list-wrap.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li>item continued</li>');
    expect(html).toContain('After');
  });

  it('keeps a wrapped quote line inside the quote', async () => {
    await exporter.export({
      content: '> Keep this\nline too.\n\nAfter',
      outputPath: '/tmp/lazy-quote.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    const quote = html.slice(html.indexOf('<blockquote>'), html.indexOf('</blockquote>'));
    expect(quote).toContain('Keep this');
    expect(quote).toContain('line too.');
    expect(quote).not.toContain('After');
    expect(html).toContain('After');
  });

  it('keeps a footnote definition', async () => {
    await exporter.export({
      content: 'A footnote[^1].\n\n[^1]: Note',
      outputPath: '/tmp/note.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<sup><a href="#fn-1" id="fnref-1">1</a></sup>');
    expect(html).toContain(
      '<li><a href="#fnref-1" id="fn-1" class="footnote-backref">↩</a> Note</li>'
    );
    expect(html).toContain('Note');
    expect(html).toContain('Notes');
    expect(html).not.toContain('[^1]');
  });

  it('keeps a fenced block inside a footnote', async () => {
    await exporter.export({
      content: 'A[^1].\n\n[^1]: ```js\n    const x = 1\n    ```\n',
      outputPath: '/tmp/note-code.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('const');
    expect(html).not.toContain('<code>js const');
  });

  it('keeps a table inside a footnote', async () => {
    await exporter.export({
      content: 'A[^1].\n\n[^1]: | A | B |\n    | --- | --- |\n    | 1 | 2 |\n',
      outputPath: '/tmp/note-table.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<table>');
    expect(html).toContain('<td>1</td>');
    expect(html).toContain('<td>2</td>');
  });

  it('resolves a reference link', async () => {
    await exporter.export({
      content: 'See [the docs][guide].\n\n[guide]: https://example.com',
      outputPath: '/tmp/ref.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<a href="https://example.com">the docs</a>');
    expect(html).not.toContain('[guide]:');
  });

  it('keeps a reference title written beside the address', async () => {
    await exporter.export({
      content: 'See [the docs][guide].\n\n[guide]: https://example.com "Guide"\n',
      outputPath: '/tmp/ref-title.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<a href="https://example.com" title="Guide">the docs</a>');
  });

  it('keeps a wrapped paragraph and a hard break', async () => {
    await exporter.export({
      content: 'Hello\nworld\n\nStay  \nput',
      outputPath: '/tmp/wrap.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<p>Hello world</p>');
    expect(html).toContain('<p>Stay<br />put</p>');
  });

  it('renders a setext heading instead of a rule', async () => {
    await exporter.export({
      content: 'Title\n===\n\nRule\n\n---',
      outputPath: '/tmp/setext.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html).toContain('<hr />');
    expect(html).not.toContain('===');
  });

  it('renders a setext heading inside a quote', async () => {
    await exporter.export({
      content: '> Title\n> ===\n',
      outputPath: '/tmp/quote-setext.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html).not.toContain('===');
    const ruled = await exporter.export({
      content: '> Title\n---\n',
      outputPath: '/tmp/quote-rule.pdf',
    });
    expect(ruled.ok).toBe(true);
    const ruledUrl = mockLoadURL.mock.calls.at(-1)?.[0];
    const ruledHtml = decodeURIComponent(
      String(ruledUrl).replace('data:text/html;charset=utf-8,', '')
    );
    expect(ruledHtml).toContain('<p>Title</p>');
    expect(ruledHtml).toContain('<hr />');
    expect(ruledHtml).not.toContain('<h2');
  });

  it('renders a horizontal rule', async () => {
    await exporter.export({
      content: 'Above\n\n---\n\n* * *\n\nBelow',
      outputPath: '/tmp/rule.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<hr />');
    expect(html).toContain('Above');
    expect(html).toContain('Below');
    expect(html).not.toContain('---');
    expect(html).not.toContain('* * *');
  });

  it('renders a task checkbox', async () => {
    await exporter.export({
      content: '- [x] done\n- [ ] todo',
      outputPath: '/tmp/tasks.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<input type="checkbox" disabled checked />');
    expect(html).toContain('<input type="checkbox" disabled />');
    expect(html).toContain('done');
    expect(html).not.toContain('[x]');
    const loose = await exporter.export({
      content: '- [ ] one\n\n- [x] two\n',
      outputPath: '/tmp/loose-tasks.pdf',
    });
    expect(loose.ok).toBe(true);
    const looseUrl = mockLoadURL.mock.calls.at(-1)?.[0];
    const looseHtml = decodeURIComponent(
      String(looseUrl).replace('data:text/html;charset=utf-8,', '')
    );
    expect(looseHtml).toContain('<li><p><input type="checkbox" disabled /> one</p></li>');
    expect(looseHtml).toContain('<li><p><input type="checkbox" disabled checked /> two</p></li>');
  });

  it('renders a markdown table', async () => {
    await exporter.export({
      content: '| Name | Value |\n| --- | --- |\n| A | 1 |',
      outputPath: '/tmp/table.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>A</td>');
    expect(html).toContain('<td>1</td>');
    const short = await exporter.export({
      content: '| a | b |\n| - | - |\n| *c* | **d** |',
      outputPath: '/tmp/short-table.pdf',
    });
    expect(short.ok).toBe(true);
    const shortHtml = decodeURIComponent(
      String(mockLoadURL.mock.calls.at(-1)?.[0]).replace('data:text/html;charset=utf-8,', '')
    );
    expect(shortHtml).toContain('<th>a</th>');
    expect(shortHtml).toContain('<td><em>c</em></td>');
    expect(shortHtml).toContain('<td><strong>d</strong></td>');
    expect(shortHtml).not.toContain('| - |');
  });

  it('keeps an escaped pipe and a right-aligned column', async () => {
    await exporter.export({
      content: '| Item | Amount |\n| --- | ---: |\n| A \\| B | 2 |',
      outputPath: '/tmp/aligned-table.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<th>Item</th>');
    expect(html).toContain('<th style="text-align: right">Amount</th>');
    expect(html).toContain('<td>A | B</td>');
  });

  it('keeps a pipe inside a code span in a table cell', async () => {
    await exporter.export({
      content: '| Code | Note |\n| --- | --- |\n| `a|b` | ok |',
      outputPath: '/tmp/code-table.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<code>a|b</code>');
    expect(html).toContain('<td>ok</td>');
  });

  it('renders a table that omits its outer pipes', async () => {
    await exporter.export({
      content: 'Name | Value\n--- | ---\nA | 1',
      outputPath: '/tmp/open-table.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<td>A</td>');
    expect(html).toContain('<td>1</td>');
  });

  it('keeps an email autolink as one anchor', async () => {
    await exporter.export({
      content: 'Write <ada@example.com> today\n',
      outputPath: '/tmp/mailto.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<a href="mailto:ada@example.com">ada@example.com</a>');
    expect(html).not.toContain('<a href="mailto:ada@example.com"><a');
  });

  it('links an image', async () => {
    await exporter.export({
      content: '[![alt](a.png)](https://example.com)\n',
      outputPath: '/tmp/image-link.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<a href="https://example.com"><img src="a.png" alt="alt" /></a>');
  });

  it('keeps an escaped parenthesis and a spaced address in a link', async () => {
    await exporter.export({
      content: '[link](https://example.com/a\\(b\\))\n\n[spaced](<https://example.com/a b>)\n',
      outputPath: '/tmp/escaped-link.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<a href="https://example.com/a(b)">link</a>');
    expect(html).toContain('<a href="https://example.com/a%20b">spaced</a>');
    expect(html).not.toContain('katex');
  });

  it('keeps an inline HTML tag', async () => {
    await exporter.export({
      content: 'Say <em>hello</em> and a < b',
      outputPath: '/tmp/inline-html.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('Say <em>hello</em>');
    expect(html).toContain('a &lt; b');
  });

  it('keeps a one-line HTML block from being parsed again', async () => {
    await exporter.export({
      content: '<div>\n\nhello\n\n</div>\n',
      outputPath: '/tmp/html-one-line.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<div>\n<p>hello</p>\n</div>');
    expect(html).not.toContain('<p><div>');
    expect(html).not.toContain('<p></div>');
  });

  it('keeps a raw HTML block and escapes one inside code', async () => {
    await exporter.export({
      content: '<div>\nHello\n</div>\n\nAfter\n\n```\n<div>\n```\n',
      outputPath: '/tmp/html-block.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<div>\nHello\n</div>');
    expect(html).toContain('After');
    expect(html).toContain('&lt;div&gt;');
  });

  it('renders a TeX formula', async () => {
    await exporter.export({
      content: 'The area is \\(x^2\\).',
      outputPath: '/tmp/tex-math.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<math');
    expect(html).not.toContain('\\(x^2\\)');
  });

  it('renders a formula and a display block', async () => {
    await exporter.export({
      content: 'See $x^2$.\n$$\nE = mc^2\n$$',
      outputPath: '/tmp/math.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<math');
    expect(html).toContain('E = mc^2');
    expect(html).not.toContain('$x^2$');
  });

  it('writes PDF buffer to output path', async () => {
    const { writeFile } = await import('node:fs/promises');
    const options: ExportOptions = {
      content: '# Test',
      outputPath: '/tmp/output.pdf',
    };

    await exporter.export(options);

    expect(writeFile).toHaveBeenCalledWith('/tmp/output.pdf', Buffer.from('fake-pdf'));
  });

  it('destroys the hidden window after export', async () => {
    const options: ExportOptions = {
      content: 'content',
      outputPath: '/tmp/test.pdf',
    };

    await exporter.export(options);

    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('destroys the window when print fails and a text PDF is written', async () => {
    mockPrintToPDF.mockRejectedValueOnce(new Error('print failed'));

    const options: ExportOptions = {
      content: 'content',
      outputPath: '/tmp/fail.pdf',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('PDF print was unavailable, so a text PDF was written.');
    expect(mockDestroy).toHaveBeenCalledOnce();
  });

  it('does not destroy already-destroyed window', async () => {
    mockIsDestroyed.mockReturnValue(true);

    const options: ExportOptions = {
      content: 'content',
      outputPath: '/tmp/test.pdf',
    };

    await exporter.export(options);

    expect(mockDestroy).not.toHaveBeenCalled();
  });

  it('passes margin options from metadata', async () => {
    const options: ExportOptions = {
      content: 'content',
      outputPath: '/tmp/margins.pdf',
      metadata: {
        margins: { top: 1, right: 1, bottom: 1, left: 1 },
        landscape: true,
        pageSize: 'Letter',
      },
    };

    await exporter.export(options);

    expect(mockPrintToPDF).toHaveBeenCalledWith(
      expect.objectContaining({
        landscape: true,
        margins: { top: 1, right: 1, bottom: 1, left: 1 },
      })
    );
  });
});
