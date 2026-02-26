import { mkdtemp, rm } from 'node:fs/promises';
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
});
