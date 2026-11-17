import { describe, expect, it } from 'vitest';

import { quoteBody, quoteToHtml } from './markdown-quote';

describe('quoteBody', () => {
  it('reads a quote line and rejects plain text', () => {
    expect(quoteBody('> Keep this')).toBe('Keep this');
    expect(quoteBody('>')).toBe('');
    expect(quoteBody('not a quote')).toBeNull();
  });

  it('wraps quote lines in a blockquote', () => {
    expect(quoteToHtml(['Keep **this**'], (line) => line)).toBe(
      '<blockquote>\n<p>Keep **this**</p>\n</blockquote>'
    );
  });
});
