import { describe, expect, it } from 'vitest';

import { splitLeadingFrontmatter, stripLeadingFrontmatter } from './frontmatter';

describe('splitLeadingFrontmatter', () => {
  it('keeps a thematic break that does not close a metadata block', () => {
    const source = '---\n\nBody text.\n';
    expect(splitLeadingFrontmatter(source)).toEqual({ frontmatter: '', body: source });
  });

  it('separates a leading metadata block from the body', () => {
    const split = splitLeadingFrontmatter('---\r\ntitle: Hello\r\n---\r\n\nBody text.\n');
    expect(split.frontmatter).toBe('---\r\ntitle: Hello\r\n---\r\n');
    expect(split.body).toBe('\nBody text.\n');
    expect(stripLeadingFrontmatter('---\ntitle: Hello\n---')).toBe('');
  });
});
