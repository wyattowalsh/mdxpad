import { describe, expect, it } from 'vitest';

import { FileIndexService } from '../file-index-service';

describe('FileIndexService', () => {
  it('indexes documents and supports lookups by id and path', () => {
    const service = new FileIndexService();
    const indexed = service.indexDocument({
      id: 'doc-release',
      filePath: '/workspace/docs/release-notes.mdx',
      content: `---
title: Release Notes
tags: [Engineering, Launch]
slug: release-v1
---

Shipped a new workspace index service.`,
      indexedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(indexed.title).toBe('Release Notes');
    expect(indexed.slug).toBe('release-v1');
    expect(indexed.tags).toEqual(['engineering', 'launch']);
    expect(indexed.snippet).toContain('workspace index service');
    expect(service.getById('doc-release')).toEqual(indexed);
    expect(service.getByPath('/workspace/docs/release-notes.mdx')).toEqual(indexed);
  });

  it('updates entries incrementally and refreshes path lookup when file path changes', () => {
    const service = new FileIndexService();
    service.indexDocument({
      id: 'doc-1',
      filePath: '/workspace/docs/old-path.mdx',
      content: '# Original Title',
    });

    const updated = service.indexDocument({
      id: 'doc-1',
      filePath: '/workspace/docs/new-path.mdx',
      content: '# Updated Title',
    });

    expect(service.getByPath('/workspace/docs/old-path.mdx')).toBeNull();
    expect(service.getByPath('/workspace/docs/new-path.mdx')).toEqual(updated);
    expect(service.getById('doc-1')?.title).toBe('Updated Title');
  });

  it('supports metadata and snippet text queries with ranked matches', () => {
    const service = new FileIndexService();
    service.indexDocuments([
      {
        id: 'doc-release',
        filePath: '/workspace/docs/release-notes.mdx',
        content: `---
title: Release Notes
tags: [Engineering, Platform]
---

Launch checklist and deployment summary.`,
      },
      {
        id: 'doc-agenda',
        filePath: '/workspace/docs/team-sync.mdx',
        content: '# Team Sync\n\nReview retrospective timeline and define action items.',
      },
      {
        id: 'doc-changelog',
        filePath: '/workspace/docs/changelog.mdx',
        content: '# Changelog\n\nMinor formatting cleanup.',
      },
    ]);

    const metadataMatches = service.query({ text: 'release engineering' });
    expect(metadataMatches).toHaveLength(1);
    expect(metadataMatches[0]?.document.id).toBe('doc-release');
    expect(metadataMatches[0]?.matchedFields).toEqual(expect.arrayContaining(['title', 'tags']));

    const snippetMatches = service.query({ text: 'retrospective timeline' });
    expect(snippetMatches).toHaveLength(1);
    expect(snippetMatches[0]?.document.id).toBe('doc-agenda');
    expect(snippetMatches[0]?.matchedFields).toContain('snippet');
  });

  it('supports collection filters for equality, contains, and range operations', () => {
    const service = new FileIndexService();
    service.indexDocuments([
      {
        id: 'doc-roadmap',
        filePath: '/workspace/docs/roadmap.mdx',
        content: `---
title: Product Roadmap
status: published
priority: 3
tags: [Planning, Team]
---

Quarterly planning milestones.`,
      },
      {
        id: 'doc-draft',
        filePath: '/workspace/docs/draft.mdx',
        content: `---
title: Draft Notes
status: draft
priority: 8
tags: [Internal]
---

Private draft for review.`,
      },
    ]);

    const published = service.queryCollection({
      filters: [{ field: 'status', operator: 'eq', value: 'published' }],
      limit: 10,
    });
    expect(published.map((document) => document.id)).toEqual(['doc-roadmap']);

    const containsTag = service.queryCollection({
      filters: [{ field: 'tags', operator: 'contains', value: 'team' }],
      limit: 10,
    });
    expect(containsTag.map((document) => document.id)).toEqual(['doc-roadmap']);

    const highPriority = service.queryCollection({
      filters: [{ field: 'priority', operator: 'gte', value: 5 }],
      limit: 10,
    });
    expect(highPriority.map((document) => document.id)).toEqual(['doc-draft']);
  });

  it('aggregates collection fields for count, distinct values, and histogram bins', () => {
    const service = new FileIndexService();
    service.indexDocuments([
      {
        id: 'doc-a',
        filePath: '/workspace/docs/a.mdx',
        content: `---
status: published
priority: 2
tags: [Docs]
---
`,
      },
      {
        id: 'doc-b',
        filePath: '/workspace/docs/b.mdx',
        content: `---
status: published
priority: 6
tags: [Docs, Team]
---
`,
      },
      {
        id: 'doc-c',
        filePath: '/workspace/docs/c.mdx',
        content: `---
status: draft
priority: 9
tags: [Team]
---
`,
      },
    ]);

    expect(service.aggregateCollection({ field: 'status', operation: 'count' })).toEqual({
      field: 'status',
      operation: 'count',
      total: 3,
      buckets: { count: 3 },
    });

    expect(service.aggregateCollection({ field: 'status', operation: 'distinct' })).toEqual({
      field: 'status',
      operation: 'distinct',
      total: 3,
      buckets: {
        published: 2,
        draft: 1,
      },
    });

    expect(
      service.aggregateCollection({
        field: 'priority',
        operation: 'histogram',
        histogramBinSize: 5,
      })
    ).toEqual({
      field: 'priority',
      operation: 'histogram',
      total: 3,
      buckets: {
        '0..5': 1,
        '5..10': 2,
      },
    });
  });

  it('removes indexed entries by id and path', () => {
    const service = new FileIndexService();
    service.indexDocuments([
      {
        id: 'doc-a',
        filePath: '/workspace/docs/a.mdx',
        content: '# A',
      },
      {
        id: 'doc-b',
        filePath: '/workspace/docs/b.mdx',
        content: '# B',
      },
    ]);

    expect(service.removeByPath('/workspace/docs/a.mdx')).toBe(true);
    expect(service.getById('doc-a')).toBeNull();
    expect(service.removeById('doc-b')).toBe(true);
    expect(service.size).toBe(0);
  });
});
