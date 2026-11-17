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

  it('renders emphasis, code, and links', () => {
    expect(renderMarkdownInline('**bold** and _italic_ and `code` and ~~gone~~')).toBe(
      '<strong>bold</strong> and <em>italic</em> and <code>code</code> and <del>gone</del>'
    );
    expect(renderMarkdownInline('[docs](https://example.com)')).toBe(
      '<a href="https://example.com">docs</a>'
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

  it('leaves snake_case plain and escapes HTML', () => {
    expect(renderMarkdownInline('use snake_case_name')).toBe('use snake_case_name');
    expect(renderMarkdownInline('a < b & c')).toBe('a &lt; b &amp; c');
  });
});
