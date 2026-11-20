import { describe, expect, it } from 'vitest';

import { renderDisplayMathBlock, renderMarkdownInline } from './markdown-inline-html';
import { markdownToPdfHtml } from './pdf-exporter';

describe('renderMarkdownInline', () => {
  it('drops a file hidden by a tab inside a css url', () => {
    const html = renderMarkdownInline(
      '<div style="background:url(file:\t///etc/passwd);color:red">x</div>'
    );
    expect(html).not.toContain('file:');
    expect(html).not.toContain('passwd');
    expect(html).toContain('color:red');
    const styled = renderMarkdownInline(
      '<svg><style>body{background:url(file:\n///etc/passwd);color:blue}</style></svg>'
    );
    expect(styled).not.toContain('file:');
    expect(styled).toContain('color:blue');
    const formFeed = renderMarkdownInline(
      '<div style="background:url(file:\f///etc/passwd);color:red">x</div>'
    );
    expect(formFeed).not.toContain('file:');
    expect(formFeed).not.toContain('passwd');
    expect(formFeed).toContain('color:red');
  });

  it('drops a file from a style element inside an svg', () => {
    const html = renderMarkdownInline(
      '<svg><style>body{background:url(file:///etc/passwd);color:red}</style>keep</svg>'
    );
    expect(html).not.toContain('file:');
    expect(html).toContain('color:red');
    expect(html).toContain('keep');
    const imported = renderMarkdownInline(
      '<svg><style>@import url(../secret.png); h1{color:blue}</style></svg>'
    );
    expect(imported).not.toContain('secret');
    expect(imported).toContain('color:blue');
  });

  it('omits a script inside an svg', () => {
    const html = renderMarkdownInline(
      '<svg><script src="file:///etc/passwd">alert(1)</script>keep</svg>'
    );
    expect(html).not.toContain('alert');
    expect(html).not.toContain('file:');
    expect(html).not.toContain('<script');
    expect(html).toContain('keep');
  });

  it('renders a raw ampersand, hash, and percent inside display math', () => {
    const ampersand = renderDisplayMathBlock(['a & b']);
    expect(ampersand).not.toContain('katex-error');
    expect(ampersand).toContain('&amp;');
    const hashed = renderDisplayMathBlock(['a # b']);
    expect(hashed).not.toContain('katex-error');
    const percent = renderDisplayMathBlock(['100%']);
    expect(percent).not.toContain('katex-error');
    expect(percent).toContain('%');
    const aligned = renderDisplayMathBlock(['\\begin{aligned}', 'a & b', '\\end{aligned}']);
    expect(aligned).not.toContain('katex-error');
    expect(aligned).toContain('a &amp; b');
    const words = renderDisplayMathBlock(['\\text{hello_world}']);
    expect(words).not.toContain('katex-error');
    expect(words).toContain('hello_world');
    const lines = renderDisplayMathBlock(['\\begin{multline}', 'a \\\\ b', '\\end{multline}']);
    expect(lines).not.toContain('katex-error');
    const stated = renderDisplayMathBlock(['\\begin{theorem}', 'The ice melts.', '\\end{theorem}']);
    expect(stated).not.toContain('katex-error');
    expect(stated).toContain('ice');
    const listed = renderDisplayMathBlock([
      '\\begin{itemize}',
      '\\item First item',
      '\\end{itemize}',
    ]);
    expect(listed).not.toContain('katex-error');
    expect(listed).toContain('First item');
    const grid = renderDisplayMathBlock(['\\begin{tabular}{ll}', 'Name & Cost \\\\ Tea & 2', '\\end{tabular}']);
    expect(grid).not.toContain('katex-error');
    expect(grid).toContain('Name');
    expect(grid).toContain('Tea');
    const figure = renderDisplayMathBlock(['\\begin{figure}', 'A figure about ice', '\\end{figure}']);
    expect(figure).not.toContain('katex-error');
    expect(figure).toContain('ice');
    const water = renderDisplayMathBlock(['\\ce{H2O}']);
    expect(water).not.toContain('katex-error');
    expect(water).toContain('H');
    expect(water).toContain('O');
  });

  it('renders an escaped dollar inside a formula', () => {
    const html = renderMarkdownInline('$\\$5$ and $a\\$b$');
    expect(html).not.toContain('katex-error');
    expect(html).toContain('5');
    expect(html).toContain('annotation encoding="application/x-tex">a\\$b</annotation>');
  });

  it('renders an image that is the label of a link', () => {
    expect(renderMarkdownInline('[![alt](a.png)](https://example.com)')).toBe(
      '<a href="https://example.com"><img src="a.png" alt="alt" /></a>'
    );
    expect(renderMarkdownInline('[![alt](a.png "Title")](https://example.com)')).toBe(
      '<a href="https://example.com"><img src="a.png" alt="alt" title="Title" /></a>'
    );
  });

  it('keeps a bracket inside code in the link label', () => {
    expect(renderMarkdownInline('[a `b](no) c`](https://example.com)')).toBe(
      '<a href="https://example.com">a <code>b](no) c</code></a>'
    );
    expect(
      renderMarkdownInline('[outer [inner](https://inner.example)](https://outer.example)')
    ).toBe('[outer <a href="https://inner.example">inner</a>](https://outer.example)');
  });

  it('keeps an email link as one anchor', () => {
    expect(renderMarkdownInline('[ada@example.com](mailto:ada@example.com)')).toBe(
      '<a href="mailto:ada@example.com">ada@example.com</a>'
    );
    expect(renderMarkdownInline('Write <ada@example.com> today')).toBe(
      'Write <a href="mailto:ada@example.com">ada@example.com</a> today'
    );
  });

  it('keeps a table inside a quoted list item', () => {
    const html = markdownToPdfHtml(
      '> - item\n>   | Name | Qty |\n>   | --- | --- |\n>   | Ada | 2 |\n'
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<td>Ada</td>');
    expect(html).toContain('<td>2</td>');
    expect(html).not.toContain('| --- |');
  });

  it('keeps an indented fence inside a quoted list item', () => {
    const html = markdownToPdfHtml('> - item\n>\n>   ```\ncode\n```\n\nafter\n');
    expect(html).toContain('<pre><code>code</code></pre>');
    expect(html).toContain('<p>after</p>');
    expect(html).not.toContain('<pre><code></code></pre>');
  });

  it('keeps a wrapped list fence inside a quote', () => {
    const html = markdownToPdfHtml('> - ```\n  code\n  ```\n\n  after\n');
    expect(html).toContain('<pre><code>');
    expect(html).toContain('code');
    expect(html).toContain('<p>after</p>');
    expect(html).not.toContain('<pre><code> after');
  });

  it('keeps a wrapped fence inside a nested quote', () => {
    const html = markdownToPdfHtml('> > ```\ncode\n```\n\nafter\n');
    const start = html.indexOf('<blockquote>', html.indexOf('<blockquote>') + 1);
    const inner = html.slice(start, html.indexOf('</blockquote>'));
    expect(inner).toContain('<pre><code>code</code></pre>');
    expect(html).toContain('<p>after</p>');
    expect(html).not.toContain('<p>code</p>');
  });

  it('keeps a wrapped line inside a nested quote', () => {
    const innerQuote = (html: string): string => {
      const start = html.indexOf('<blockquote>', html.indexOf('<blockquote>') + 1);
      return html.slice(start, html.indexOf('</blockquote>'));
    };
    const html = markdownToPdfHtml('> > nested\nstill\n\nafter\n');
    const inner = innerQuote(html);
    expect(inner).toContain('nested');
    expect(inner).toContain('still');
    expect(html).toContain('<p>after</p>');
    const marked = innerQuote(markdownToPdfHtml('> > nested\n> still\n'));
    expect(marked).toContain('nested');
    expect(marked).toContain('still');
  });

  it('underlines a paragraph inside a list item', () => {
    const html = markdownToPdfHtml('- item\n\n  Title\n  =====\n\n  after\n');
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html).toContain('item');
    expect(html).toContain('<p>after</p>');
    expect(html).not.toContain('=====');
    const dashes = markdownToPdfHtml('- item\n\n  Title\n  -----\n\n  after\n');
    expect(dashes).toContain('<h2 id="title">Title</h2>');
    expect(dashes).toContain('<p>after</p>');
    expect(dashes).not.toContain('<hr />');
  });

  it('underlines a quoted paragraph when the marks are on the next line', () => {
    const equals = markdownToPdfHtml('> Title\n=====\n\nafter\n');
    expect(equals).toContain('<h1 id="title">Title</h1>');
    expect(equals).toContain('<p>after</p>');
    expect(equals).not.toContain('=====');
    const rule = markdownToPdfHtml('> Title\n---\n\nafter\n');
    expect(rule).toContain('<p>Title</p>');
    expect(rule).toContain('<hr />');
    expect(rule).not.toContain('<h2');
  });

  it('renders a heading inside a quote', () => {
    const html = markdownToPdfHtml('> # Title\n\nafter\n');
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html).toContain('<p>after</p>');
    expect(html).not.toContain('# Title');
    const followed = markdownToPdfHtml('> # Title\nbody\n');
    expect(followed).toContain('<h1 id="title">Title</h1>');
    expect(followed).toContain('<p>body</p>');
    expect(followed).not.toContain('# Title body');
    const kept = markdownToPdfHtml('> # Title\n> body\n');
    const quote = kept.slice(kept.indexOf('<blockquote>'), kept.indexOf('</blockquote>'));
    expect(quote).toContain('<h1 id="title">Title</h1>');
    expect(quote).toContain('body');
  });

  it('keeps a wrapped code fence and table inside the quote', () => {
    const code = markdownToPdfHtml('> ```\ncode\n```\n\nafter\n');
    expect(code).toContain('<pre><code>code</code></pre>');
    expect(code).toContain('<p>after</p>');
    expect(code).not.toContain('<pre><code> after </code></pre>');
    const table = markdownToPdfHtml('> | A | B |\n| --- | --- |\n| 1 | 2 |\n\nafter\n');
    const quote = table.slice(table.indexOf('<blockquote>'), table.indexOf('</blockquote>'));
    expect(quote).toContain('<table>');
    expect(quote).toContain('<td>1</td>');
    expect(table).toContain('<p>after</p>');
  });

  it('renders the formula after a price', () => {
    const html = markdownToPdfHtml('Pay $5 then $a*b$.\n');
    expect(html).toContain('Pay $5 then');
    expect(html).toContain('annotation encoding="application/x-tex">a*b</annotation>');
    expect(html).not.toContain('$5 then $a*b$');
  });

  it('keeps escaped backslashes in a link label', () => {
    const html = markdownToPdfHtml('See [\\\\(x\\\\\\)](https://example.com)\n');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('\\(x\\)');
    expect(html).not.toContain('$x');
  });

  it('keeps a quoted formula inside its list item', () => {
    const html = markdownToPdfHtml('- item\n\n  > quote $$\n  > x^2\n  > $$\n  > more\n');
    const item = html.slice(html.indexOf('<li>'), html.lastIndexOf('</li>'));
    expect(item).toContain('<blockquote>');
    expect(item).toContain('quote');
    expect(item).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(item).toContain('more');
    expect(item).not.toContain('&gt; x');
  });

  it('keeps a later formula inside its list item', () => {
    const html = markdownToPdfHtml('- item\n\n  Text $$\n  x^2\n  $$\n  more\n');
    const item = html.slice(html.indexOf('<li>'), html.lastIndexOf('</li>'));
    expect(item).toContain('item');
    expect(item).toContain('Text');
    expect(item).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(item).toContain('more');
  });

  it('closes a list formula on the last formula line', () => {
    const html = markdownToPdfHtml('1. Text $$\n   x^2 $$\n   more\n');
    expect(html).toContain('<li>');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain('more');
    expect(html).not.toContain('katex-error');
  });

  it('keeps a formula that opens at the end of a list item', () => {
    const html = markdownToPdfHtml('- Text $$\n  x^2\n  $$\n  more\n');
    expect(html).toContain('<li>');
    expect(html).toContain('Text');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain('<p>more</p>');
    expect(html).not.toContain('<p>- Text</p>');
    const ordered = markdownToPdfHtml('1. $$\n   x^2\n   $$\n   after\n');
    expect(ordered).toContain('<ol>');
    expect(ordered).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(ordered).toContain('after');
    expect(ordered).not.toContain('<p>1.</p>');
  });

  it('keeps a blank line inside a quoted formula', () => {
    const html = markdownToPdfHtml('> Text $$\n>\n> x^2\n>\n> $$\n>\n> more\n');
    expect(html).toContain('<p>Text</p>');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain('<p>more</p>');
    expect(html).not.toContain('<p>x^2</p>');
    expect(html).not.toContain('<p>$$</p>');
  });

  it('keeps a quoted formula that opens at the end of a line', () => {
    const html = markdownToPdfHtml('> Text $$\n> x^2\n> $$\n>\n> more\n');
    expect(html).toContain('<p>Text</p>');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain('<p>more</p>');
    expect(html).not.toContain('&gt; x');
  });

  it('returns to the outer quote after a blank line', () => {
    const html = markdownToPdfHtml('> > one\n>\n> two\n');
    const innerEnd = html.indexOf('</blockquote>');
    expect(html.indexOf('<p>one</p>')).toBeLessThan(innerEnd);
    expect(html.indexOf('<p>two</p>')).toBeGreaterThan(innerEnd);
    expect(html.lastIndexOf('</blockquote>')).toBeGreaterThan(html.indexOf('<p>two</p>'));
    const joined = markdownToPdfHtml('> > one\n> two\n');
    expect(joined).toContain('one two');
    expect(joined.match(/<blockquote>/g)).toHaveLength(2);
  });

  it('keeps a blank line inside a quoted list item', () => {
    const html = markdownToPdfHtml('> - item\n>\n>   more\n');
    expect(html).toContain('<p>item</p>');
    expect(html).toContain('<p>more</p>');
    expect(html).not.toContain('item more');
  });

  it('renders an empty heading', () => {
    const html = markdownToPdfHtml('#\n\nbody\n');
    expect(html).toContain('<h1 id="section"></h1>');
    expect(html).toContain('<p>body</p>');
    expect(html).not.toContain('<p>#</p>');
    expect(markdownToPdfHtml('#foo\n')).toContain('<p>#foo</p>');
    expect(markdownToPdfHtml('- #\n')).toContain('<h1 id="section"></h1>');
    expect(markdownToPdfHtml('> #\n')).toContain('<h1 id="section"></h1>');
  });

  it('keeps an html block inside the list item', () => {
    const html = markdownToPdfHtml('- <div>\n  bar\n  </div>\n');
    expect(html.indexOf('</div>')).toBeLessThan(html.indexOf('</ul>'));
    expect(html).toContain('bar');
    const loose = markdownToPdfHtml('- <div>\n\n  bar\n\n  </div>\n');
    expect(loose.indexOf('<div>')).toBeLessThan(loose.indexOf('<p>bar</p>'));
    expect(loose.indexOf('<p>bar</p>')).toBeLessThan(loose.indexOf('</div>'));
    expect(loose.indexOf('</div>')).toBeLessThan(loose.indexOf('</ul>'));
    expect(loose).not.toContain('<p><div>');
    expect(loose).not.toContain('<p></div>');
    const after = markdownToPdfHtml('- item\n\n<div>\nbar\n</div>\n');
    expect(after.indexOf('</ul>')).toBeLessThan(after.indexOf('<div>'));
  });

  it('drops the list indent inside a wrapped code span', () => {
    expect(markdownToPdfHtml('- `a\n  b`\n')).toContain('<code>a b</code>');
    expect(markdownToPdfHtml('- `a\n    b`\n')).toContain('<code>a   b</code>');
    expect(markdownToPdfHtml('1. `a\n   b`\n')).toContain('<code>a b</code>');
    expect(markdownToPdfHtml('`a\n  b`\n')).toContain('<code>a   b</code>');
  });

  it('keeps the paragraph after quoted code in the quote', () => {
    const html = markdownToPdfHtml('> item\n>\n>     code\n>\n> after\n');
    const quote = html.slice(html.indexOf('<blockquote>'), html.lastIndexOf('</blockquote>'));
    expect(quote).toContain('<pre><code>code</code></pre>');
    expect(quote).toContain('<p>after</p>');
    expect(html.match(/<blockquote>/g)).toHaveLength(1);
  });

  it('keeps a nested list inside a quoted item', () => {
    const html = markdownToPdfHtml('> - 3. three\n>   4. four\n');
    expect(html).toContain('<ol start="3">');
    expect(html).toContain('<li>three</li>');
    expect(html).toContain('<li>four</li>');
    expect(html).not.toContain('3. three');
    expect(html.indexOf('<ol')).toBeLessThan(html.indexOf('</ul>'));
    const bullets = markdownToPdfHtml('> - - nested\n');
    expect(bullets.match(/<ul>/g)).toHaveLength(2);
    expect(bullets).toContain('<li>nested</li>');
  });

  it('keeps a list marker inside an item as a nested list', () => {
    const ordered = markdownToPdfHtml('- 3. three\n  4. four\n');
    expect(ordered).toContain('<ol start="3">');
    expect(ordered).toContain('<li>three</li>');
    expect(ordered).toContain('<li>four</li>');
    expect(ordered).not.toContain('3. three');
    expect(ordered.indexOf('<ol')).toBeLessThan(ordered.indexOf('</ul>'));
    const bullets = markdownToPdfHtml('- - nested\n');
    expect(bullets.match(/<ul>/g)).toHaveLength(2);
    expect(bullets).toContain('<li>nested</li>');
    expect(bullets).not.toContain('- nested');
    const continued = markdownToPdfHtml('- 3. three\n  more\n');
    expect(continued).toContain('three more');
    expect(continued).not.toContain('3. three');
  });

  it('keeps an empty list marker as a list', () => {
    const paired = markdownToPdfHtml('-\n-\n');
    expect(paired).toContain('<ul>');
    expect(paired.match(/<li>/g)).toHaveLength(2);
    expect(paired).not.toContain('<h2');
    const followed = markdownToPdfHtml('-\nfoo\n');
    expect(followed.indexOf('</ul>')).toBeLessThan(followed.indexOf('foo'));
    expect(followed).toContain('<p>foo</p>');
    const filled = markdownToPdfHtml('-\n  foo\n');
    expect(filled).toContain('<li>foo</li>');
    expect(filled).not.toContain('<p>- foo</p>');
    const ordered = markdownToPdfHtml('1.\n2.\n');
    expect(ordered).toContain('<ol');
    expect(ordered.match(/<li>/g)).toHaveLength(2);
    const quoted = markdownToPdfHtml('> -\n> -\n');
    expect(quoted).toContain('<ul>');
    expect(quoted).not.toContain('<h2');
    const heading = markdownToPdfHtml('> Title\n> -\n');
    expect(heading).toContain('<h2 id="title">Title</h2>');
    expect(heading).not.toContain('<ul');
  });

  it('renders a spaced rule inside a quote', () => {
    const html = markdownToPdfHtml('> * * *\n');
    expect(html).toContain('<hr />');
    expect(html).not.toContain('<ul');
    const nested = markdownToPdfHtml('> > * * *\n');
    expect(nested).toContain('<hr />');
    expect(nested).not.toContain('<li>');
  });

  it('keeps a heading inside a quoted list item', () => {
    const html = markdownToPdfHtml('> - item\n>   # Title\n>   body\n');
    expect(html).toContain('<h1 id="title">Title</h1>');
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('</ul>'));
    expect(html.indexOf('body')).toBeLessThan(html.indexOf('</ul>'));
    expect(html).toContain('item');
  });

  it('renders a thematic break inside a quote', () => {
    const tight = markdownToPdfHtml('> quote\n> ***\n> after\n');
    const quote = tight.slice(tight.indexOf('<blockquote>'), tight.lastIndexOf('</blockquote>'));
    expect(quote).toContain('<p>quote</p>');
    expect(quote).toContain('<hr />');
    expect(quote).toContain('<p>after</p>');
    expect(quote).not.toContain('***');
    const alone = markdownToPdfHtml('> ***\n');
    expect(alone).toContain('<hr />');
    expect(alone).not.toContain('***');
    const spaced = markdownToPdfHtml('> quote\n>\n> ---\n>\n> after\n');
    expect(spaced).toContain('<hr />');
    expect(spaced).not.toContain('---');
    expect(spaced.indexOf('<p>quote</p>')).toBeLessThan(spaced.indexOf('<hr />'));
    const heading = markdownToPdfHtml('> quote\n> ---\n> after\n');
    expect(heading).toContain('<h2 id="quote">quote</h2>');
    expect(heading).not.toContain('<hr />');
    const listed = markdownToPdfHtml('> - item\n>   ***\n>   after\n');
    expect(listed.indexOf('<hr />')).toBeLessThan(listed.indexOf('</ul>'));
    expect(listed).toContain('after');
    expect(listed).not.toContain('***');
  });

  it('keeps a heading inside the list item', () => {
    const html = markdownToPdfHtml('- item\n\n  # Title\n\n  body\n');
    expect(html).toContain('<h1');
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('</ul>'));
    expect(html.indexOf('body')).toBeLessThan(html.indexOf('</ul>'));
    const tight = markdownToPdfHtml('- item\n  # Title\n');
    expect(tight.indexOf('<h1')).toBeLessThan(tight.indexOf('</ul>'));
  });

  it('keeps a tight indented line inside the list paragraph', () => {
    const html = markdownToPdfHtml('- item\n      code\n');
    expect(html).toContain('item');
    expect(html).toContain('code');
    expect(html).not.toContain('<pre>');
    const loose = markdownToPdfHtml('- item\n\n      code\n');
    expect(loose).toContain('<pre><code>code</code></pre>');
  });

  it('keeps a nested quote marker inside a quoted formula', () => {
    const html = markdownToPdfHtml('> $$\n> > nested\n> $$\n');
    expect(html).toContain('&gt; nested');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('<blockquote>\n<blockquote>');
  });

  it('leaves the next lines in place when a list formula never closes', () => {
    const html = markdownToPdfHtml('- Text $$\n  more\n\nafter\n');
    expect(html).toContain('Text $$');
    expect(html).toContain('more');
    expect(html).toContain('after');
    expect(html).not.toContain('annotation encoding="application/x-tex">');
    const quoted = markdownToPdfHtml('> Text $$\n> more\n');
    expect(quoted).toContain('Text $$');
    expect(quoted).toContain('more');
    expect(quoted).not.toContain('annotation encoding="application/x-tex">');
  });

  it('leaves the next paragraph in place when a formula never closes', () => {
    const html = markdownToPdfHtml('Text $$\n\nmore\n');
    expect(html).toContain('Text $$');
    expect(html).toContain('<p>more</p>');
    expect(html).not.toContain('annotation encoding="application/x-tex">');
    const quoted = markdownToPdfHtml('Text $$\n\n> inside\n\n$$\n');
    expect(quoted).toContain('<blockquote>');
    expect(quoted).toContain('inside');
    expect(quoted).not.toContain('&gt; inside');
  });

  it('keeps the paragraph after a formula that opens at the end of a line', () => {
    const html = markdownToPdfHtml('Text $$\nx^2\n$$\nmore\n');
    expect(html).toContain('<p>Text</p>');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain('<p>more</p>');
    expect(html).not.toContain('<mi>m</mi>');
    const spaced = markdownToPdfHtml('Text $$\nx^2\n$$\n\nmore\n');
    expect(spaced).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(spaced).toContain('<p>more</p>');
  });

  it('keeps a wrapped display formula inside the quote', () => {
    const html = markdownToPdfHtml('> $$\nx^2\n$$\n\nafter\n');
    expect(html).toContain('x^2');
    expect(html).toContain('<p>after</p>');
    expect(html).not.toContain('> after </annotation>');
    const separate = markdownToPdfHtml('> quote\n\n$$\nx^2\n$$\n\nafter\n');
    expect(separate).toContain('<blockquote>');
    expect(separate).toContain('x^2');
    expect(separate).toContain('<p>after</p>');
  });

  it('leaves YAML metadata out of the exported document', () => {
    const html = markdownToPdfHtml('---\ntitle: Hello\nauthor: Ada\n---\n\nBody text.\n');
    expect(html).toContain('Body text.');
    expect(html).not.toContain('title: Hello');
    expect(html).not.toContain('author: Ada');
    expect(html).not.toContain('<h2');
    const rule = markdownToPdfHtml('---\n\nBody text.\n');
    expect(rule).toContain('<hr />');
    expect(rule).toContain('Body text.');
  });

  it('renders emphasis inside a formula that contains a link', () => {
    const html = markdownToPdfHtml('See \\(x **and** [a](https://example.com) y\\).');
    expect(html).toContain('class="katex"');
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('$x');
    expect(html).not.toContain('<strong>');
  });

  it('keeps paragraphs after a nested list', () => {
    const html = markdownToPdfHtml('- alpha\n  - nested\n\n  beta\n\n  gamma\n');
    expect(html).toContain('alpha');
    expect(html).toContain('nested');
    expect(html).toContain('beta');
    expect(html).toContain('gamma');
  });

  it('keeps every paragraph of a footnote', () => {
    const html = markdownToPdfHtml('See[^long].\n\n[^long]: one\n\n    two\n\n    three words\n');
    expect(html).toContain('one');
    expect(html).toContain('two');
    expect(html).toContain('three words');
  });

  it('keeps a formula after a dollar sign glued to a word', () => {
    const html = markdownToPdfHtml('Path C:$foo and $x^2$.');
    expect(html).toContain('C:$foo');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    const kept = markdownToPdfHtml('Value ($x^2$) still works.');
    expect(kept).toContain('annotation encoding="application/x-tex">x^2</annotation>');
  });

  it('keeps a formula after a dollar sign inside parentheses', () => {
    const html = markdownToPdfHtml('See (notes $a) and $x^2$.');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain('(notes $a)');
    const wrapped = markdownToPdfHtml('Value ($x^2$) and ($a$ or $b$).');
    expect(wrapped).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(wrapped).toContain('annotation encoding="application/x-tex">a</annotation>');
    expect(wrapped).toContain('annotation encoding="application/x-tex">b</annotation>');
  });

  it('keeps a formula after a dollar sign in a reference label', () => {
    const html = markdownToPdfHtml('See [a$b] and $x^2$.\n\n[a$b]: https://example.com/guide\n');
    expect(html).toContain('href="https://example.com/guide"');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain('>a$b</a>');
    const labeled = markdownToPdfHtml('[size $n^2$](https://example.com)');
    expect(labeled).toContain('href="https://example.com"');
    expect(labeled).toContain('annotation encoding="application/x-tex">n^2</annotation>');
  });

  it('keeps a formula beside a parenthetical address', () => {
    const html = markdownToPdfHtml('See (https://example.com/a$b) and $x^2$.');
    expect(html).toContain('href="https://example.com/a$b"');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain('(<a ');
    expect(html).toContain('</a>)');
  });

  it('keeps a formula after a dollar sign in an email', () => {
    const html = markdownToPdfHtml('Mail ada$b@example.com and $x^2$.');
    expect(html).toContain('annotation encoding="application/x-tex">x^2</annotation>');
    expect(html).toContain('ada$b@example.com');
    expect(html).not.toContain('textasciicircum');
  });

  it('renders a display formula that contains a link', () => {
    const html = markdownToPdfHtml('See \\[x and [a](https://example.com) y\\].');
    expect(html).toContain('class="katex"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('>a</a>');
    expect(html).not.toContain('$$');
    expect(html).not.toContain('[a](https://example.com)');
  });

  it('renders a formula that contains a link', () => {
    const html = markdownToPdfHtml('See \\(x and [a \\)](https://example.com) y\\).');
    expect(html).toContain('class="katex"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('>a )</a>');
    expect(html).not.toContain('$x');
    const price = renderMarkdownInline('Price $5 and [link](https://example.com/$10) more $x$.');
    expect(price).toContain('href="https://example.com/$10"');
    expect(price).toContain('annotation encoding="application/x-tex">x</annotation>');
    expect(price).not.toContain('class="katex">5');
  });

  it('renders a formula that contains inline code', () => {
    const html = markdownToPdfHtml('See \\(x `y`\\).');
    expect(html).toContain('class="katex"');
    expect(html).toContain('x `y`');
  });

  it('does not let a later dollar close a price or a code span', () => {
    const price = renderMarkdownInline('Price $5 and [link](https://example.com/$10).');
    expect(price).toContain('href="https://example.com/$10"');
    expect(price).toContain('>link</a>');
    expect(price).not.toContain('katex');
    const coded = renderMarkdownInline('Before $ and `code $ inside` then $x$.');
    expect(coded).toContain('<code>code $ inside</code>');
    expect(coded).toContain('annotation encoding="application/x-tex">x</annotation>');
    const labeled = renderMarkdownInline('See $x and [link $](https://example.com).');
    expect(labeled).toContain('href="https://example.com"');
    expect(labeled).toContain('>link $</a>');
  });

  it('renders an image instead of a link with a stray exclamation mark', () => {
    expect(renderMarkdownInline('![A photo](photo.jpg)')).toBe(
      '<img src="photo.jpg" alt="A photo" />'
    );
    expect(renderMarkdownInline('![*alt*](a.png)')).toBe('<img src="a.png" alt="alt" />');
    expect(renderMarkdownInline('![a *b* c](a.png)')).toBe('<img src="a.png" alt="a b c" />');
    expect(renderMarkdownInline('![`code`](a.png)')).toBe('<img src="a.png" alt="code" />');
    expect(renderMarkdownInline('![alt $x^2$](a.png)')).toBe('<img src="a.png" alt="alt x^2" />');
    expect(renderMarkdownInline('[text](https://example.com "see \\(x\\)")')).toBe(
      '<a href="https://example.com" title="see \\(x\\)">text</a>'
    );
    expect(renderMarkdownInline('[docs](https://example.com)')).toBe(
      '<a href="https://example.com">docs</a>'
    );
  });

  it('points a capitalized heading link at the heading slug', () => {
    expect(renderMarkdownInline('[Two](#Two)')).toBe('<a href="#two">Two</a>');
    expect(renderMarkdownInline('[It](<#Hello World>)')).toBe('<a href="#hello-world">It</a>');
    expect(renderMarkdownInline('[note](#fn-1)')).toBe('<a href="#fn-1">note</a>');
  });

  it('renders bold italic from three markers', () => {
    expect(renderMarkdownInline('***both***')).toBe('<em><strong>both</strong></em>');
    expect(renderMarkdownInline('___both___')).toBe('<em><strong>both</strong></em>');
    expect(renderMarkdownInline('a * b * c')).toBe('a * b * c');
    expect(renderMarkdownInline('***foo** bar*')).toBe('<em><strong>foo</strong> bar</em>');
    expect(renderMarkdownInline('**foo *bar***')).toBe('<strong>foo <em>bar</em></strong>');
    expect(renderMarkdownInline('_foo_bar_')).toBe('<em>foo_bar</em>');
    expect(renderMarkdownInline('snake_case_name')).toBe('snake_case_name');
    expect(renderMarkdownInline('*foo *bar* baz*')).toBe('<em>foo <em>bar</em> baz</em>');
    expect(renderMarkdownInline('**bold *inner* text**')).toBe(
      '<strong>bold <em>inner</em> text</strong>'
    );
    expect(renderMarkdownInline('*italic **bold** text*')).toBe(
      '<em>italic <strong>bold</strong> text</em>'
    );
    expect(renderMarkdownInline('**[docs](https://example.com)**')).toBe(
      '<strong><a href="https://example.com">docs</a></strong>'
    );
    expect(renderMarkdownInline('[**docs**](https://example.com)')).toBe(
      '<a href="https://example.com"><strong>docs</strong></a>'
    );
  });

  it('keeps a backtick inside a longer code span', () => {
    expect(renderMarkdownInline('Use `` a`b `` here')).toBe('Use <code>a`b</code> here');
    expect(renderMarkdownInline('`` ` ``')).toBe('<code>`</code>');
    expect(renderMarkdownInline('`a < b`')).toBe('<code>a &lt; b</code>');
    expect(renderMarkdownInline('`` use \\* star ``')).toBe('<code>use \\* star</code>');
  });

  it('renders emphasis, code, and links', () => {
    expect(renderMarkdownInline('**bold** and _italic_ and `code` and ~~gone~~')).toBe(
      '<strong>bold</strong> and <em>italic</em> and <code>code</code> and <del>gone</del>'
    );
    expect(renderMarkdownInline('~~`code`~~')).toBe('<del><code>code</code></del>');
    expect(renderMarkdownInline('~~hello `x`~~')).toBe('<del>hello <code>x</code></del>');
    expect(renderMarkdownInline('`~~not~~`')).toBe('<code>~~not~~</code>');
    expect(renderMarkdownInline('[docs](https://example.com)')).toBe(
      '<a href="https://example.com">docs</a>'
    );
    expect(renderMarkdownInline('[empty]()')).toBe('<a href="">empty</a>');
    expect(renderMarkdownInline('[link](</url>)')).toBe('link');
  });

  it('keeps an escaped asterisk literal', () => {
    expect(renderMarkdownInline('\\*not italic\\* and **real**')).toBe(
      '*not italic* and <strong>real</strong>'
    );
    expect(renderMarkdownInline('\\[docs](https://example.com)')).toBe(
      '[docs](https://example.com)'
    );
    expect(renderMarkdownInline('[a\\[b\\]](https://example.com)')).toBe(
      '<a href="https://example.com">a[b]</a>'
    );
    expect(markdownToPdfHtml('[a\\[b\\]](https://example.com)\n')).toContain(
      '<a href="https://example.com">a[b]</a>'
    );
    expect(markdownToPdfHtml('[a\\[b\\]](https://example.com)\n')).not.toContain('katex');
  });

  it('links a www address and a bare email', () => {
    expect(renderMarkdownInline('Visit www.example.com and ada@example.com.')).toBe(
      'Visit <a href="http://www.example.com">www.example.com</a> and <a href="mailto:ada@example.com">ada@example.com</a>.'
    );
  });

  it('links an autolink and leaves a code span alone', () => {
    expect(renderMarkdownInline('See <https://example.com> and https://example.com.')).toBe(
      'See <a href="https://example.com">https://example.com</a> and <a href="https://example.com">https://example.com</a>.'
    );
    expect(renderMarkdownInline('`https://example.com`')).toBe('<code>https://example.com</code>');
  });

  it('keeps parentheses inside a link address', () => {
    expect(renderMarkdownInline('[wiki](https://en.wikipedia.org/wiki/Markdown_(markup))')).toBe(
      '<a href="https://en.wikipedia.org/wiki/Markdown_(markup)">wiki</a>'
    );
  });

  it('keeps a quotation mark inside a link address', () => {
    expect(renderMarkdownInline('[go](https://example.com/a"b)')).toBe(
      '<a href="https://example.com/a%22b">go</a>'
    );
  });

  it('keeps a link title out of the address', () => {
    expect(renderMarkdownInline('[docs](https://example.com "Docs")')).toBe(
      '<a href="https://example.com" title="Docs">docs</a>'
    );
    expect(renderMarkdownInline('[docs](<https://example.com>)')).toBe(
      '<a href="https://example.com">docs</a>'
    );
    expect(renderMarkdownInline('[docs]( <https://example.com> )')).toBe(
      '<a href="https://example.com">docs</a>'
    );
    expect(renderMarkdownInline('[docs]( https://example.com )')).toBe(
      '<a href="https://example.com">docs</a>'
    );
    expect(renderMarkdownInline('[docs](<https://example.com/a\\>b>)')).toBe(
      '<a href="https://example.com/a%3Eb">docs</a>'
    );
    expect(renderMarkdownInline('[docs](<https://example.com/a\\<b>)')).toBe(
      '<a href="https://example.com/a%3Cb">docs</a>'
    );
    expect(renderMarkdownInline('![A photo](photo.jpg "A photo")')).toBe(
      '<img src="photo.jpg" alt="A photo" title="A photo" />'
    );
    expect(renderMarkdownInline('[a](b "title with)paren")')).toBe(
      '<a href="b" title="title with)paren">a</a>'
    );
  });

  it('renders a formula and leaves a price as text', () => {
    const formula = renderMarkdownInline('See $x^2$ and $5 and $10');
    expect(formula).toContain('<math');
    expect(formula).toContain('$5 and $10');
    expect(formula).not.toContain('$x^2$');
    const bold = renderMarkdownInline('**$x^2$**');
    expect(bold).toContain('<strong>');
    expect(bold).toContain('<math');
    expect(bold).not.toContain('**');
    const linked = renderMarkdownInline('[$x^2$](https://example.com)');
    expect(linked).toContain('<a href="https://example.com">');
    expect(linked).toContain('<math');
    expect(linked).not.toContain('](https://example.com)');
    expect(renderMarkdownInline('`$x$`')).toBe('<code>$x$</code>');
    const starred = renderMarkdownInline('$a*b*c$');
    expect(starred).toContain('<math');
    expect(starred).not.toContain('<em>');
    const words = renderMarkdownInline('Compare $n and m$');
    expect(words).toContain('<math');
    expect(words).not.toContain('$n and m$');
  });

  it('decodes a character reference and leaves one inside code', () => {
    expect(renderMarkdownInline('AT&amp;T and &lt;tag&gt;')).toBe('AT&amp;T and &lt;tag&gt;');
    expect(markdownToPdfHtml('a\\<b\n')).toBe('<p>a&lt;b</p>');
    expect(markdownToPdfHtml('foo\\\n\nbar\n')).toContain('<p>foo\\</p>');
    expect(markdownToPdfHtml('foo\\\nbar\n')).toContain('<br />');
    expect(markdownToPdfHtml('foo\\\nbar\n')).not.toContain('foo\\');
    expect(markdownToPdfHtml('em\n* \n')).toBe('<p>em *</p>');
    expect(markdownToPdfHtml('em\n* star\n')).toContain('<li>star</li>');
    expect(markdownToPdfHtml('- one\n  *\n')).toContain('one *');
    expect(markdownToPdfHtml('- one\n  *\n')).not.toContain('<ul class="star">');
    expect(markdownToPdfHtml('- one\n  * nested\n')).toContain('<ul class="star">');
    expect(markdownToPdfHtml('> quote\n> *\n')).toContain('quote *');
    expect(markdownToPdfHtml('> quote\n> *\n')).not.toContain('<ul class="star">');
    expect(markdownToPdfHtml('> - one\n>   *\n')).toContain('one *');
    expect(markdownToPdfHtml('> - one\n>   *\n')).not.toContain('<ul class="star">');
    expect(markdownToPdfHtml('> - one\n>   * nested\n')).toContain('<ul class="star">');
    expect(markdownToPdfHtml('- one\r\n- two\r\n')).toBe(markdownToPdfHtml('- one\n- two\n'));
    expect(markdownToPdfHtml('A\\\r\nB\r\n')).toContain('<br />');
    expect(markdownToPdfHtml('> quote\r\n> next\r\n')).toContain('<blockquote>');
    expect(markdownToPdfHtml('- [x] done\r\n')).toContain('checked');
    expect(renderMarkdownInline('==hi==')).toBe('<mark>hi</mark>');
    expect(renderMarkdownInline('++hi++')).toBe('<u>hi</u>');
    expect(renderMarkdownInline('H~2~O and x^2^')).toBe('H<sub>2</sub>O and x<sup>2</sup>');
    expect(renderMarkdownInline('a ~ b and c ^ d')).toBe('a ~ b and c ^ d');
    expect(renderMarkdownInline('~~gone~~')).toBe('<del>gone</del>');
    expect(renderMarkdownInline('a == b')).toBe('a == b');
    expect(renderMarkdownInline('a ++ b')).toBe('a ++ b');
    expect(renderMarkdownInline('`==hi==`')).toBe('<code>==hi==</code>');
    expect(markdownToPdfHtml('See <mark>hi</mark> now\n')).toContain('<mark>hi</mark>');
    expect(markdownToPdfHtml('See <u>there</u> now\n')).toContain('<u>there</u>');
    expect(markdownToPdfHtml('Say <em>hello</em> now\n')).toContain('<em>hello</em>');
    expect(markdownToPdfHtml('Say <strong>hello</strong> now\n')).toContain(
      '<strong>hello</strong>'
    );
    expect(markdownToPdfHtml('H<sub>2</sub>O\n')).toContain('H₂O');
    expect(markdownToPdfHtml('Before <img alt="sunset" src="pic.png"> after\n')).toContain(
      'alt="sunset"'
    );
    expect(markdownToPdfHtml('One<hr>Two\n')).toContain('<hr');
    expect(markdownToPdfHtml('<h1>Title</h1>\n\nbody\n')).toContain('<h1');
    expect(markdownToPdfHtml('<h1>Title</h1>\n\nbody\n')).toContain('Title');
    expect(markdownToPdfHtml('\uFEFF- one\n- two\n')).toBe(markdownToPdfHtml('- one\n- two\n'));
    expect(markdownToPdfHtml('\uFEFF# Title\n')).toContain('<h1');
    expect(markdownToPdfHtml('&lt;https://example.com&gt;\n')).toBe(
      '<p><a href="https://example.com">https://example.com</a></p>'
    );
    expect(markdownToPdfHtml('&lt;ada@example.com&gt;\n')).toBe(
      '<p><a href="mailto:ada@example.com">ada@example.com</a></p>'
    );
    expect(markdownToPdfHtml('https://example.com/a&amp;b=1\n')).toBe(
      '<p><a href="https://example.com/a&amp;b=1">https://example.com/a&amp;b=1</a></p>'
    );
    expect(markdownToPdfHtml('www.example.com/a<b>\n')).toBe(
      '<p><a href="http://www.example.com/a&lt;b&gt;">www.example.com/a&lt;b&gt;</a></p>'
    );
    expect(renderMarkdownInline('`AT&amp;T`')).toBe('<code>AT&amp;amp;T</code>');
    expect(renderMarkdownInline('&ast;not italic&ast;')).toBe('*not italic*');
    expect(renderMarkdownInline('[docs](https://example.com?a=1&amp;b=2)')).toBe(
      '<a href="https://example.com?a=1&amp;b=2">docs</a>'
    );
  });

  it('leaves snake_case plain and escapes a comparison', () => {
    expect(renderMarkdownInline('use snake_case_name')).toBe('use snake_case_name');
    expect(renderMarkdownInline('a < b & c')).toBe('a &lt; b &amp; c');
  });

  it('does not point a picture or link at a local file', () => {
    expect(renderMarkdownInline('![Secret](/etc/passwd.png)')).toBe('Secret');
    expect(renderMarkdownInline('![Secret](../secret.png)')).toBe('Secret');
    expect(renderMarkdownInline('![Pixel](images/../pixel.png)')).toBe('Pixel');
    expect(renderMarkdownInline('![Secret](//localhost/etc/passwd.png)')).toBe('Secret');
    expect(renderMarkdownInline('[Disk](file:///etc/passwd)')).toBe('Disk');
    expect(renderMarkdownInline('[Run](javascript:alert(1))')).toBe('Run');
    expect(renderMarkdownInline('[Run](java\tscript:alert(1))')).toBe('Run');
    expect(renderMarkdownInline('![Pixel](pixel.png)')).toContain('src="pixel.png"');
    expect(renderMarkdownInline('[Docs](https://example.com)')).toContain(
      'href="https://example.com"'
    );
    expect(renderMarkdownInline('<img src="/etc/passwd.png" alt="Secret">')).toBe(
      '<img alt="Secret">'
    );
    expect(renderMarkdownInline('<a href="file:///etc/passwd">Disk</a>')).toBe('<a>Disk</a>');
    expect(renderMarkdownInline('<a href="file&#58;///etc/passwd">Disk</a>')).toBe('<a>Disk</a>');
    expect(renderMarkdownInline('<a href=file:///etc/passwd>Disk</a>')).toBe('<a>Disk</a>');
    expect(renderMarkdownInline('<a href="java\fscript:alert(1)">Run</a>')).toBe('<a>Run</a>');
    expect(
      renderMarkdownInline(
        '<img src="https://example.com/a.png" srcset="java\fscript:alert(1) 1x" alt="x">'
      )
    ).toBe('<img src="https://example.com/a.png" alt="x">');
    expect(renderMarkdownInline('<svg><use href="..\f/secret.svg"></use></svg>')).not.toContain(
      'secret'
    );
    expect(renderMarkdownInline('[secret](/etc/passwd)')).toBe('secret');
    expect(renderMarkdownInline('<iframe src="file:///etc/passwd"></iframe>')).toBe('');
    expect(renderMarkdownInline('<iframe src="file:///etc/passwd">Read the page</iframe>')).toBe(
      'Read the page'
    );
    expect(renderMarkdownInline('<object data="file:///etc/passwd">The report</object>')).toBe(
      'The report'
    );
    expect(renderMarkdownInline('<script>location="file:///etc/passwd"</script>')).toBe('');
  });

  it('measures a tab from the quote marker column', () => {
    expect(markdownToPdfHtml('>\tfoo\n')).toContain('<p>foo</p>');
    expect(markdownToPdfHtml('>\tfoo\n')).not.toContain('<pre>');
    expect(markdownToPdfHtml('>\t\tfoo\n')).toContain('<code>  foo</code>');
    expect(markdownToPdfHtml('> text\n>\t\tmore\n')).toContain('text more');
    expect(markdownToPdfHtml('-\t\tfoo\n')).toContain('<code>  foo</code>');
    expect(markdownToPdfHtml('1.\t\tfoo\n')).toContain('<code> foo</code>');
    expect(markdownToPdfHtml('-\t\t\tfoo\n')).toContain('<code>  \tfoo</code>');
    expect(markdownToPdfHtml('> -\t\tfoo\n> \t\tbar\n')).toContain('<code>foo\nbar</code>');
    expect(markdownToPdfHtml('> ```\n>\tkept\n> ```\n')).toContain('<code>\tkept</code>');
    expect(markdownToPdfHtml('> -\n>   foo\n')).toContain('<li>foo</li>');
    expect(markdownToPdfHtml('> -\n>   foo\n')).not.toContain('<p>');
  });

  it('keeps an image whose alt or address contains markup characters', () => {
    const greaterBefore = markdownToPdfHtml('Before <img alt="a>b" src="pic.png"> after\n');
    expect(greaterBefore).toContain('alt="a&gt;b"');
    expect(greaterBefore).toContain('src="pic.png"');
    expect(greaterBefore).not.toContain('b&quot;');
    const greaterAfter = markdownToPdfHtml('Before <img src="pic.png" alt="a>b"> after\n');
    expect(greaterAfter).toContain('alt="a&gt;b"');
    expect(greaterAfter).not.toContain('b&quot;');
    expect(markdownToPdfHtml('Before <img alt="a]b" src="pic.png"> after\n')).toContain(
      'alt="a]b"'
    );
    expect(markdownToPdfHtml('Before <img src="my pic.png" alt="sun"> after\n')).toContain(
      'src="my%20pic.png"'
    );
    expect(
      markdownToPdfHtml('Before <img alt="sunset" src="pic.png" title="Evening"> after\n')
    ).toContain('title="Evening"');
  });

  it('keeps an inline HTML tag and escapes one inside code', () => {
    expect(renderMarkdownInline('Say <em>hello</em><br>')).toBe('Say <em>hello</em><br>');
    expect(renderMarkdownInline('<span title="a>b">Hi</span>')).toBe('<span title="a>b">Hi</span>');
    expect(renderMarkdownInline('` <em>x</em> `')).toBe('<code>&lt;em&gt;x&lt;/em&gt;</code>');
  });
});
