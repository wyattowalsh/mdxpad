/**
 * Window IPC Handlers Tests
 *
 * Tests window control operations: close, minimize, maximize/unmaximize.
 * Tests validation, BrowserWindow integration, and state management.
 *
 * @see src/main/ipc/window-handlers.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';

import { IPC_CHANNELS } from '@shared/lib/ipc';
import { registerWindowHandlers } from '../window-handlers';

// ============================================================================
// Mock Setup
// ============================================================================

const mockIpcMain = {
  handle: vi.fn(),
} as unknown as IpcMain;

function createMockWindow(): BrowserWindow {
  return {
    close: vi.fn(),
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    isMaximized: vi.fn().mockReturnValue(false),
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

// ============================================================================
// Handler Registration Tests
// ============================================================================

describe('registerWindowHandlers', () => {
  it('should register all window handlers', () => {
    const window = createMockWindow();
    registerWindowHandlers(mockIpcMain, window);

    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.window.close,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.window.minimize,
      expect.any(Function)
    );
    expect(mockIpcMain.handle).toHaveBeenCalledWith(
      IPC_CHANNELS.window.maximize,
      expect.any(Function)
    );
  });
});

// ============================================================================
// Window Close Handler Tests
// ============================================================================

describe('window:close Handler', () => {
  let window: BrowserWindow;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
    handlers = {};

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, args: unknown) =>
        handler((event ?? createInvokeEvent(window)) as IpcMainInvokeEvent, args);
    });

    registerWindowHandlers(mockIpcMain, window);
  });

  it('should close the window', async () => {
    await handlers[IPC_CHANNELS.window.close]!(null, undefined);

    expect(window.close).toHaveBeenCalledTimes(1);
  });

  it('should return void successfully', async () => {
    const result = await handlers[IPC_CHANNELS.window.close]!(null, undefined);

    expect(result).toBeUndefined();
  });

  it('should handle undefined args', async () => {
    await handlers[IPC_CHANNELS.window.close]!(null, undefined);

    expect(window.close).toHaveBeenCalled();
  });

  it('should reject unauthorized sender', async () => {
    expect(() =>
      handlers[IPC_CHANNELS.window.close]!(
        createInvokeEvent(window, { senderId: window.webContents.id + 1 }),
        undefined
      )
    ).toThrow('Unauthorized IPC sender');

    expect(window.close).not.toHaveBeenCalled();
  });

  it('should reject unauthorized sender frame', async () => {
    expect(() =>
      handlers[IPC_CHANNELS.window.close]!(
        createInvokeEvent(window, {
          senderFrameRoutingId: window.webContents.mainFrame.routingId + 1,
        }),
        undefined
      )
    ).toThrow('Unauthorized IPC sender');

    expect(window.close).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Window Minimize Handler Tests
// ============================================================================

describe('window:minimize Handler', () => {
  let window: BrowserWindow;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
    handlers = {};

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, args: unknown) =>
        handler((event ?? createInvokeEvent(window)) as IpcMainInvokeEvent, args);
    });

    registerWindowHandlers(mockIpcMain, window);
  });

  it('should minimize the window', async () => {
    await handlers[IPC_CHANNELS.window.minimize]!(null, undefined);

    expect(window.minimize).toHaveBeenCalledTimes(1);
  });

  it('should return void successfully', async () => {
    const result = await handlers[IPC_CHANNELS.window.minimize]!(null, undefined);

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Window Maximize Handler Tests
// ============================================================================

describe('window:maximize Handler', () => {
  let window: BrowserWindow;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
    handlers = {};

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, args: unknown) =>
        handler((event ?? createInvokeEvent(window)) as IpcMainInvokeEvent, args);
    });

    registerWindowHandlers(mockIpcMain, window);
  });

  it('should maximize window when not maximized', async () => {
    vi.mocked(window.isMaximized).mockReturnValue(false);

    await handlers[IPC_CHANNELS.window.maximize]!(null, undefined);

    expect(window.isMaximized).toHaveBeenCalled();
    expect(window.maximize).toHaveBeenCalledTimes(1);
    expect(window.unmaximize).not.toHaveBeenCalled();
  });

  it('should unmaximize window when already maximized', async () => {
    vi.mocked(window.isMaximized).mockReturnValue(true);

    await handlers[IPC_CHANNELS.window.maximize]!(null, undefined);

    expect(window.isMaximized).toHaveBeenCalled();
    expect(window.unmaximize).toHaveBeenCalledTimes(1);
    expect(window.maximize).not.toHaveBeenCalled();
  });

  it('should toggle maximize state correctly', async () => {
    // Start not maximized
    vi.mocked(window.isMaximized).mockReturnValue(false);

    await handlers[IPC_CHANNELS.window.maximize]!(null, undefined);
    expect(window.maximize).toHaveBeenCalledTimes(1);

    // Now maximized
    vi.mocked(window.isMaximized).mockReturnValue(true);

    await handlers[IPC_CHANNELS.window.maximize]!(null, undefined);
    expect(window.unmaximize).toHaveBeenCalledTimes(1);

    // Back to not maximized
    vi.mocked(window.isMaximized).mockReturnValue(false);

    await handlers[IPC_CHANNELS.window.maximize]!(null, undefined);
    expect(window.maximize).toHaveBeenCalledTimes(2);
  });

  it('should return void successfully', async () => {
    const result = await handlers[IPC_CHANNELS.window.maximize]!(null, undefined);

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Window Handler Integration', () => {
  let window: BrowserWindow;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- IPC handlers have heterogeneous signatures
  let handlers: Record<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    window = createMockWindow();
    handlers = {};

    vi.mocked(mockIpcMain.handle).mockImplementation((channel, handler) => {
      handlers[channel] = (event: unknown, args: unknown) =>
        handler((event ?? createInvokeEvent(window)) as IpcMainInvokeEvent, args);
    });

    registerWindowHandlers(mockIpcMain, window);
  });

  it('should handle multiple close calls', async () => {
    await handlers[IPC_CHANNELS.window.close]!(null, undefined);
    await handlers[IPC_CHANNELS.window.close]!(null, undefined);

    expect(window.close).toHaveBeenCalledTimes(2);
  });

  it('should handle multiple minimize calls', async () => {
    await handlers[IPC_CHANNELS.window.minimize]!(null, undefined);
    await handlers[IPC_CHANNELS.window.minimize]!(null, undefined);
    await handlers[IPC_CHANNELS.window.minimize]!(null, undefined);

    expect(window.minimize).toHaveBeenCalledTimes(3);
  });

  it('should handle rapid maximize toggles', async () => {
    vi.mocked(window.isMaximized).mockReturnValue(false);
    await handlers[IPC_CHANNELS.window.maximize]!(null, undefined);

    vi.mocked(window.isMaximized).mockReturnValue(true);
    await handlers[IPC_CHANNELS.window.maximize]!(null, undefined);

    vi.mocked(window.isMaximized).mockReturnValue(false);
    await handlers[IPC_CHANNELS.window.maximize]!(null, undefined);

    expect(window.maximize).toHaveBeenCalledTimes(2);
    expect(window.unmaximize).toHaveBeenCalledTimes(1);
  });

  it('should handle concurrent operations', async () => {
    const operations = [
      handlers[IPC_CHANNELS.window.minimize]!(null, undefined),
      handlers[IPC_CHANNELS.window.maximize]!(null, undefined),
    ];

    await Promise.all(operations);

    expect(window.minimize).toHaveBeenCalledTimes(1);
    expect(window.maximize).toHaveBeenCalledTimes(1);
  });
});
