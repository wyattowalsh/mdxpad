import { describe, expect, it } from 'vitest';

import { isLazyQuoteLine, quoteBody, quoteToHtml } from './markdown-quote';

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

  it('wraps quote lines in a blockquote', () => {
    expect(quoteToHtml(['Keep **this**'], (line) => line)).toBe(
      '<blockquote>\n<p>Keep **this**</p>\n</blockquote>'
    );
  });
});
