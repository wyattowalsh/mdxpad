import { describe, expect, it } from 'vitest';

import { renderMarkdownInline } from './markdown-inline-html';

describe('renderMarkdownInline', () => {
  it('renders emphasis, code, and links', () => {
    expect(renderMarkdownInline('**bold** and _italic_ and `code`')).toBe(
      '<strong>bold</strong> and <em>italic</em> and <code>code</code>'
    );
    expect(renderMarkdownInline('[docs](https://example.com)')).toBe(
      '<a href="https://example.com">docs</a>'
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
