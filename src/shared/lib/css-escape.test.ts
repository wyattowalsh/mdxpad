import { describe, expect, it } from 'vitest';

import { decodeCssEscapes, stripCssComments } from './css-escape';

describe('decodeCssEscapes', () => {
  it('turns hex and character escapes into the address a browser requests', () => {
    expect(decodeCssEscapes('\\66ile:///etc/passwd')).toBe('file:///etc/passwd');
    expect(decodeCssEscapes('f\\ile:///etc/passwd')).toBe('file:///etc/passwd');
    expect(decodeCssEscapes('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(stripCssComments('fi/**/le:///etc/passwd')).toBe('file:///etc/passwd');
  });
});
