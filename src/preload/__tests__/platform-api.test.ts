import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IPC_CHANNELS } from '@shared/lib/ipc';

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
  },
}));

const mockValidatedInvoke = vi.fn();

vi.mock('../validated-invoke', () => ({
  validatedInvoke: (...args: unknown[]) => mockValidatedInvoke(...args),
}));

import { syncApi, collaborationApi, extensionPlatformApi, publishApi } from '../platform-api';

describe('platform-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes sync list/connect channels', async () => {
    mockValidatedInvoke.mockResolvedValueOnce({ providers: [] }).mockResolvedValueOnce({
      ok: true,
      status: { state: 'idle', lastSyncAt: Date.now(), message: null },
    });

    await syncApi.listProviders();
    await syncApi.connectProvider('mock-cloud');

    expect(mockValidatedInvoke).toHaveBeenNthCalledWith(
      1,
      IPC_CHANNELS.sync.listProviders,
      null,
      expect.any(Object)
    );
    expect(mockValidatedInvoke).toHaveBeenNthCalledWith(
      2,
      IPC_CHANNELS.sync.connectProvider,
      expect.any(Object),
      expect.any(Object),
      { providerId: 'mock-cloud' }
    );
  });

  it('invokes collaboration add comment channel', async () => {
    mockValidatedInvoke.mockResolvedValue({ thread: { id: 't1' } });

    await collaborationApi.addComment({
      documentId: 'doc-1',
      anchor: { blockId: 'b', startOffset: 0, endOffset: 1, headingPath: [] },
      author: 'alice',
      message: 'hello',
    });

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.collaboration.addComment,
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ documentId: 'doc-1' })
    );
  });

  it('invokes extension install channel', async () => {
    mockValidatedInvoke.mockResolvedValue({ ok: true });

    await extensionPlatformApi.install({
      manifest: {
        id: 'x.test',
        name: 'X',
        version: '0.1.0',
        entrypoint: 'index.js',
        capabilities: {},
      },
    });

    expect(mockValidatedInvoke).toHaveBeenCalledWith(
      IPC_CHANNELS.extension.install,
      expect.any(Object),
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('invokes publish channels', async () => {
    mockValidatedInvoke
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await publishApi.run({ providerId: 'filesystem-export', content: '# hi' });
    await publishApi.listProvenance();
    await publishApi.getBacklinks('file:///tmp/test.mdx');

    expect(mockValidatedInvoke).toHaveBeenNthCalledWith(
      1,
      IPC_CHANNELS.publish.run,
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ content: '# hi' })
    );
    expect(mockValidatedInvoke).toHaveBeenNthCalledWith(
      2,
      IPC_CHANNELS.publish.listProvenance,
      expect.any(Object),
      expect.any(Object),
      {}
    );
    expect(mockValidatedInvoke).toHaveBeenNthCalledWith(
      3,
      IPC_CHANNELS.publish.getBacklinks,
      expect.any(Object),
      expect.any(Object),
      { canonicalUrl: 'file:///tmp/test.mdx' }
    );
  });
});
