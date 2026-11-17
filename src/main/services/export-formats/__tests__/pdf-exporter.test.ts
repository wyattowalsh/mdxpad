import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PdfExporter } from '../pdf-exporter';
import type { ExportOptions } from '../types';

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
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

  it('groups consecutive list items into one list', async () => {
    const options: ExportOptions = {
      content: '- one\n- two\n\n1. first\n2. second',
      outputPath: '/tmp/lists.pdf',
    };
    await exporter.export(options);
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
    expect(html).toContain('<ol>\n<li>first</li>\n<li>second</li>\n</ol>');
    expect(html).not.toContain('<ul><li>');
  });

  it('nests a child list under its parent', async () => {
    await exporter.export({
      content: '- parent\n  - child',
      outputPath: '/tmp/nested.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<ul>\n<li>parent</li>\n<ul>\n<li>child</li>\n</ul>\n</ul>');
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

  it('does not pull a short indent into an ordered item', async () => {
    await exporter.export({
      content: '1. one\n  outside\n\n1. two\n   inside',
      outputPath: '/tmp/ordered-wrap.pdf',
    });
    const loadedUrl = mockLoadURL.mock.calls[0]?.[0];
    const html = decodeURIComponent(String(loadedUrl).replace('data:text/html;charset=utf-8,', ''));
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<p>outside</p>');
    expect(html).toContain('<li>two inside</li>');
    expect(html).not.toContain('<li>one outside</li>');
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
    expect(html).toContain('footnote¹.');
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

  it('destroys window even on error', async () => {
    mockPrintToPDF.mockRejectedValueOnce(new Error('print failed'));

    const options: ExportOptions = {
      content: 'content',
      outputPath: '/tmp/fail.pdf',
    };

    const result = await exporter.export(options);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('print failed');
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
