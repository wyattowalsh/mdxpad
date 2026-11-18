import { describe, expect, it } from 'vitest';

import { linkDestination, linkTitle } from './markdown-link';

describe('linkDestination', () => {
  it('drops a title and unwraps an angle address', () => {
    expect(linkDestination('https://example.com "Docs"')).toBe('https://example.com');
    expect(linkDestination('<https://example.com>')).toBe('https://example.com');
    expect(linkDestination('https://example.com')).toBe('https://example.com');
    expect(linkTitle('https://example.com "Docs"')).toBe('Docs');
    expect(linkTitle('<https://example.com> "Guide"')).toBe('Guide');
    expect(linkTitle('https://example.com')).toBeNull();
    expect(linkTitle('https://example.com "foo\\"bar"')).toBe('foo"bar');
    expect(linkDestination('https://example.com "foo\\"bar"')).toBe('https://example.com');
    expect(linkDestination('https://example.com/a\\(b\\)')).toBe('https://example.com/a(b)');
    expect(linkDestination('<https://example.com/a b>')).toBe('https://example.com/a%20b');
  });
});
