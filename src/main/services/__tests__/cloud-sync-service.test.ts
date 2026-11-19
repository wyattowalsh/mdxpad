import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CloudSyncService } from '../cloud-sync-service';

describe('CloudSyncService', () => {
  let tempDir = '';

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-cloud-sync-'));
  });

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('lists sync providers and exposes mock-cloud adapter', async () => {
    const service = new CloudSyncService(tempDir);
    const providers = await service.listProviders();

    const mockProvider = providers.find((provider) => provider.id === 'mock-cloud');
    expect(mockProvider).toBeDefined();
    expect(mockProvider?.connected).toBe(false);
    expect(mockProvider?.capabilities.deltaPull).toBe(true);
  });

  it('connects provider and supports push/pull with revisions', async () => {
    const service = new CloudSyncService(tempDir);
    const connect = await service.connectProvider('mock-cloud');
    expect(connect.ok).toBe(true);

    const push = await service.pushDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-1',
      filePath: '/workspace/doc-1.mdx',
      content: '# Hello',
    });
    expect(push.ok).toBe(true);
    expect(push.revision).toBe(1);

    const pull = await service.pullDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-1',
    });
    expect(pull.ok).toBe(true);
    expect(pull.content).toBe('# Hello');
    expect(pull.revision).toBe(1);
  });

  it('reports deterministic conflict metadata for stale base revisions', async () => {
    const service = new CloudSyncService(tempDir);
    await service.connectProvider('mock-cloud');

    await service.pushDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-2',
      filePath: '/workspace/doc-2.mdx',
      content: '# v1',
    });

    await service.pushDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-2',
      filePath: '/workspace/doc-2.mdx',
      content: '# v2',
    });

    const stalePush = await service.pushDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-2',
      filePath: '/workspace/doc-2.mdx',
      content: '# stale',
      baseRevision: 1,
    });

    expect(stalePush.ok).toBe(true);
    expect(stalePush.conflicts.length).toBeGreaterThan(0);
    expect(stalePush.revision).toBe(3);
  });

  it('serializes concurrent pushes for same document without losing revision progression', async () => {
    const service = new CloudSyncService(tempDir);
    await service.connectProvider('mock-cloud');

    const totalPushes = 20;
    const pushes = Array.from({ length: totalPushes }, (_, index) =>
      service.pushDocument({
        providerId: 'mock-cloud',
        documentId: 'doc-concurrent',
        filePath: '/workspace/doc-concurrent.mdx',
        content: `# v${index + 1}`,
      })
    );

    const results = await Promise.all(pushes);
    const revisions = results.map((result) => result.revision).sort((left, right) => left - right);
    expect(revisions).toEqual(Array.from({ length: totalPushes }, (_, index) => index + 1));

    const pull = await service.pullDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-concurrent',
    });
    expect(pull.revision).toBe(totalPushes);
  });

  it('preserves conflict metadata semantics under concurrent stale-base pushes', async () => {
    const service = new CloudSyncService(tempDir);
    await service.connectProvider('mock-cloud');

    await service.pushDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-concurrent-conflict',
      filePath: '/workspace/doc-concurrent-conflict.mdx',
      content: '# base',
    });

    const [pushA, pushB] = await Promise.all([
      service.pushDocument({
        providerId: 'mock-cloud',
        documentId: 'doc-concurrent-conflict',
        filePath: '/workspace/doc-concurrent-conflict.mdx',
        content: '# branch-a',
        baseRevision: 1,
      }),
      service.pushDocument({
        providerId: 'mock-cloud',
        documentId: 'doc-concurrent-conflict',
        filePath: '/workspace/doc-concurrent-conflict.mdx',
        content: '# branch-b',
        baseRevision: 1,
      }),
    ]);

    const conflictCounts = [pushA, pushB].map((push) => push.conflicts.length);
    expect(conflictCounts.filter((count) => count === 0)).toHaveLength(1);
    expect(conflictCounts.filter((count) => count > 0)).toHaveLength(1);

    const revisions = [pushA.revision, pushB.revision].sort((left, right) => left - right);
    expect(revisions).toEqual([2, 3]);
  });

  it('does not pull a document through a link', async () => {
    const service = new CloudSyncService(tempDir);
    await service.connectProvider('mock-cloud');
    const outside = path.join(tempDir, 'outside.json');
    const documentPath = path.join(tempDir, 'mock-cloud', 'documents', 'doc-1.json');
    await mkdir(path.dirname(documentPath), { recursive: true });
    await writeFile(
      outside,
      JSON.stringify({
        documentId: 'doc-1',
        filePath: '/secret.mdx',
        content: 'hidden',
        checksum: 'x',
        revision: 9,
        updatedAt: 1,
      }),
      'utf-8'
    );
    await symlink(outside, documentPath);

    const pull = await service.pullDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-1',
    });
    expect(pull.content).toBeNull();

    const push = await service.pushDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-1',
      filePath: '/workspace/doc-1.mdx',
      content: '# Local',
    });
    expect(push.revision).toBe(1);
    expect(await readFile(outside, 'utf-8')).toContain('hidden');
    expect((await lstat(documentPath)).isSymbolicLink()).toBe(false);

    const again = await service.pullDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-1',
    });
    expect(again.content).toBe('# Local');
  });

  it('does not pull a document through a linked provider folder', async () => {
    const service = new CloudSyncService(tempDir, tempDir);
    await service.connectProvider('mock-cloud');
    const outside = path.join(tempDir, 'outside-docs');
    await mkdir(path.join(outside, 'documents'), { recursive: true });
    const secret = path.join(outside, 'documents', 'doc-1.json');
    await writeFile(
      secret,
      JSON.stringify({
        documentId: 'doc-1',
        filePath: '/secret.mdx',
        content: 'hidden',
        checksum: 'x',
        revision: 4,
        updatedAt: 1,
      })
    );
    await rm(path.join(tempDir, 'mock-cloud'), { recursive: true, force: true });
    await symlink(outside, path.join(tempDir, 'mock-cloud'));

    const pull = await service.pullDocument({
      providerId: 'mock-cloud',
      documentId: 'doc-1',
    });

    expect(pull.content).toBeNull();
    expect(await readFile(secret, 'utf8')).toContain('hidden');
    expect((await lstat(path.join(tempDir, 'mock-cloud'))).isSymbolicLink()).toBe(false);
  });

  it('does not read connections through a linked parent folder', async () => {
    const outside = path.join(tempDir, 'outside');
    const store = path.join(outside, 'cloud-sync');
    await mkdir(store, { recursive: true });
    const secret = path.join(store, 'connections.json');
    await writeFile(secret, JSON.stringify({ connectedProviders: ['mock-cloud'] }));
    const appLink = path.join(tempDir, 'userData');
    await symlink(outside, appLink);

    const service = new CloudSyncService(path.join(appLink, 'cloud-sync'), appLink);
    const providers = await service.listProviders();

    expect(providers.find((provider) => provider.id === 'mock-cloud')?.connected).toBe(false);
    expect(await readFile(secret, 'utf8')).toContain('mock-cloud');
    expect((await lstat(appLink)).isSymbolicLink()).toBe(false);
  });
});
