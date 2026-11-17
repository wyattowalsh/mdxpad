import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

import { SemanticSearchChannels } from '@shared/contracts/semantic-search-schemas';

import { EmbeddingsUnavailableError } from './embedding-availability';
import type { EmbeddingService } from './embedding-service';
import { registerSemanticSearchHandlers } from './semantic-search-handlers';

const handlers = new Map<
  string,
  (event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>
>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(
      (
        channel: string,
        handler: (event: IpcMainInvokeEvent, request: unknown) => Promise<unknown>
      ) => {
        handlers.set(channel, handler);
      }
    ),
  },
}));

function createWindow(): BrowserWindow {
  return {
    webContents: {
      id: 7,
      isDestroyed: () => false,
      mainFrame: { routingId: 11 },
    },
    isDestroyed: () => false,
  } as unknown as BrowserWindow;
}

function authorizedEvent(window: BrowserWindow): IpcMainInvokeEvent {
  return {
    sender: window.webContents,
    senderFrame: window.webContents.mainFrame,
  } as unknown as IpcMainInvokeEvent;
}

function unavailableService(): EmbeddingService {
  return {
    search: vi.fn(async () => {
      throw new EmbeddingsUnavailableError('No active provider');
    }),
    indexWorkspace: vi.fn(async () => {
      throw new EmbeddingsUnavailableError('No active provider');
    }),
    getIndexStatus: vi.fn(async () => ({
      isIndexed: false,
      fileCount: 0,
      chunkCount: 0,
      lastIndexedAt: null,
    })),
  } as unknown as EmbeddingService;
}

describe('registerSemanticSearchHandlers', () => {
  beforeEach(() => {
    handlers.clear();
  });

  it('returns EMBEDDINGS_UNAVAILABLE for search and index', async () => {
    const window = createWindow();
    const service = unavailableService();
    registerSemanticSearchHandlers(service, window);
    const event = authorizedEvent(window);

    const search = await handlers.get(SemanticSearchChannels.SEARCH)?.(event, {
      query: 'notes',
      workspacePath: '/workspace',
    });
    const index = await handlers.get(SemanticSearchChannels.INDEX)?.(event, {
      workspacePath: '/workspace',
    });

    expect(search).toMatchObject({
      success: false,
      error: { code: 'EMBEDDINGS_UNAVAILABLE' },
    });
    expect(index).toMatchObject({
      success: false,
      error: { code: 'EMBEDDINGS_UNAVAILABLE' },
    });
  });

  it('omits a null lastIndexedAt', async () => {
    const window = createWindow();
    registerSemanticSearchHandlers(unavailableService(), window);

    const status = await handlers.get(SemanticSearchChannels.INDEX_STATUS)?.(
      authorizedEvent(window),
      { workspacePath: '/workspace' }
    );

    expect(status).toEqual({
      success: true,
      isIndexed: false,
      fileCount: 0,
      chunkCount: 0,
    });
  });

  it('accepts a negative cosine score', async () => {
    const window = createWindow();
    const service = unavailableService();
    service.search = vi.fn(async () => [
      { filePath: '/workspace/a.md', content: 'a', score: -0.2, chunkIndex: 0 },
    ]);
    registerSemanticSearchHandlers(service, window);

    const search = await handlers.get(SemanticSearchChannels.SEARCH)?.(authorizedEvent(window), {
      query: 'notes',
      workspacePath: '/workspace',
    });

    expect(search).toMatchObject({
      success: true,
      results: [{ score: -0.2 }],
    });
  });

  it('rejects an unauthorized sender', async () => {
    const window = createWindow();
    registerSemanticSearchHandlers(unavailableService(), window);
    const handler = handlers.get(SemanticSearchChannels.SEARCH);
    const event = {
      sender: { id: window.webContents.id + 1, mainFrame: { routingId: 11 } },
      senderFrame: { routingId: 11 },
    } as unknown as IpcMainInvokeEvent;

    await expect(async () => {
      await handler?.(event, { query: 'notes', workspacePath: '/workspace' });
    }).rejects.toThrow('Unauthorized IPC sender');
  });
});
