import { describe, expect, it } from 'vitest';

import { protectEscapes, restoreEscapes } from './markdown-escape';

describe('protectEscapes', () => {
  it('hides escaped punctuation and leaves a code span alone', () => {
    const escaped = protectEscapes('\\*star\\* and `\\*`');
    expect(escaped.chars).toEqual(['*', '*']);
    expect(escaped.text).toContain('`\\*`');
    expect(restoreEscapes(escaped.text, escaped.chars, (char) => char)).toBe('*star* and `\\*`');
  });
});
