import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

import { MARKETPLACE_LIST_CHANNEL } from '@shared/contracts/marketplace-schemas';
import {
  registerMarketplaceHandlers,
  sanitizeMarketplaceCatalog,
} from '../template-marketplace-service';

const { handlers, handle } = vi.hoisted(() => {
  const registered: Record<string, (event: IpcMainInvokeEvent, request?: unknown) => unknown> = {};
  return {
    handlers: registered,
    handle: (
      channel: string,
      handler: (event: IpcMainInvokeEvent, request?: unknown) => unknown
    ) => {
      registered[channel] = handler;
    },
  };
});

vi.mock('electron', () => ({
  ipcMain: { handle },
}));

const validTemplate = {
  id: 'note',
  name: 'Note',
  description: 'A note',
  author: 'mdxpad',
  category: 'writing',
  previewUrl: 'https://example.com/preview',
  downloadUrl: 'https://example.com/note.mdx',
  version: '1.0.0',
  downloads: 3,
};

describe('marketplace catalog', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
    for (const key of Object.keys(handlers)) {
      delete handlers[key];
    }
  });

  it('drops catalog entries that do not match the template shape', () => {
    expect(sanitizeMarketplaceCatalog([validTemplate, { id: 'bad' }, 'nope'])).toEqual([
      validTemplate,
    ]);
  });

  it('registers catalog listing and does not register install', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-market-'));
    tempDirs.push(root);
    await writeFile(
      path.join(root, 'template-catalog.json'),
      JSON.stringify([validTemplate, { id: 'bad' }])
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const window = {
      webContents: { id: 4, send: vi.fn(), mainFrame: { routingId: 8 } },
    } as unknown as BrowserWindow;
    registerMarketplaceHandlers(window, root);

    expect(handlers['marketplace:install']).toBeUndefined();
    const list = handlers[MARKETPLACE_LIST_CHANNEL];
    await expect(
      list?.({
        sender: { id: 4 },
        senderFrame: { routingId: 8 },
      } as unknown as IpcMainInvokeEvent)
    ).resolves.toEqual({ success: true, data: [validTemplate] });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
