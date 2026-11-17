import { describe, expect, it } from 'vitest';

import { decodeHtmlEntities } from './markdown-entity';

describe('decodeHtmlEntities', () => {
  it('decodes a terminated reference and leaves a bare ampersand', () => {
    expect(decodeHtmlEntities('AT&amp;T &lt;tag&gt; &#35;')).toBe('AT&T <tag> #');
    expect(decodeHtmlEntities('a < b & c')).toBe('a < b & c');
    expect(decodeHtmlEntities('&amp')).toBe('&amp');
    expect(decodeHtmlEntities('&notanentity;')).toBe('&notanentity;');
  });
});
