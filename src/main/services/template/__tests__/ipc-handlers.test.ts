import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow, IpcMain } from 'electron';

import { IPC_CHANNELS } from '@shared/lib/ipc';
import { registerTemplateHandlers } from '../index';
import { handleTemplateList } from '../handlers';

vi.mock('../handlers', () => ({
  handleTemplateList: vi.fn().mockResolvedValue({ templates: [] }),
  handleTemplateGet: vi.fn(),
  handleTemplateSave: vi.fn(),
  handleTemplateDelete: vi.fn(),
  handleTemplateImport: vi.fn(),
  handleTemplateExport: vi.fn(),
  handleTemplateValidate: vi.fn(),
  handleCreateFromTemplate: vi.fn(),
  handleTemplateOpenDialog: vi.fn(),
  handleTemplateSaveDialog: vi.fn(),
}));

const mockIpcMain = {
  handle: vi.fn(),
} as unknown as IpcMain;

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 11,
      mainFrame: { routingId: 22 },
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

describe('registerTemplateHandlers authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers template handlers', () => {
    const window = createMockWindow();

    registerTemplateHandlers(mockIpcMain, window);

    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.template.list,
      expect.any(Function)
    );
  });

  it('rejects unauthorized sender for template:list', async () => {
    const window = createMockWindow();
    const handlers = new Map<string, (event: unknown, payload: unknown) => Promise<unknown>>();

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers.set(
        channel,
        handler as unknown as (event: unknown, payload: unknown) => Promise<unknown>
      );
    });

    registerTemplateHandlers(mockIpcMain, window);

    const listHandler = handlers.get(IPC_CHANNELS.template.list);
    expect(listHandler).toBeDefined();

    expect(() =>
      listHandler!(
        createInvokeEvent(window, { senderId: window.webContents.id + 1 }),
        undefined
      )
    ).toThrow('Unauthorized IPC sender');
    expect(handleTemplateList).not.toHaveBeenCalled();
  });
});
