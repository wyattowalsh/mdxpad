import { describe, expect, it } from 'vitest';

import { linkDestination } from './markdown-link';

describe('linkDestination', () => {
  it('drops a title and unwraps an angle address', () => {
    expect(linkDestination('https://example.com "Docs"')).toBe('https://example.com');
    expect(linkDestination('<https://example.com>')).toBe('https://example.com');
    expect(linkDestination('https://example.com')).toBe('https://example.com');
  });
});
