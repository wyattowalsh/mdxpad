import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';

import { IPC_CHANNELS } from '@shared/lib/ipc';

const mockIpcMainHandle = vi.fn();
const mockIpcMainRemoveHandler = vi.fn();

const registerFileHandlersMock = vi.fn();
const registerWindowHandlersMock = vi.fn();
const registerAutosaveHandlersMock = vi.fn();
const registerAIHandlersMock = vi.fn();
const registerTemplateHandlersMock = vi.fn();
const createAIServicesMock = vi.fn(() => ({}));
const autosaveSettingsServiceCtorMock = vi.fn(() => ({}));
const autosaveServiceCtorMock = vi.fn(() => ({}));
const recoveryServiceCtorMock = vi.fn(() => ({}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcMainHandle,
    removeHandler: mockIpcMainRemoveHandler,
  },
  BrowserWindow: vi.fn(),
}));

vi.mock('../file-handlers', () => ({
  registerFileHandlers: registerFileHandlersMock,
}));

vi.mock('../window-handlers', () => ({
  registerWindowHandlers: registerWindowHandlersMock,
}));

vi.mock('../autosave-handlers', () => ({
  registerAutosaveHandlers: registerAutosaveHandlersMock,
}));

vi.mock('../ai-handlers', () => ({
  registerAIHandlers: registerAIHandlersMock,
}));

vi.mock('@main/services/template-service', () => ({
  registerTemplateHandlers: registerTemplateHandlersMock,
}));

vi.mock('@main/services/ai', () => ({
  createAIServices: createAIServicesMock,
}));

vi.mock('@main/services/autosave-settings', () => ({
  AutosaveSettingsService: autosaveSettingsServiceCtorMock,
}));

vi.mock('@main/services/autosave-service', () => ({
  AutosaveService: autosaveServiceCtorMock,
}));

vi.mock('@main/services/recovery-service', () => ({
  RecoveryService: recoveryServiceCtorMock,
}));

function createMockWindow(): BrowserWindow {
  return {
    webContents: {
      id: 33,
      mainFrame: { routingId: 44 },
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

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('rejects unauthorized sender for app:get-security-info', async () => {
    const { registerIpcHandlers } = await import('../index');
    const window = createMockWindow();

    registerIpcHandlers(window);

    const getSecurityInfoCall = mockIpcMainHandle.mock.calls.find(
      ([channel]) => channel === IPC_CHANNELS.app.getSecurityInfo
    );
    const getSecurityInfoHandler = getSecurityInfoCall?.[1] as
      | ((event: unknown) => unknown)
      | undefined;

    expect(getSecurityInfoHandler).toBeDefined();

    expect(() =>
      getSecurityInfoHandler!(createInvokeEvent(window, { senderId: window.webContents.id + 1 }))
    ).toThrow('Unauthorized IPC sender');
  });

  it('passes BrowserWindow to autosave and template registration wiring', async () => {
    const { registerIpcHandlers } = await import('../index');
    const window = createMockWindow();

    registerIpcHandlers(window);

    expect(registerAutosaveHandlersMock).toHaveBeenCalledWith(
      expect.objectContaining({ handle: mockIpcMainHandle }),
      expect.any(Object),
      window
    );
    expect(registerTemplateHandlersMock).toHaveBeenCalledWith(
      expect.objectContaining({ handle: mockIpcMainHandle }),
      window
    );
  });

  it('authorizes app:get-security-info against recreated window context', async () => {
    const { registerIpcHandlers } = await import('../index');
    const firstWindow = createMockWindow();
    const recreatedWindow = {
      webContents: {
        id: 99,
        mainFrame: { routingId: 199 },
      },
    } as unknown as BrowserWindow;

    registerIpcHandlers(firstWindow);
    registerIpcHandlers(recreatedWindow);

    const getSecurityInfoCalls = mockIpcMainHandle.mock.calls.filter(
      ([channel]) => channel === IPC_CHANNELS.app.getSecurityInfo
    );
    const getSecurityInfoHandler = getSecurityInfoCalls.at(-1)?.[1] as
      | ((event: unknown) => unknown)
      | undefined;

    expect(getSecurityInfoHandler).toBeDefined();

    expect(() => getSecurityInfoHandler!(createInvokeEvent(recreatedWindow))).not.toThrow();
  });
});
