import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow, IpcMain } from 'electron';

import { PLUGIN_CHANNELS, registerPluginHandlers } from '@main/services/plugin/plugin-handlers';
import type { PluginLoader } from '@main/services/plugin/plugin-loader';

const mockIpcMainHandle = vi.hoisted(() => vi.fn());
const mockIpcMain = {
  handle: mockIpcMainHandle,
} as unknown as IpcMain;

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcMainHandle,
  },
}));

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 42,
      mainFrame: { routingId: 99 },
    },
  } as unknown as BrowserWindow;
}

function createInvokeEvent(
  window: BrowserWindow,
  overrides?: { senderId?: number; senderFrameRoutingId?: number }
) {
  const senderId = overrides?.senderId ?? window.webContents.id;
  const senderFrameRoutingId =
    overrides?.senderFrameRoutingId ?? window.webContents.mainFrame.routingId;

  return {
    sender: {
      id: senderId,
      mainFrame: { routingId: window.webContents.mainFrame.routingId },
    },
    senderFrame: { routingId: senderFrameRoutingId },
  };
}

describe('registerPluginHandlers authorization', () => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;
  const listPluginsMock = vi.fn().mockResolvedValue([]);

  const loader = {
    listPlugins: listPluginsMock,
  } as unknown as PluginLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = {};

    mockIpcMainHandle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });
  });

  it('allows authorized sender/main-frame for plugin:list', async () => {
    const window = createMockWindow();

    registerPluginHandlers(mockIpcMain, window, loader);

    await expect(handlers[PLUGIN_CHANNELS.list]!(createInvokeEvent(window), undefined)).resolves.toEqual(
      { plugins: [] }
    );
    expect(listPluginsMock).toHaveBeenCalled();
  });

  it('rejects unauthorized sender for plugin:list', async () => {
    const window = createMockWindow();

    registerPluginHandlers(mockIpcMain, window, loader);

    expect(() =>
      handlers[PLUGIN_CHANNELS.list]!(
        createInvokeEvent(window, { senderId: window.webContents.id + 1 }),
        undefined
      )
    ).toThrow('Unauthorized IPC sender');
    expect(listPluginsMock).not.toHaveBeenCalled();
  });
});
