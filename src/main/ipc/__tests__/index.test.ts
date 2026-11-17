import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';

import { IPC_CHANNELS } from '@shared/lib/ipc';

const {
  mockIpcMainHandle,
  mockIpcMainRemoveHandler,
  registerFileHandlersMock,
  registerWindowHandlersMock,
  registerAutosaveHandlersMock,
  registerAIHandlersMock,
  registerTemplateHandlersMock,
  registerPlatformHandlersMock,
  registerExportHandlersMock,
  registerWorkspaceHandlersMock,
  registerLinkHandlersMock,
  registerGitHandlersMock,
  registerSearchHandlersMock,
  registerImportHandlersMock,
  registerCitationHandlersMock,
  registerPluginHandlersMock,
  createAIServicesMock,
  autosaveSettingsServiceCtorMock,
  autosaveServiceCtorMock,
  recoveryServiceCtorMock,
  workspaceServiceCtorMock,
  pluginLoaderCtorMock,
} = vi.hoisted(() => ({
  mockIpcMainHandle: vi.fn(),
  mockIpcMainRemoveHandler: vi.fn(),
  registerFileHandlersMock: vi.fn(),
  registerWindowHandlersMock: vi.fn(),
  registerAutosaveHandlersMock: vi.fn(),
  registerAIHandlersMock: vi.fn(),
  registerTemplateHandlersMock: vi.fn(),
  registerPlatformHandlersMock: vi.fn(),
  registerExportHandlersMock: vi.fn(),
  registerWorkspaceHandlersMock: vi.fn(),
  registerLinkHandlersMock: vi.fn(),
  registerGitHandlersMock: vi.fn(),
  registerSearchHandlersMock: vi.fn(),
  registerImportHandlersMock: vi.fn(),
  registerCitationHandlersMock: vi.fn(),
  registerPluginHandlersMock: vi.fn(),
  createAIServicesMock: vi.fn(() => ({})),
  autosaveSettingsServiceCtorMock: vi.fn(() => ({})),
  autosaveServiceCtorMock: vi.fn(() => ({})),
  recoveryServiceCtorMock: vi.fn(() => ({})),
  workspaceServiceCtorMock: vi.fn(() => ({})),
  pluginLoaderCtorMock: vi.fn(() => ({})),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockIpcMainHandle,
    removeHandler: mockIpcMainRemoveHandler,
  },
  BrowserWindow: vi.fn(),
  app: {
    getPath: vi.fn(() => '/tmp'),
  },
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

vi.mock('../platform-handlers', () => ({
  registerPlatformHandlers: registerPlatformHandlersMock,
}));

vi.mock('../export-handlers', () => ({
  EXPORT_IPC_CHANNELS: {
    jobLifecycle: 'mdxpad:export:job-lifecycle',
    presetCrud: 'mdxpad:export:preset-crud',
    cliInvoke: 'mdxpad:export:cli-invoke',
    llmsGenerate: 'mdxpad:export:llms-generate',
  },
  registerExportHandlers: registerExportHandlersMock,
}));

vi.mock('../workspace-handlers', () => ({
  registerWorkspaceHandlers: registerWorkspaceHandlersMock,
}));

vi.mock('../link-handlers', () => ({
  registerLinkHandlers: registerLinkHandlersMock,
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

vi.mock('@main/services/workspace-service', () => ({
  WorkspaceService: workspaceServiceCtorMock,
}));

vi.mock('@main/services/git/git-handlers', () => ({
  registerGitHandlers: registerGitHandlersMock,
}));

vi.mock('@main/services/search/search-handlers', () => ({
  registerSearchHandlers: registerSearchHandlersMock,
}));

vi.mock('@main/services/import/import-handlers', () => ({
  registerImportHandlers: registerImportHandlersMock,
}));

vi.mock('@main/services/citation/citation-handlers', () => ({
  registerCitationHandlers: registerCitationHandlersMock,
}));

vi.mock('@main/services/plugin/plugin-handlers', () => ({
  registerPluginHandlers: registerPluginHandlersMock,
  PLUGIN_CHANNELS: {
    list: 'mdxpad:plugin:list',
    install: 'mdxpad:plugin:install',
    uninstall: 'mdxpad:plugin:uninstall',
    enable: 'mdxpad:plugin:enable',
    disable: 'mdxpad:plugin:disable',
  },
}));

vi.mock('@main/services/plugin/plugin-loader', () => ({
  PluginLoader: pluginLoaderCtorMock,
}));

import { registerIpcHandlers } from '../index';

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
  });

  it('rejects unauthorized sender for app:get-security-info', () => {
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
  }, 10_000);

  it('rejects unauthorized frame for app:get-security-info', () => {
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
      getSecurityInfoHandler!(
        createInvokeEvent(window, {
          senderFrameRoutingId: window.webContents.mainFrame.routingId + 1,
        })
      )
    ).toThrow('Unauthorized IPC sender');
  }, 10_000);

  it('passes BrowserWindow to autosave and template registration wiring', () => {
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
    expect(registerPlatformHandlersMock).toHaveBeenCalledWith(
      expect.objectContaining({ handle: mockIpcMainHandle }),
      window
    );
    expect(registerExportHandlersMock).toHaveBeenCalledWith(
      expect.objectContaining({ handle: mockIpcMainHandle }),
      window
    );
    expect(registerWorkspaceHandlersMock).toHaveBeenCalledWith(
      expect.objectContaining({ handle: mockIpcMainHandle }),
      window,
      expect.any(Object)
    );
    expect(registerLinkHandlersMock).toHaveBeenCalledWith(
      expect.objectContaining({ handle: mockIpcMainHandle }),
      window,
      expect.any(Object)
    );
    expect(registerPluginHandlersMock).toHaveBeenCalledWith(
      expect.objectContaining({ handle: mockIpcMainHandle }),
      window,
      expect.any(Object)
    );

    const sharedWorkspaceService = registerWorkspaceHandlersMock.mock.calls.at(-1)?.[2];
    expect(sharedWorkspaceService).toBeDefined();
    expect(registerLinkHandlersMock.mock.calls.at(-1)?.[2]).toBe(sharedWorkspaceService);
  });

  it('removes semantic search handlers before rebinding a window', () => {
    registerIpcHandlers(createMockWindow());

    expect(mockIpcMainRemoveHandler).toHaveBeenCalledWith('mdxpad:semantic:search');
    expect(mockIpcMainRemoveHandler).toHaveBeenCalledWith('mdxpad:semantic:index');
    expect(mockIpcMainRemoveHandler).toHaveBeenCalledWith('mdxpad:semantic:index-status');
  });

  it('authorizes app:get-security-info against recreated window context', () => {
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
