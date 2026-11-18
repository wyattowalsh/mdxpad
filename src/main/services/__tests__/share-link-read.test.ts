import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ShareLinkService } from '../share-link-service';

describe('ShareLinkService.readByToken', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('remembers a share link after a new service reads the same file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-share-store-'));
    tempDirs.push(root);
    const storagePath = path.join(root, 'share-links.json');
    const first = new ShareLinkService({ storagePath });
    const link = first.createLink({
      docId: 'doc-1',
      accessMode: 'read-only',
      expiresInMs: null,
      content: '# Shared',
    });
    await first.whenSaved();

    const second = new ShareLinkService({ storagePath });
    expect(second.readByToken(link.token)).toEqual({
      docId: 'doc-1',
      accessMode: 'read-only',
      content: '# Shared',
    });
  });

  it('removes a share link when saving it fails', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-share-fail-'));
    tempDirs.push(root);
    const blocked = path.join(root, 'blocked');
    await writeFile(blocked, 'not a directory');
    const service = new ShareLinkService({
      storagePath: path.join(blocked, 'share-links.json'),
    });
    const link = service.createLink({
      docId: 'doc-1',
      accessMode: 'read-only',
      expiresInMs: null,
      content: '# Shared',
    });
    await service.whenSaved();

    expect(service.getLink(link.id)).toBeNull();
    expect(service.getLinks()).toEqual([]);
  });

  it('does not read or write a share list through a link', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-share-link-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-share-secret-'));
    tempDirs.push(root, outside);
    const secret = path.join(outside, 'links.json');
    const storagePath = path.join(root, 'share-links.json');
    await writeFile(secret, '{"secret":true}\n');
    await symlink(secret, storagePath);
    const service = new ShareLinkService({ storagePath });

    expect(service.getLinks()).toEqual([]);
    service.createLink({
      docId: 'doc-1',
      accessMode: 'read-only',
      expiresInMs: null,
      content: '# Local',
    });
    await service.whenSaved();

    expect(await readFile(secret, 'utf-8')).toBe('{"secret":true}\n');
    expect((await lstat(storagePath)).isSymbolicLink()).toBe(false);
    expect(new ShareLinkService({ storagePath }).getLinks()).toHaveLength(1);
  });

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
