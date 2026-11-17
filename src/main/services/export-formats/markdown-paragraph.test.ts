import { describe, expect, it } from 'vitest';

import { joinParagraphHtml, readSourceLine } from './markdown-paragraph';

describe('readSourceLine', () => {
  it('keeps a hard break and leaves a soft wrap plain', () => {
    expect(readSourceLine('Hello  ')).toEqual({ text: 'Hello', hardBreak: true });
    expect(readSourceLine('Hello\\')).toEqual({ text: 'Hello', hardBreak: true });
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
      joinParagraphHtml([readSourceLine('Hello'), readSourceLine('world')], (text) => text)
    ).toBe('Hello world');
  });
});
