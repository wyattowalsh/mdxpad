import { describe, expect, it } from 'vitest';

import { readHtmlBlock, sanitizeMarkdownHtmlBlocks } from './markdown-html';

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

describe('sanitizeMarkdownHtmlBlocks', () => {
  it('drops a local file from a raw tag and leaves a code sample', () => {
    expect(sanitizeMarkdownHtmlBlocks('<img src="file:///etc/passwd" alt="x">')).toBe(
      '<img alt="x">'
    );
    expect(sanitizeMarkdownHtmlBlocks('<a href="javascript:alert(1)">Run</a>')).toBe('<a>Run</a>');
    expect(
      sanitizeMarkdownHtmlBlocks('<span style="background:url(file:///etc/passwd)">x</span>')
    ).not.toContain('file:');
    expect(sanitizeMarkdownHtmlBlocks('<video poster="/etc/passwd.png"></video>')).toBe(
      '<video></video>'
    );
    expect(sanitizeMarkdownHtmlBlocks('<embed src="file:///tmp/a.swf" alt="Watch the clip">')).toBe(
      'Watch the clip'
    );
    expect(
      sanitizeMarkdownHtmlBlocks('<embed src="https://example.com/a.swf">Watch the clip</embed>')
    ).toBe('Watch the clip');
    expect(sanitizeMarkdownHtmlBlocks('<embed src="file:///tmp/a.swf"></embed>')).toBe('');
    expect(sanitizeMarkdownHtmlBlocks('<embed src="https://example.com/a.swf">')).toBe(
      'https://example.com/a.swf'
    );
    expect(sanitizeMarkdownHtmlBlocks('<iframe src="https://example.com/page"></iframe>')).toBe(
      'https://example.com/page'
    );
    expect(sanitizeMarkdownHtmlBlocks('<iframe src="file:///etc/passwd"></iframe>')).toBe('');
    expect(
      sanitizeMarkdownHtmlBlocks('<iframe src="file:///etc/passwd" title="The report"></iframe>')
    ).toBe('The report');
    expect(
      sanitizeMarkdownHtmlBlocks(
        '<iframe src="file:///etc/passwd" aria-label="The report"></iframe>'
      )
    ).toBe('The report');
    expect(
      sanitizeMarkdownHtmlBlocks(
        '<iframe src="https://example.com/page" title="The report"></iframe>'
      )
    ).toBe('https://example.com/page (The report)');
    expect(sanitizeMarkdownHtmlBlocks('<object data="https://example.com/a.pdf"></object>')).toBe(
      'https://example.com/a.pdf'
    );
    expect(
      sanitizeMarkdownHtmlBlocks('<object data="file:///etc/passwd">The report</object>')
    ).toBe('The report');
    expect(sanitizeMarkdownHtmlBlocks('```\n<img src="file:///etc/passwd">\n```')).toContain(
      'file:///etc/passwd'
    );
  });
});
