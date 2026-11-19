import { describe, expect, it } from 'vitest';

import { fenceIndentedCode } from './markdown-fence';
import {
  isLazyQuoteLine,
  quoteBody,
  quoteMarkerLine,
  quoteToHtml,
  quoteToLatex,
} from './markdown-quote';

describe('quoteBody', () => {
  it('reads a quote line and rejects plain text', () => {
    expect(quoteBody('> Keep this')).toBe('Keep this');
    expect(quoteBody('>')).toBe('');
    expect(quoteBody('not a quote')).toBeNull();
  });

  it('nests a quote inside a quote', () => {
    expect(quoteToHtml(['outer', '> inner'], (line) => line)).toBe(
      '<blockquote>\n<p>outer</p>\n<blockquote>\n<p>inner</p>\n</blockquote>\n</blockquote>'
    );
  });

  it('accepts a wrapped quote line and rejects a heading', () => {
    expect(isLazyQuoteLine('line too.')).toBe(true);
    expect(isLazyQuoteLine('# Heading')).toBe(false);
    expect(isLazyQuoteLine('- item')).toBe(false);
    expect(isLazyQuoteLine('')).toBe(false);
  });

  it('joins wrapped lines and renders a list inside a quote', () => {
    expect(quoteToHtml(['hello', 'there'], (line) => line)).toBe(
      '<blockquote>\n<p>hello there</p>\n</blockquote>'
    );
    expect(quoteToHtml(['hello', '', 'there'], (line) => line)).toBe(
      '<blockquote>\n<p>hello</p>\n<p>there</p>\n</blockquote>'
    );
    expect(quoteToHtml(['Stay  ', 'put'], (line) => line)).toBe(
      '<blockquote>\n<p>Stay<br />put</p>\n</blockquote>'
    );
    expect(quoteToLatex(['Stay\\', 'put'], (line) => line)).toBe(
      '\\begin{quote}\nStay\\\\\nput\n\\end{quote}'
    );
    const table = quoteToHtml(['| A | B |', '| --- | --- |', '| 1 | 2 |'], (line) => line);
    expect(table).toContain('<table>');
    expect(table).toContain('<td>1</td>');
    expect(quoteToLatex(['| A | B |', '| --- | ---: |', '| 1 | 2 |'], (line) => line)).toContain(
      '\\begin{tabular}'
    );
    expect(quoteToLatex(['- [x] done'], (line) => line)).toContain('$\\boxtimes$');
    expect(quoteToLatex(['- [x] done'], (line) => line)).not.toContain('[x]');
    const list = quoteToHtml(['- one', '- two'], (line) => line);
    expect(list).toContain('<ul>');
    expect(list).toContain('<li>one</li>');
    expect(list).toContain('<li>two</li>');
    expect(quoteToHtml(['- hello', '  world'], (line) => line)).toContain('<li>hello world</li>');
    expect(quoteToHtml(['- hello', '', 'After'], (line) => line)).toContain('<p>After</p>');
    expect(quoteToHtml(['- item', '', '  continued'], (line) => line)).toContain(
      '<li>item continued</li>'
    );
    expect(quoteToLatex(['- hello', '  world'], (line) => line)).toContain('\\item hello world');
    expect(quoteToLatex(['- Stay\\', '  put'], (line) => line)).toContain('\\item Stay\\\\\nput');
  });

  it('keeps a fenced block inside a quote', () => {
    const html = quoteToHtml(['```js', 'const x = 1', '```'], (line) => line);
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('const');
    expect(html).toContain('x =');
    expect(html).not.toContain('<p>');
    const latex = quoteToLatex(['```js', 'const x = 1', '```'], (line) => line);
    expect(latex).toContain('\\begin{verbatim}');
    expect(latex).toContain('const x = 1');
    expect(latex).not.toContain('```');
  });

  it('keeps a quoted sample that contains the verbatim closer', () => {
    const latex = quoteToLatex(['```', '\\end{verbatim}', 'still', '```'], (line) => line);
    const start = latex.indexOf('\\begin{mdxpadverb1}');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(latex.lastIndexOf('\\end{mdxpadverb1}')).toBeGreaterThan(start);
    expect(latex.slice(start, latex.lastIndexOf('\\end{mdxpadverb1}'))).toContain('still');
  });

  it('keeps indented code after a quoted list item', () => {
    const html = quoteToHtml(['- item', '', '      const x = 1'], (line) => line);
    const item = html.slice(html.indexOf('<li>'), html.indexOf('</li>'));
    expect(item).toContain('item');
    expect(item).toContain('<pre><code>const x = 1</code></pre>');
    const fenced = quoteToHtml(['- item', '', '  ```', '  const x = 1', '  ```'], (line) => line);
    const nested = quoteToHtml(
      ['- inner', '    ~~~', '    **not bold**', '    # not a heading', '    ~~~'],
      (line) => line
    );
    const nestedItem = nested.slice(nested.indexOf('<li>'), nested.lastIndexOf('</li>'));
    expect(nestedItem).toContain('<pre><code>**not bold**\n# not a heading</code></pre>');
    const separated = ['> - inner', '>', '>     ```', '>     const x = 1', '>     ```'].join('\n');
    const kept = quoteToHtml(fenceIndentedCode(separated).split('\n'), (line) => line);
    expect(kept).toContain('<pre><code>const x = 1</code></pre>');
    expect(kept).not.toContain('````');
    const fencedItem = fenced.slice(fenced.indexOf('<li>'), fenced.indexOf('</li>'));
    expect(fencedItem).toContain('<pre><code>const x = 1</code></pre>');
  });

  it('turns a quoted setext underline into a heading', () => {
    expect(quoteToHtml(['Title', quoteMarkerLine('===')], (line) => line)).toBe(
      '<blockquote>\n<h1 id="title">Title</h1>\n</blockquote>'
    );
    const second = quoteToHtml(['Title', quoteMarkerLine('---'), 'after'], (line) => line);
    expect(second).toContain('<h2 id="title">Title</h2>');
    expect(second).toContain('<p>after</p>');
    expect(quoteToHtml(['Title', '==='], (line) => line)).toContain('<p>Title ===</p>');
    expect(quoteToLatex(['Title', quoteMarkerLine('===')], (line) => line)).toContain(
      '\\section{Title}'
    );
    const code = quoteToHtml(['    const x = 1'], (line) => line);
    expect(code).toContain('<pre><code>');
    expect(code).toContain('const x = 1');
    expect(code).not.toContain('<p>');
    const continued = quoteToHtml(['    line1', '', '    line2'], (line) => line);
    expect(continued.match(/<pre>/g)).toHaveLength(1);
    expect(continued).toContain('line1\n\nline2');
    const ended = quoteToHtml(['    line1', '', 'after'], (line) => line);
    expect(ended).toContain('<pre><code>line1</code></pre>');
    expect(ended).toContain('<p>after</p>');
    const latex = quoteToLatex(['    line1', '', '    line2'], (line) => line);
    expect(latex.match(/\\begin\{verbatim\}/g)).toHaveLength(1);
    expect(latex).toContain('line1\n\nline2');
    expect(isLazyQuoteLine('---')).toBe(false);
    expect(isLazyQuoteLine('===')).toBe(true);
    expect(isLazyQuoteLine('***')).toBe(false);
  });

  it('wraps quote lines in a blockquote', () => {
    expect(quoteToHtml(['Keep **this**'], (line) => line)).toBe(
      '<blockquote>\n<p>Keep **this**</p>\n</blockquote>'
    );
  });
});
