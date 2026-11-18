import { describe, expect, it } from 'vitest';

import { ShareLinkService } from '../share-link-service';

describe('ShareLinkService.readByToken', () => {
  it('returns stored content for an active token', () => {
    const service = new ShareLinkService();
    const link = service.createLink({
      docId: 'doc-1',
      accessMode: 'read-only',
      expiresInMs: null,
      content: '# Shared',
    });

    expect(service.readByToken(link.token)).toEqual({
      docId: 'doc-1',
      accessMode: 'read-only',
      content: '# Shared',
    });
  });

  it('returns null for a revoked token without describing why', () => {
    const service = new ShareLinkService();
    const link = service.createLink({
      docId: 'doc-1',
      accessMode: 'read-only',
      expiresInMs: null,
      content: '# Shared',
    });
    service.revokeLink(link.id);

    expect(service.readByToken(link.token)).toBeNull();
  });

  it('keeps each untitled document links separate and moves them on save', () => {
    const service = new ShareLinkService();
    const first = service.createLink({
      docId: 'untitled:tab-a',
      accessMode: 'read-only',
      expiresInMs: null,
      content: '# First',
    });
    service.createLink({
      docId: 'untitled:tab-b',
      accessMode: 'read-only',
      expiresInMs: null,
      content: '# Second',
    });

    expect(service.getLinks('untitled:tab-b')).toHaveLength(1);
    const moved = service.moveUntitledDocument('untitled:tab-a', '/tmp/saved.md');

    expect(moved.map((link) => link.id)).toEqual([first.id]);
    expect(service.getLinks('untitled:tab-a')).toEqual([]);
    expect(service.readByToken(first.token)?.docId).toBe('/tmp/saved.md');
    expect(service.readByToken(first.token)?.content).toBe('# First');
  });

  it('leaves a saved file links on that file', () => {
    const service = new ShareLinkService();
    service.createLink({
      docId: '/tmp/one.md',
      accessMode: 'read-only',
      expiresInMs: null,
      content: '# One',
    });

    expect(() => service.moveUntitledDocument('/tmp/one.md', '/tmp/two.md')).toThrow(
      'Share links can only move from an untitled document'
    );
    expect(service.getLinks('/tmp/one.md')).toHaveLength(1);
  });

  it('returns null when the token is valid but no content was stored', () => {
    const service = new ShareLinkService();
    const link = service.createLink({
      docId: 'doc-1',
      accessMode: 'read-write',
      expiresInMs: null,
    });

    expect(service.readByToken(link.token)).toBeNull();
  });
});
