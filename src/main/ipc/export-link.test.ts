import { lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dialog, type BrowserWindow, type IpcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/lib/ipc';

import { resetFileCapabilities } from './document-capability';
import { registerFileHandlers } from './file-handlers';

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.0.0',
    getPath: () => '/tmp',
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

vi.mock('@main/menu', () => ({
  addToRecentFiles: vi.fn(),
}));

const directories: string[] = [];

function createWindow(): BrowserWindow {
  return {
    webContents: {
      id: 42,
      mainFrame: { routingId: 99 },
    },
  } as unknown as BrowserWindow;
}

function handlersFor(window: BrowserWindow): Record<string, (...args: unknown[]) => Promise<unknown>> {
  const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  const ipc = {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers[channel] = handler;
    },
  } as unknown as IpcMain;
  registerFileHandlers(ipc, window);
  return handlers;
}

describe('file export links', () => {
  afterEach(async () => {
    resetFileCapabilities();
    vi.clearAllMocks();
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  async function plantedExport(name: string): Promise<{ link: string; secret: string }> {
    const root = await mkdtemp(path.join(tmpdir(), 'mdxpad-export-link-'));
    directories.push(root);
    const secret = path.join(root, `secret-${name}`);
    const link = path.join(root, name);
    await writeFile(secret, 'secret');
    await symlink(secret, link);
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: link,
    });
    return { link, secret };
  }

  it('replaces a markdown export link instead of writing the linked file', async () => {
    const window = createWindow();
    const exportFile = handlersFor(window)[IPC_CHANNELS.file.export];
    const { link, secret } = await plantedExport('note.md');

    const result = await exportFile?.(
      {
        sender: { id: 42, mainFrame: { routingId: 99 } },
        senderFrame: { routingId: 99 },
      },
      { content: '# Note', format: 'markdown' }
    );

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(await readFile(secret, 'utf8')).toBe('secret');
    expect((await lstat(link)).isSymbolicLink()).toBe(false);
    expect(await readFile(link, 'utf8')).toBe('# Note');
  });

  it('replaces a LaTeX export link instead of writing the linked file', async () => {
    const window = createWindow();
    const exportFile = handlersFor(window)[IPC_CHANNELS.file.export];
    const { link, secret } = await plantedExport('note.tex');

    const result = await exportFile?.(
      {
        sender: { id: 42, mainFrame: { routingId: 99 } },
        senderFrame: { routingId: 99 },
      },
      { content: '# Note', format: 'latex' }
    );

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(await readFile(secret, 'utf8')).toBe('secret');
    expect((await lstat(link)).isSymbolicLink()).toBe(false);
    expect(await readFile(link, 'utf8')).toContain('\\documentclass');
  });
});
