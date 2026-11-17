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
