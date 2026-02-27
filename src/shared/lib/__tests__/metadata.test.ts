import { describe, it, expect } from 'vitest';
import {
  parseFrontmatterYaml,
  normalizeFrontmatter,
  deriveTags,
  deriveSlug,
  extractDocumentMetadata,
  toSlug,
} from '../metadata';

describe('parseFrontmatterYaml', () => {
  it('parses scalar, list, and inline array values', () => {
    const yaml = `title: "Metadata Utilities"
published: true
count: 3
tags:
- mdx
- indexing
keywords: [search, collection]`;

    expect(parseFrontmatterYaml(yaml)).toEqual({
      title: 'Metadata Utilities',
      published: true,
      count: 3,
      tags: ['mdx', 'indexing'],
      keywords: ['search', 'collection'],
    });
  });
});

describe('normalizeFrontmatter', () => {
  it('normalizes nested values recursively', () => {
    const normalized = normalizeFrontmatter({
      title: '  Doc  ',
      date: new Date('2025-01-01T00:00:00.000Z'),
      nested: { draft: false, views: 42 },
      invalid: Number.NaN,
    });

    expect(normalized).toEqual({
      title: 'Doc',
      date: '2025-01-01T00:00:00.000Z',
      nested: { draft: false, views: 42 },
      invalid: null,
    });
  });
});

describe('deriveTags', () => {
  it('collects and deduplicates tags from common fields', () => {
    const tags = deriveTags({
      tags: ['Docs', 'mdx'],
      categories: 'Guides, mdx',
      keyword: 'ignored',
      keywords: ['SEARCH'],
    });

    expect(tags).toEqual(['docs', 'mdx', 'guides', 'search']);
  });
});

describe('deriveSlug', () => {
  it('prefers explicit slug and falls back to title', () => {
    expect(deriveSlug({ slug: ' Custom Slug ' })).toBe('custom-slug');
    expect(deriveSlug({ title: 'Hello Metadata' })).toBe('hello-metadata');
    expect(deriveSlug({}, 'Fallback Title')).toBe('fallback-title');
  });
});

describe('extractDocumentMetadata', () => {
  it('extracts normalized metadata from frontmatter content', () => {
    const content = `---
title: "Index Doc"
tags: [One, two]
category: Guides
---

# Heading should not override title

Body`;

    expect(extractDocumentMetadata(content)).toEqual({
      frontmatter: {
        title: 'Index Doc',
        tags: ['One', 'two'],
        category: 'Guides',
      },
      rawFrontmatter: 'title: "Index Doc"\ntags: [One, two]\ncategory: Guides',
      body: '# Heading should not override title\n\nBody',
      hasFrontmatter: true,
      title: 'Index Doc',
      slug: 'index-doc',
      tags: ['one', 'two', 'guides'],
    });
  });

  it('falls back to heading and default slug when frontmatter is missing', () => {
    const metadata = extractDocumentMetadata('# Hello World\n\nSome content');

    expect(metadata.hasFrontmatter).toBe(false);
    expect(metadata.title).toBe('Hello World');
    expect(metadata.slug).toBe('hello-world');
    expect(metadata.tags).toEqual([]);
  });
});

describe('toSlug', () => {
  it('slugifies unicode text and uses fallback for empty values', () => {
    expect(toSlug('Crème Brûlée Guide')).toBe('creme-brulee-guide');
    expect(toSlug('!!!', 'default-slug')).toBe('default-slug');
  });
});
