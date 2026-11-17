import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/lib/ipc';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}));

import { registerCollaborationHandlers, registerPlatformHandlers } from '../platform-handlers';

describe('registerPlatformHandlers', () => {
  it('leaves collaboration unregistered until a screen calls it', () => {
    const channels: string[] = [];
    const ipcMain = {
      handle: (channel: string) => {
        channels.push(channel);
      },
    } as unknown as IpcMain;

    registerPlatformHandlers(ipcMain, {} as BrowserWindow);

    for (const channel of Object.values(IPC_CHANNELS.collaboration)) {
      expect(channels).not.toContain(channel);
    }
    expect(channels).toContain(IPC_CHANNELS.publish.run);

    const optedIn: string[] = [];
    registerCollaborationHandlers(
      {
        handle: (channel: string) => {
          optedIn.push(channel);
        },
      } as unknown as IpcMain,
      {} as BrowserWindow
    );
    expect(optedIn).toEqual(Object.values(IPC_CHANNELS.collaboration));
  });
});
