import { describe, expect, it } from 'vitest';

import { markdownToPdfHtml } from './pdf-exporter';
import { joinParagraphHtml, readSourceLine } from './markdown-paragraph';

describe('readSourceLine', () => {
  it('keeps a hard break and leaves a soft wrap plain', () => {
    expect(readSourceLine('Hello  ')).toEqual({ text: 'Hello', hardBreak: true, codeSuffix: '  ' });
    expect(readSourceLine('Hello\\')).toEqual({ text: 'Hello', hardBreak: true, codeSuffix: '\\' });
    expect(joinParagraphHtml([readSourceLine('foo\\')], (text) => text)).toBe('foo\\');
    expect(joinParagraphHtml([readSourceLine('foo\\'), readSourceLine('bar')], (text) => text)).toBe(
      'foo<br />bar'
    );
    expect(readSourceLine('Hello\\\\')).toEqual({ text: 'Hello\\\\', hardBreak: false });
    expect(readSourceLine('Hello')).toEqual({ text: 'Hello', hardBreak: false });
  });

  it('joins soft lines with a space and hard lines with a break', () => {
    const html = joinParagraphHtml(
      [readSourceLine('Hello  '), readSourceLine('world')],
      (text) => text
    );
    expect(html).toBe('Hello<br />world');
    expect(
      joinParagraphHtml([readSourceLine('~~hello'), readSourceLine('world~~')], (text) =>
        text.replace(/~~(.+?)~~/g, '<del>$1</del>')
      )
    ).toBe('<del>hello world</del>');
    expect(
      joinParagraphHtml([readSourceLine('Hello'), readSourceLine('world')], (text) => text)
    ).toBe('Hello world');
  });

  it('reopens a mark around a hard break', () => {
    const strike = (text: string): string => text.replace(/~~(.+?)~~/g, '<del>$1</del>');
    expect(
      joinParagraphHtml([readSourceLine('~~hello  '), readSourceLine('world~~')], strike)
    ).toBe('<del>hello</del><br /><del>world</del>');
    const bold = (text: string): string => text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    expect(joinParagraphHtml([readSourceLine('**hello\\'), readSourceLine('world**')], bold)).toBe(
      '<strong>hello</strong><br /><strong>world</strong>'
    );
  });

  it('keeps a formula together across a hard break', () => {
    const html = joinParagraphHtml(
      [readSourceLine('See $x  '), readSourceLine('y$')],
      (text) => text
    );
    expect(html).toBe('See $x   y$');
    expect(html).not.toContain('<br');
    const preview = markdownToPdfHtml('Hard \\(x  \ny\\)\n');
    expect(preview).toContain('class="katex"');
    expect(preview).not.toContain('$x');
  });

  it('keeps a wrapped code span together', () => {
    const code = (text: string): string => text.replace(/`([^`]+)`/g, '<code>$1</code>');
    expect(joinParagraphHtml([readSourceLine('`two  '), readSourceLine('lines`')], code)).toBe(
      '<code>two   lines</code>'
    );
    expect(joinParagraphHtml([readSourceLine('`foo\\'), readSourceLine('bar`')], code)).toBe(
      '<code>foo\\ bar</code>'
    );
    expect(
      joinParagraphHtml([readSourceLine('see `a'), readSourceLine('  b` end')], code)
    ).toBe('see <code>a   b</code> end');
    expect(
      joinParagraphHtml([readSourceLine('See `oops  '), readSourceLine('next')], (text) => text)
    ).toBe('See `oops<br />next');
  });
});
