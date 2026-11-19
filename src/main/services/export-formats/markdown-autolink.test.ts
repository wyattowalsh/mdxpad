import { describe, expect, it } from 'vitest';

import { protectAutolinks } from './markdown-autolink';

describe('protectAutolinks', () => {
  it('marks an angle link, a bare link, and an email', () => {
    const protectedLinks = protectAutolinks(
      'See <https://example.com> and https://example.com. Mail <a@b.co>'
    );
    expect(protectedLinks.links.map((link) => link.href)).toEqual([
      'https://example.com',
      'https://example.com',
      'mailto:a@b.co',
    ]);
    expect(protectedLinks.links[1]?.text).toBe('https://example.com');
  });

  it('links a www address and a bare email', () => {
    const protectedLinks = protectAutolinks('See www.example.com/docs. Mail ada@example.com.');
    expect(protectedLinks.links).toEqual([
      { href: 'http://www.example.com/docs', text: 'www.example.com/docs' },
      { href: 'mailto:ada@example.com', text: 'ada@example.com' },
    ]);
  });

  it('keeps parentheses escaped inside an email address', () => {
    const protectedLinks = protectAutolinks('Mail ada\\(b\\)@example.com today.');
    expect(protectedLinks.links).toEqual([
      { href: 'mailto:ada(b)@example.com', text: 'ada(b)@example.com' },
    ]);
  });

  it('keeps parentheses escaped inside a bare address', () => {
    const protectedLinks = protectAutolinks('See https://example.com/a\\(b\\) and \\(x\\).');
    expect(protectedLinks.links).toEqual([
      { href: 'https://example.com/a(b)', text: 'https://example.com/a(b)' },
    ]);
  });

  it('leaves a code span and an existing link destination alone', () => {
    const protectedLinks = protectAutolinks(
      '`https://example.com` and [docs](https://example.com)'
    );
    expect(protectedLinks.links).toEqual([]);
    expect(protectedLinks.text).toContain('`https://example.com`');
    expect(protectedLinks.text).toContain('[docs](https://example.com)');
    expect(protectAutolinks('[site](www.example.com) and `ada@example.com`').links).toEqual([]);
  });
});
