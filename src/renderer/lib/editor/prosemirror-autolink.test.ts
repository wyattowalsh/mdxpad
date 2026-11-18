import type { Node as ProseMirrorNode } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';

import { parseMdxContent } from './prosemirror-mdx-parser';
import { serializeMdxContent } from './prosemirror-mdx-serializer';

function linkHrefs(doc: ProseMirrorNode | null): string[] {
  const hrefs: string[] = [];
  doc?.descendants((node) => {
    for (const mark of node.marks) {
      if (mark.type.name === 'link' && typeof mark.attrs.href === 'string') {
        hrefs.push(mark.attrs.href);
      }
    }
  });
  return hrefs;
}

describe('visual bare addresses', () => {
  it('shows a web address and an email as links', () => {
    const source = 'See https://example.com and www.example.com and ada@example.com.';
    const doc = parseMdxContent(source);
    if (!doc) {
      throw new Error('address markdown did not parse');
    }
    expect(linkHrefs(doc)).toEqual([
      'https://example.com',
      'http://www.example.com',
      'mailto:ada@example.com',
    ]);
    const saved = serializeMdxContent(doc);
    expect(saved).toContain('https://example.com');
    expect(saved).toContain('www.example.com');
    expect(saved).toContain('ada@example.com');
    expect(linkHrefs(parseMdxContent(saved))).toEqual(linkHrefs(doc));
  });

  it('leaves an address inside code as code', () => {
    const inline = parseMdxContent('See `https://example.com` now');
    expect(linkHrefs(inline)).toEqual([]);
    const fenced = parseMdxContent('```\nhttps://example.com\n```');
    expect(linkHrefs(fenced)).toEqual([]);
    expect(linkHrefs(parseMdxContent('Go to example.com'))).toEqual([]);
  });
});
