import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

import { MARKETPLACE_LIST_CHANNEL } from '@shared/contracts/marketplace-schemas';
import {
  catalogFromTemplateDirectory,
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

  it('does not list a catalog that is a link', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-market-'));
    tempDirs.push(root);
    const outside = path.join(root, 'outside.json');
    await writeFile(
      outside,
      JSON.stringify([{ ...validTemplate, id: 'secret', name: 'Secret Catalog' }])
    );
    await symlink(outside, path.join(root, 'template-catalog.json'));
    const window = {
      webContents: { id: 4, send: vi.fn(), mainFrame: { routingId: 8 } },
    } as unknown as BrowserWindow;
    registerMarketplaceHandlers(window, root);

    const list = handlers[MARKETPLACE_LIST_CHANNEL];
    const result = await list?.({
      sender: { id: 4 },
      senderFrame: { routingId: 8 },
    } as unknown as IpcMainInvokeEvent);
    const names = (result as { data: { name: string }[] }).data.map((item) => item.name);

    expect(names).not.toContain('Secret Catalog');
    expect(names).toContain('Blog Post');
  });

  it('does not list a catalog through a linked resources folder', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-market-parent-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-market-parent-out-'));
    tempDirs.push(root, outside);
    await writeFile(
      path.join(outside, 'template-catalog.json'),
      JSON.stringify([{ ...validTemplate, id: 'secret', name: 'Secret Catalog' }])
    );
    const linked = path.join(root, 'resources');
    await symlink(outside, linked);
    const window = {
      webContents: { id: 4, send: vi.fn(), mainFrame: { routingId: 8 } },
    } as unknown as BrowserWindow;
    registerMarketplaceHandlers(window, linked);

    const list = handlers[MARKETPLACE_LIST_CHANNEL];
    const result = await list?.({
      sender: { id: 4 },
      senderFrame: { routingId: 8 },
    } as unknown as IpcMainInvokeEvent);
    const names = (result as { data: { name: string }[] }).data.map((item) => item.name);

    expect(names).not.toContain('Secret Catalog');
    expect(await readFile(path.join(outside, 'template-catalog.json'), 'utf8')).toContain(
      'Secret Catalog'
    );
    expect((await lstat(linked)).isSymbolicLink()).toBe(true);
  });

  it('lists the templates shipped with the app when no catalog file exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-market-'));
    tempDirs.push(root);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const window = {
      webContents: { id: 4, send: vi.fn(), mainFrame: { routingId: 8 } },
    } as unknown as BrowserWindow;
    registerMarketplaceHandlers(window, root);

    const list = handlers[MARKETPLACE_LIST_CHANNEL];
    const result = await list?.({
      sender: { id: 4 },
      senderFrame: { routingId: 8 },
    } as unknown as IpcMainInvokeEvent);

    expect(result).toMatchObject({ success: true });
    const names = (result as { data: { name: string }[] }).data.map((item) => item.name);
    expect(names).toContain('Blog Post');
    expect(names).toContain('Meeting Notes');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(handlers['marketplace:install']).toBeUndefined();
    fetchSpy.mockRestore();
  });

  it('builds a catalog entry from a template file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-market-'));
    tempDirs.push(root);
    await writeFile(
      path.join(root, 'field-note.mdxt'),
      `---
name: "Field Note"
description: "A short field note"
category: "notes"
author: "mdxpad"
---

# Note
`
    );

    await expect(catalogFromTemplateDirectory(root)).resolves.toEqual([
      {
        id: 'field-note',
        name: 'Field Note',
        description: 'A short field note',
        author: 'mdxpad',
        category: 'notes',
        previewUrl: '',
        downloadUrl: '',
        version: '1.0.0',
        downloads: 0,
      },
    ]);
  });

  it('does not read templates through a linked resources folder', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-market-link-'));
    const outside = await mkdtemp(path.join(os.tmpdir(), 'mdxpad-market-outside-'));
    tempDirs.push(root, outside);
    await mkdir(path.join(outside, 'templates'), { recursive: true });
    await writeFile(
      path.join(outside, 'templates', 'secret.mdxt'),
      '---\nname: Secret\nid: secret\ncategory: writing\n---\nHi\n'
    );
    await symlink(outside, path.join(root, 'resources'));

    await expect(
      catalogFromTemplateDirectory(path.join(root, 'resources', 'templates'))
    ).resolves.toEqual([]);
    expect(await readFile(path.join(outside, 'templates', 'secret.mdxt'), 'utf8')).toContain(
      'Secret'
    );
  });
});
