import { describe, expect, it } from 'vitest';

import {
  allocateHeadingSlug,
  headingAnchor,
  normalizedHeadingFragment,
  parseAtxHeading,
  stripAtxClosingHashes,
} from './markdown-heading';

describe('ATX headings', () => {
  it('drops a closing hash run and keeps a hash that is part of the title', () => {
    expect(stripAtxClosingHashes('Title #')).toBe('Title');
    expect(stripAtxClosingHashes('Title  ##  ')).toBe('Title');
    expect(stripAtxClosingHashes('Hash#')).toBe('Hash#');
    expect(stripAtxClosingHashes('Keep ### b')).toBe('Keep ### b');
    expect(stripAtxClosingHashes('foo #')).toBe('foo');
    expect(parseAtxHeading('# Title #')).toEqual({ depth: 1, text: 'Title' });
    expect(parseAtxHeading('## Keep ### b')).toEqual({ depth: 2, text: 'Keep ### b' });
    expect(parseAtxHeading('# Hash#')).toEqual({ depth: 1, text: 'Hash#' });
    expect(parseAtxHeading('#foo')).toBeNull();
    expect(parseAtxHeading('# #')).toEqual({ depth: 1, text: '' });
    expect(parseAtxHeading('#')).toEqual({ depth: 1, text: '' });
    expect(parseAtxHeading('# ')).toEqual({ depth: 1, text: '' });
    expect(parseAtxHeading('#######')).toBeNull();
  });

  it('gives duplicate headings distinct slugs', () => {
    const counts = new Map<string, number>();
    expect(allocateHeadingSlug('Intro', counts)).toBe('intro');
    expect(allocateHeadingSlug('**Intro**', counts)).toBe('intro-1');
    expect(allocateHeadingSlug('[Guide](https://example.com)', counts)).toBe('guide');
    expect(headingAnchor('#intro-1')).toBe('intro-1');
    expect(headingAnchor('https://example.com')).toBeNull();
    expect(normalizedHeadingFragment('#Two')).toBe('two');
    expect(normalizedHeadingFragment('#Hello%20World')).toBe('hello-world');
    expect(normalizedHeadingFragment('#fn-1')).toBe('fn-1');
    expect(normalizedHeadingFragment('#two-1')).toBe('two-1');
    expect(normalizedHeadingFragment('https://example.com')).toBeNull();
  });
});
