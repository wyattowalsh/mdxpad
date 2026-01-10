/**
 * Integration tests for window-handlers IPC module.
 * Tests window operations with mock BrowserWindow.
 *
 * Per Constitution Section 3.3: All payloads validated with zod on both ends.
 *
 * @module tests/integration/ipc/window-handlers.test
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { IpcMain, BrowserWindow } from 'electron';

// Mock electron modules before importing handlers
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn(),
  },
}));

// Import after mocks are set up
import { registerWindowHandlers } from '@main/ipc/window-handlers';
import { ipcMain } from 'electron';
import {
  createValidatedHandler,
  WindowCloseRequestSchema,
  WindowMinimizeRequestSchema,
  WindowMaximizeRequestSchema,
} from '@shared/contracts/file-schemas';

// Type assertion helpers for mocks
const mockIpcMain = ipcMain as unknown as { handle: Mock };

describe('window-handlers', () => {
  let registeredHandlers: Map<string, (event: unknown, args?: unknown) => Promise<unknown>>;
  let mockBrowserWindow: BrowserWindow & {
    close: Mock;
    minimize: Mock;
    maximize: Mock;
    restore: Mock;
    isMaximized: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Track registered handlers
    registeredHandlers = new Map();
    mockIpcMain.handle.mockImplementation(
      (channel: string, handler: (event: unknown, args?: unknown) => Promise<unknown>) => {
        registeredHandlers.set(channel, handler);
      }
    );

    // Create mock BrowserWindow with typed methods
    mockBrowserWindow = {
      close: vi.fn(),
      minimize: vi.fn(),
      maximize: vi.fn(),
      restore: vi.fn(),
      isMaximized: vi.fn(() => false),
      webContents: { send: vi.fn() },
    } as unknown as BrowserWindow & {
      close: Mock;
      minimize: Mock;
      maximize: Mock;
      restore: Mock;
      isMaximized: Mock;
    };

    // Register handlers
    registerWindowHandlers(ipcMain, mockBrowserWindow);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerWindowHandlers', () => {
    it('should register all expected window IPC handlers', () => {
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'mdxpad:window:close',
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'mdxpad:window:minimize',
        expect.any(Function)
      );
      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'mdxpad:window:maximize',
        expect.any(Function)
      );
    });
  });

  describe('mdxpad:window:close', () => {
    it('should call window.close()', async () => {
      const handler = registeredHandlers.get('mdxpad:window:close');
      expect(handler).toBeDefined();

      await handler!(undefined);

      expect(mockBrowserWindow.close).toHaveBeenCalledTimes(1);
    });

    it('should accept void request (no arguments)', async () => {
      const handler = registeredHandlers.get('mdxpad:window:close');

      // Should not throw with undefined args
      await expect(handler!(undefined)).resolves.toBeUndefined();
    });
  });

  describe('mdxpad:window:minimize', () => {
    it('should call window.minimize()', async () => {
      const handler = registeredHandlers.get('mdxpad:window:minimize');
      expect(handler).toBeDefined();

      await handler!(undefined);

      expect(mockBrowserWindow.minimize).toHaveBeenCalledTimes(1);
    });

    it('should accept void request (no arguments)', async () => {
      const handler = registeredHandlers.get('mdxpad:window:minimize');

      await expect(handler!(undefined)).resolves.toBeUndefined();
    });
  });

  describe('mdxpad:window:maximize', () => {
    it('should call window.maximize() when not maximized', async () => {
      mockBrowserWindow.isMaximized.mockReturnValue(false);

      const handler = registeredHandlers.get('mdxpad:window:maximize');
      expect(handler).toBeDefined();

      await handler!(undefined);

      expect(mockBrowserWindow.isMaximized).toHaveBeenCalledTimes(1);
      expect(mockBrowserWindow.maximize).toHaveBeenCalledTimes(1);
      expect(mockBrowserWindow.restore).not.toHaveBeenCalled();
    });

    it('should call window.restore() when already maximized', async () => {
      mockBrowserWindow.isMaximized.mockReturnValue(true);

      const handler = registeredHandlers.get('mdxpad:window:maximize');
      expect(handler).toBeDefined();

      await handler!(undefined);

      expect(mockBrowserWindow.isMaximized).toHaveBeenCalledTimes(1);
      expect(mockBrowserWindow.restore).toHaveBeenCalledTimes(1);
      expect(mockBrowserWindow.maximize).not.toHaveBeenCalled();
    });

    it('should accept void request (no arguments)', async () => {
      const handler = registeredHandlers.get('mdxpad:window:maximize');

      await expect(handler!(undefined)).resolves.toBeUndefined();
    });
  });
});

describe('window zod validation (Constitution Section 3.3 compliance)', () => {
  describe('createValidatedHandler with void schemas', () => {
    it('should accept undefined for WindowCloseRequestSchema', async () => {
      const handler = createValidatedHandler(WindowCloseRequestSchema, async () => {
        return 'closed';
      });

      const result = await handler(undefined);
      expect(result).toBe('closed');
    });

    it('should accept undefined for WindowMinimizeRequestSchema', async () => {
      const handler = createValidatedHandler(WindowMinimizeRequestSchema, async () => {
        return 'minimized';
      });

      const result = await handler(undefined);
      expect(result).toBe('minimized');
    });

    it('should accept undefined for WindowMaximizeRequestSchema', async () => {
      const handler = createValidatedHandler(WindowMaximizeRequestSchema, async () => {
        return 'maximized';
      });

      const result = await handler(undefined);
      expect(result).toBe('maximized');
    });

    it('should reject non-undefined values for void schemas', async () => {
      const handler = createValidatedHandler(WindowCloseRequestSchema, async () => {
        return 'closed';
      });

      // Void schema should reject non-undefined values
      await expect(handler({ unexpected: 'data' })).rejects.toThrow('Validation failed');
    });

    it('should reject string input for void schema', async () => {
      const handler = createValidatedHandler(WindowMinimizeRequestSchema, async () => {
        return 'minimized';
      });

      await expect(handler('invalid')).rejects.toThrow('Validation failed');
    });

    it('should reject number input for void schema', async () => {
      const handler = createValidatedHandler(WindowMaximizeRequestSchema, async () => {
        return 'maximized';
      });

      await expect(handler(123)).rejects.toThrow('Validation failed');
    });

    it('should reject array input for void schema', async () => {
      const handler = createValidatedHandler(WindowCloseRequestSchema, async () => {
        return 'closed';
      });

      await expect(handler([])).rejects.toThrow('Validation failed');
    });
  });
});

describe('window handler integration scenarios', () => {
  let mockBrowserWindow: BrowserWindow & {
    close: Mock;
    minimize: Mock;
    maximize: Mock;
    restore: Mock;
    isMaximized: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockBrowserWindow = {
      close: vi.fn(),
      minimize: vi.fn(),
      maximize: vi.fn(),
      restore: vi.fn(),
      isMaximized: vi.fn(),
      webContents: { send: vi.fn() },
    } as unknown as BrowserWindow & {
      close: Mock;
      minimize: Mock;
      maximize: Mock;
      restore: Mock;
      isMaximized: Mock;
    };
  });

  it('should toggle maximize state correctly on consecutive calls', async () => {
    // Track registered handlers for this test
    const handlers = new Map<string, (event: unknown, args?: unknown) => Promise<unknown>>();
    mockIpcMain.handle.mockImplementation(
      (channel: string, handler: (event: unknown, args?: unknown) => Promise<unknown>) => {
        handlers.set(channel, handler);
      }
    );

    registerWindowHandlers(ipcMain, mockBrowserWindow);
    const handler = handlers.get('mdxpad:window:maximize');

    // First call - not maximized, should maximize
    mockBrowserWindow.isMaximized.mockReturnValue(false);
    await handler!(undefined);
    expect(mockBrowserWindow.maximize).toHaveBeenCalledTimes(1);
    expect(mockBrowserWindow.restore).not.toHaveBeenCalled();

    // Clear mock calls
    vi.clearAllMocks();

    // Second call - now maximized, should restore
    mockBrowserWindow.isMaximized.mockReturnValue(true);
    await handler!(undefined);
    expect(mockBrowserWindow.restore).toHaveBeenCalledTimes(1);
    expect(mockBrowserWindow.maximize).not.toHaveBeenCalled();
  });

  it('should handle multiple window operations in sequence', async () => {
    const handlers = new Map<string, (event: unknown, args?: unknown) => Promise<unknown>>();
    mockIpcMain.handle.mockImplementation(
      (channel: string, handler: (event: unknown, args?: unknown) => Promise<unknown>) => {
        handlers.set(channel, handler);
      }
    );

    registerWindowHandlers(ipcMain, mockBrowserWindow);

    const minimizeHandler = handlers.get('mdxpad:window:minimize');
    const maximizeHandler = handlers.get('mdxpad:window:maximize');
    const closeHandler = handlers.get('mdxpad:window:close');

    mockBrowserWindow.isMaximized.mockReturnValue(false);

    // Minimize
    await minimizeHandler!(undefined);
    expect(mockBrowserWindow.minimize).toHaveBeenCalledTimes(1);

    // Maximize
    await maximizeHandler!(undefined);
    expect(mockBrowserWindow.maximize).toHaveBeenCalledTimes(1);

    // Close
    await closeHandler!(undefined);
    expect(mockBrowserWindow.close).toHaveBeenCalledTimes(1);
  });
});
