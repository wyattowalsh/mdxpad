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

  it('renders emphasis inside a formula that contains a link', () => {
    const html = markdownToPdfHtml('See \\(x **and** [a](https://example.com) y\\).');
    expect(html).toContain('class="katex"');
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('$x');
    expect(html).not.toContain('<strong>');
  });

  it('keeps every paragraph of a footnote', () => {
    const html = markdownToPdfHtml('See[^long].\n\n[^long]: one\n\n    two\n\n    three words\n');
    expect(html).toContain('one');
    expect(html).toContain('two');
    expect(html).toContain('three words');
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
    expect(renderMarkdownInline('<script>location="file:///etc/passwd"</script>')).toBe('');
  });

  it('keeps an inline HTML tag and escapes one inside code', () => {
    expect(renderMarkdownInline('Say <em>hello</em><br>')).toBe('Say <em>hello</em><br>');
    expect(renderMarkdownInline('<span title="a>b">Hi</span>')).toBe('<span title="a>b">Hi</span>');
    expect(renderMarkdownInline('` <em>x</em> `')).toBe('<code>&lt;em&gt;x&lt;/em&gt;</code>');
  });
});
