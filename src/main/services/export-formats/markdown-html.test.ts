import { describe, expect, it } from 'vitest';

import { readHtmlBlock } from './markdown-html';

describe('readHtmlBlock', () => {
  it('reads a div until the blank line', () => {
    const lines = ['<div>', 'Hello', '</div>', '', 'After'];
    expect(readHtmlBlock(lines, 0)).toEqual({
      html: '<div>\nHello\n</div>',
      nextIndex: 2,
    });
  });

  it('reads a script until its closing tag', () => {
    const lines = ['<script>', 'const x = 1;', '</script>', 'After'];
    expect(readHtmlBlock(lines, 0)?.html).toBe('<script>\nconst x = 1;\n</script>');
  });

  it('leaves an autolink and a fenced-looking sentence alone', () => {
    expect(readHtmlBlock(['<https://example.com>'], 0)).toBeNull();
    expect(readHtmlBlock(['See <div> later'], 0)).toBeNull();
  });
});
