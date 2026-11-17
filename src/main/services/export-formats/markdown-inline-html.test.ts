import { describe, expect, it } from 'vitest';

import { renderMarkdownInline } from './markdown-inline-html';

describe('renderMarkdownInline', () => {
  it('renders an image instead of a link with a stray exclamation mark', () => {
    expect(renderMarkdownInline('![A photo](photo.jpg)')).toBe(
      '<img src="photo.jpg" alt="A photo" />'
    );
    expect(renderMarkdownInline('[docs](https://example.com)')).toBe(
      '<a href="https://example.com">docs</a>'
    );
  });

  it('renders bold italic from three markers', () => {
    expect(renderMarkdownInline('***both***')).toBe('<strong><em>both</em></strong>');
    expect(renderMarkdownInline('___both___')).toBe('<strong><em>both</em></strong>');
    expect(renderMarkdownInline('**bold *inner* text**')).toBe(
      '<strong>bold <em>inner</em> text</strong>'
    );
    expect(renderMarkdownInline('*italic **bold** text*')).toBe(
      '<em>italic <strong>bold</strong> text</em>'
    );
  });

  it('renders emphasis, code, and links', () => {
    expect(renderMarkdownInline('**bold** and _italic_ and `code` and ~~gone~~')).toBe(
      '<strong>bold</strong> and <em>italic</em> and <code>code</code> and <del>gone</del>'
    );
    expect(renderMarkdownInline('[docs](https://example.com)')).toBe(
      '<a href="https://example.com">docs</a>'
    );
  });

  it('keeps an escaped asterisk literal', () => {
    expect(renderMarkdownInline('\\*not italic\\* and **real**')).toBe(
      '*not italic* and <strong>real</strong>'
    );
    expect(renderMarkdownInline('\\[docs](https://example.com)')).toBe(
      '[docs](https://example.com)'
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

  it('keeps a link title out of the address', () => {
    expect(renderMarkdownInline('[docs](https://example.com "Docs")')).toBe(
      '<a href="https://example.com">docs</a>'
    );
    expect(renderMarkdownInline('[docs](<https://example.com>)')).toBe(
      '<a href="https://example.com">docs</a>'
    );
    expect(renderMarkdownInline('![A photo](photo.jpg "A photo")')).toBe(
      '<img src="photo.jpg" alt="A photo" />'
    );
  });

  it('renders a formula and leaves a price as text', () => {
    const formula = renderMarkdownInline('See $x^2$ and $5 and $10');
    expect(formula).toContain('<math');
    expect(formula).toContain('$5 and $10');
    expect(formula).not.toContain('$x^2$');
  });

  it('leaves snake_case plain and escapes a comparison', () => {
    expect(renderMarkdownInline('use snake_case_name')).toBe('use snake_case_name');
    expect(renderMarkdownInline('a < b & c')).toBe('a &lt; b &amp; c');
  });

  it('keeps an inline HTML tag and escapes one inside code', () => {
    expect(renderMarkdownInline('Say <em>hello</em><br>')).toBe('Say <em>hello</em><br>');
    expect(renderMarkdownInline('<span title="a>b">Hi</span>')).toBe('<span title="a>b">Hi</span>');
    expect(renderMarkdownInline('` <em>x</em> `')).toBe('<code> &lt;em&gt;x&lt;/em&gt; </code>');
  });
});
