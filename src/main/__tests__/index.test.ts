import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';

const {
  eventHandlers,
  setWhenReadyPromise,
  mockRequestSingleInstanceLock,
  mockQuit,
  mockWhenReady,
  mockGetAllWindows,
  mockCreateWindow,
  mockLoadContent,
  mockRegisterIpcHandlers,
  mockInitializeApplicationMenu,
  mockRegisterPreviewFrameProtocol,
  mockAutoSaveManager,
} = vi.hoisted(() => {
  const eventHandlers: Record<string, () => void> = {};
  let whenReadyPromise: Promise<void> = Promise.resolve();

  const mockRequestSingleInstanceLock = vi.fn(() => true);
  const mockQuit = vi.fn();
  const mockWhenReady = vi.fn(() => whenReadyPromise);
  const mockGetAllWindows = vi.fn(() => [] as BrowserWindow[]);

  const mockCreateWindow = vi.fn();
  const mockLoadContent = vi.fn();
  const mockRegisterIpcHandlers = vi.fn();
  const mockInitializeApplicationMenu = vi.fn();
  const mockRegisterPreviewFrameProtocol = vi.fn();

  const mockAutoSaveManager = {
    findRecoverable: vi.fn(async () => []),
    cleanupEntry: vi.fn(async () => {}),
    start: vi.fn(),
    stop: vi.fn(),
  };

  return {
    eventHandlers,
    setWhenReadyPromise: (promise: Promise<void>) => {
      whenReadyPromise = promise;
    },
    mockRequestSingleInstanceLock,
    mockQuit,
    mockWhenReady,
    mockGetAllWindows,
    mockCreateWindow,
    mockLoadContent,
    mockRegisterIpcHandlers,
    mockInitializeApplicationMenu,
    mockRegisterPreviewFrameProtocol,
    mockAutoSaveManager,
  };
});

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: mockRequestSingleInstanceLock,
    quit: mockQuit,
    whenReady: mockWhenReady,
    on: vi.fn((event: string, handler: () => void) => {
      eventHandlers[event] = handler;
    }),
  },
  BrowserWindow: {
    getAllWindows: mockGetAllWindows,
  },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 1 }),
  },
}));

vi.mock('../window', () => ({
  createWindow: mockCreateWindow,
  loadContent: mockLoadContent,
}));

vi.mock('../ipc', () => ({
  registerIpcHandlers: mockRegisterIpcHandlers,
}));

vi.mock('../menu', () => ({
  initializeApplicationMenu: mockInitializeApplicationMenu,
}));

vi.mock('../preview-frame-protocol', () => ({
  registerPreviewFrameProtocol: mockRegisterPreviewFrameProtocol,
}));

vi.mock('../services/auto-save', () => ({
  AutoSaveManager: vi.fn(() => mockAutoSaveManager),
}));

function createDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

function getSecondInstanceHandler(): () => void {
  const handler = eventHandlers['second-instance'];
  if (!handler) {
    throw new Error('Expected second-instance handler to be registered');
  }
  return handler;
}

function createMockWindow(options?: { minimized?: boolean; destroyed?: boolean }): BrowserWindow {
  const minimized = options?.minimized ?? false;
  const destroyed = options?.destroyed ?? false;

  return {
    isMinimized: vi.fn(() => minimized),
    restore: vi.fn(),
    focus: vi.fn(),
    isDestroyed: vi.fn(() => destroyed),
    webContents: {
      once: vi.fn(),
      send: vi.fn(),
    },
  } as unknown as BrowserWindow;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('main process second-instance behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockRequestSingleInstanceLock.mockReturnValue(true);

    for (const key of Object.keys(eventHandlers)) {
      delete eventHandlers[key];
    }

    const deferred = createDeferred();
    setWhenReadyPromise(deferred.promise);

    mockGetAllWindows.mockReturnValue([]);
    mockAutoSaveManager.findRecoverable.mockResolvedValue([]);
  });

  it('quits immediately when single-instance lock is unavailable', async () => {
    mockRequestSingleInstanceLock.mockReturnValue(false);

    await import('../index');

    expect(mockQuit).toHaveBeenCalledTimes(1);
    expect(mockWhenReady).not.toHaveBeenCalled();
    expect(eventHandlers['second-instance']).toBeUndefined();
  });

  it('does not create a window from second-instance before initial startup window exists', async () => {
    await import('../index');

    getSecondInstanceHandler()();

    expect(mockCreateWindow).not.toHaveBeenCalled();
    expect(mockLoadContent).not.toHaveBeenCalled();
  });

  it('focuses an existing window when cached mainWindow is unavailable', async () => {
    const fallbackWindow = createMockWindow();
    mockGetAllWindows.mockReturnValue([fallbackWindow]);

    await import('../index');

    getSecondInstanceHandler()();

    expect(fallbackWindow.focus).toHaveBeenCalledTimes(1);
    expect(fallbackWindow.restore).not.toHaveBeenCalled();
  });

  it('restores and focuses a cached minimized mainWindow', async () => {
    const deferred = createDeferred();
    setWhenReadyPromise(deferred.promise);

    const mainWindow = createMockWindow({ minimized: true });
    mockCreateWindow.mockReturnValue(mainWindow);

    await import('../index');

    deferred.resolve();
    await flushMicrotasks();

    getSecondInstanceHandler()();

    expect(mainWindow.restore).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
  });

  it('focuses a non-destroyed window when cached mainWindow was destroyed', async () => {
    const deferred = createDeferred();
    setWhenReadyPromise(deferred.promise);

    const destroyedMainWindow = createMockWindow({ destroyed: true });
    const fallbackWindow = createMockWindow();

    mockCreateWindow.mockReturnValue(destroyedMainWindow);
    mockGetAllWindows.mockReturnValue([fallbackWindow]);

    await import('../index');

    deferred.resolve();
    await flushMicrotasks();

    getSecondInstanceHandler()();

    expect(destroyedMainWindow.focus).not.toHaveBeenCalled();
    expect(fallbackWindow.focus).toHaveBeenCalledTimes(1);
  });

  it('still creates the first window when crash recovery lookup fails', async () => {
    const deferred = createDeferred();
    setWhenReadyPromise(deferred.promise);
    mockAutoSaveManager.findRecoverable.mockRejectedValueOnce(
      new Error('recovery lookup failed')
    );

    await import('../index');

    deferred.resolve();
    await flushMicrotasks();

    expect(mockRegisterPreviewFrameProtocol).toHaveBeenCalledTimes(1);
    expect(mockCreateWindow).toHaveBeenCalledTimes(1);
    expect(mockLoadContent).toHaveBeenCalledTimes(1);
    expect(mockAutoSaveManager.start).toHaveBeenCalledTimes(1);
  });
});
