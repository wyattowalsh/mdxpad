import { describe, expect, it } from 'vitest';

import { decodeAddressEntities, decodeHtmlNumericReferences } from './html-numeric-reference';

describe('decodeHtmlNumericReferences', () => {
  it('reads a numeric reference when the semicolon is missing', () => {
    expect(decodeHtmlNumericReferences('&#102ile:///etc/passwd')).toBe('file:///etc/passwd');
    expect(decodeHtmlNumericReferences('&#x66ile:///etc/passwd')).toBe('file:///etc/passwd');
    expect(decodeHtmlNumericReferences('&#106avascript:alert(1)')).toBe('javascript:alert(1)');
    expect(decodeHtmlNumericReferences('file&#58///etc/passwd')).toBe('file:///etc/passwd');
    expect(decodeHtmlNumericReferences('https://example.com')).toBe('https://example.com');
  });

  it('unwraps a second encoding', () => {
    expect(decodeAddressEntities('&amp;#102ile:///etc/passwd')).toBe('file:///etc/passwd');
    expect(decodeAddressEntities('&#102;ile:///etc/passwd')).toBe('file:///etc/passwd');
  });
});
